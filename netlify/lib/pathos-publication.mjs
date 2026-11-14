import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {getDeployStore,getStore} from '@netlify/blobs';

const storeName='pathos-publication-v1';
const hexadecimal=/^[a-f0-9]+$/;
const revisionPattern=/^[a-f0-9-]{36}$/;
const baseHeaders={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const plain=(message,status)=>new Response(message,{status,headers:baseHeaders});
const json=(value,status=200)=>Response.json(value,{status,headers:baseHeaders});

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
export async function managePublication(request,id,getStore=publicationStore){
  if(!validId(id)||!authorized(request,id))return json({error:'The publication key is invalid.'},403);
  if(!['GET','PUT','DELETE'].includes(request.method))return json({error:'Method not allowed.'},405);
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin
    ||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Open Πathos Personal to manage a publication.'},403);
  if(request.method==='PUT')return json({error:'Publishing now uses your Netlify account. Update Πathos Personal to continue.'},410);
  try{
    const store=getStore();
    const previous=await store.getMetadata(id);
    const before=previous?.metadata;
    if(request.method==='GET')return json({published:before?.published===true,revision:before?.revision??null});
    const expected=request.headers.get('X-Pathos-Revision');
    const changed=()=>json({error:'The public copy changed. Check its status, then try again.'},409);
    if(!previous?.etag||before?.published!==true||!expected||!revisionPattern.test(expected)||before.revision!==expected)return changed();

    // Keep the existing conditional takedown so a stale client cannot delete a changed copy.
    const revision=randomUUID(),metadata={revision,published:false,csp:''};
    const result=await store.set(id,'',{metadata,onlyIfMatch:previous.etag});
    return result.modified?json({published:false,revision}):changed();
  }catch{return json({error:'Πathos could not check or take the previous copy offline. Try again shortly.'},503);}
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
