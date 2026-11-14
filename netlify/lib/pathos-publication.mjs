import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {getDeployStore,getStore} from '@netlify/blobs';
import {buildPublication,digest,publicImage} from '../../public/pathos-personal/publish-core.mjs';

const storeName='pathos-publication-v1';
const byteLimit=4*1024*1024;
const hexadecimal=/^[a-f0-9]+$/;
const revisionPattern=/^[a-f0-9-]{36}$/;
const baseHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const plain=(message,status)=>new Response(message,{status,headers:baseHeaders});
const json=(value,status=200)=>Response.json(value,{status,headers:baseHeaders});

class InputError extends Error{
  constructor(message,status=400){super(message);this.status=status;}
}

export function publicationStore(context){
  const options={name:storeName,consistency:'strong'};
  return context.deploy.context==='production'?getStore(options):getDeployStore(options);
}

export function pageId(secret){
  return createHash('sha256').update('pathos-publication-v1:'+secret).digest('hex').slice(0,32);
}

function authorized(request,id){
  const secret=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  return Boolean(secret&&timingSafeEqual(Buffer.from(id),Buffer.from(pageId(secret))));
}

function validId(id){return typeof id==='string'&&id.length===32&&hexadecimal.test(id);}
function field(value,length){return typeof value==='string'&&value.length<=length;}
function shape(value,keys){
  return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
function validDate(value){return value===''||typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);}

// Accept only the public reader's data. Identifiers and private archive fields are rejected.
export function validSnapshot(value){
  if(!shape(value,['format','title','username','works','experiences'])||value.format!=='pathos-publication-v1'
    ||!field(value.title,120)||!value.title.trim()||!field(value.username,40)
    ||!Array.isArray(value.works)||!Array.isArray(value.experiences)||value.works.length>value.experiences.length||value.experiences.length>10000)return false;
  const unused=new Set();
  if(!value.works.every((work,index)=>{
    if(!shape(work,['id','title','creator','type','year'])||work.id!=='w'+(index+1)||!field(work.title,500)||!field(work.creator,500)||!field(work.type,30)||!field(work.year,10))return false;
    unused.add(work.id);
    return true;
  }))return false;
  const workIds=new Set(unused);
  const editionFields={title:500,publisher:500,publishYear:10,language:100,format:100,series:500,seriesNumber:30};
  return value.experiences.every((entry,index)=>{
    if(!shape(entry,['id','workId','startDate','endDate','status','rating','review','quotes','cover','edition'])
      ||entry.id!=='e'+(index+1)||!workIds.has(entry.workId)
      ||!validDate(entry.startDate)||!validDate(entry.endDate)
      ||!['completed','planned','in-progress','dnf'].includes(entry.status)
      ||!(entry.rating===''||typeof entry.rating==='number'&&entry.rating>=0&&entry.rating<=5)
      ||!field(entry.review,100000)||!Array.isArray(entry.quotes)
      ||!(entry.cover===''||typeof entry.cover==='string'&&publicImage(entry.cover)===entry.cover))return false;
    unused.delete(entry.workId);
    return (entry.edition===null||shape(entry.edition,Object.keys(editionFields))&&Object.entries(editionFields).every(([key,limit])=>field(entry.edition[key],limit)))
      &&entry.quotes.every(quote=>shape(quote,['text','note','featured'])&&field(quote.text,20000)&&field(quote.note,500)&&typeof quote.featured==='boolean');
  })&&unused.size===0;
}

async function requestBody(request){
  if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')throw new InputError('Send the approved preview as JSON.',415);
  if(Number(request.headers.get('Content-Length'))>byteLimit)throw new InputError('The public copy is too large. Exclude some covers or experiences and try again.',413);
  const reader=request.body?.getReader();
  if(!reader)throw new InputError('The approved preview is missing.');
  let length=0;
  const chunks=[];
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    length+=value.length;
    if(length>byteLimit){
      await reader.cancel();
      throw new InputError('The public copy is too large. Exclude some covers or experiences and try again.',413);
    }
    chunks.push(value);
  }
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,length)));}
  catch{throw new InputError('The approved preview is invalid.');}
}

let assets;
function readerAssets(){
  assets??=Promise.all(Object.entries({
    html:'published-reader.txt',css:'published-reader.css',reader:'published-reader.js',
    parser:'markdown-it.min.js',parserLicense:'markdown-it.LICENSE.txt',fontLicense:'fonts/LICENSE.txt',
    format:'review-format.js',serif:'fonts/newsreader-latin.woff2',sans:'fonts/instrument-sans-latin.woff2'
  }).map(async([key,path])=>[key,await readFile('public/pathos-personal/'+path,path.endsWith('.woff2')?'base64':'utf8')]))
    .then(Object.fromEntries).catch(error=>{assets=undefined;throw error;});
  return assets;
}

export async function managePublication(request,id,getStore=publicationStore){
  if(!validId(id)||!authorized(request,id))return json({error:'The publication key is invalid.'},403);
  if(!['GET','PUT','DELETE'].includes(request.method))return json({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin
    ||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Open Πathos Personal to manage a publication.'},403);
  try{
    const store=getStore();
    const previous=await store.getMetadata(id);
    const before=previous?.metadata;
    if(request.method==='GET')return json({published:before?.published===true,revision:before?.revision??null});
    const expected=request.headers.get('If-Match');
    const create=request.method==='PUT'&&request.headers.get('If-None-Match')==='*'&&!previous;
    const replace=Boolean(previous?.etag&&expected&&revisionPattern.test(expected)&&before?.revision===expected);
    if(!create&&!replace)return json({error:'The public copy changed. Check its status, then try again.'},409);
    let html='',csp='';
    const published=request.method==='PUT';
    if(published){
      const body=await requestBody(request);
      if(!shape(body,['snapshot','digest'])||!validSnapshot(body.snapshot)||!field(body.digest,64)||body.digest.length!==64||!hexadecimal.test(body.digest))
        throw new InputError('The approved preview is invalid.');
      if(before?.published!==true&&!body.snapshot.experiences.length)throw new InputError('Include at least one experience to publish the website.');
      const files=await buildPublication(body.snapshot,await readerAssets());
      html=files.get('/index.html');
      if(Buffer.byteLength(html)>byteLimit)throw new InputError('The public copy is too large. Exclude some covers or experiences and try again.',413);
      if(await digest(html)!==body.digest)return json({error:'The website preview has changed. Update or reload Πathos, then preview it again.'},409);
      csp=files.get('/_headers').match(/^  Content-Security-Policy: (.+)$/m)[1];
    }
    // Replacing the content with an empty tombstone makes takedown conditional too.
    const revision=randomUUID(),metadata={revision,published,csp};
    const result=await store.set(id,html,create?{metadata,onlyIfNew:true}:{metadata,onlyIfMatch:previous.etag});
    if(!result.modified)return json({error:'The public copy changed. Check its status, then try again.'},409);
    return json({published,revision},create?201:200);
  }catch(error){
    if(error instanceof InputError)return json({error:error.message},error.status);
    return json({error:'Πathos could not save or check the public copy. Try again shortly.'},503);
  }
}

export async function readPublication(request,id,getStore=publicationStore){
  if(!validId(id))return plain('This Πathos site is unavailable.',404);
  if(!['GET','HEAD'].includes(request.method))return plain('Method not allowed.',405);
  try{
    const store=getStore();
    const page=request.method==='HEAD'?await store.getMetadata(id):await store.getWithMetadata(id);
    if(page?.metadata?.published!==true)return plain('This Πathos site is unavailable.',404);
    return new Response(request.method==='HEAD'?null:page.data,{headers:{
      ...baseHeaders,'Content-Type':'text/html; charset=utf-8',
      'Content-Security-Policy':page.metadata.csp+'; sandbox allow-scripts allow-popups',
      'X-Pathos-Publication':'v1'
    }});
  }catch{return plain('This Πathos site is temporarily unavailable.',503);}
}
