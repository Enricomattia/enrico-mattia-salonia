const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,randomUUID}=require('node:crypto');
const {readFile}=require('node:fs/promises');
const {pageId,managePublication,readPublication,validSnapshot}=require('../netlify/lib/pathos-publication.mjs');
const {digest,buildPublication,projectArchive}=require('../public/pathos-personal/publish-core.mjs');

function memoryStore(){
  const pages=new Map();
  return {
    pages,
    getMetadata:async id=>pages.get(id)||null,
    getWithMetadata:async id=>pages.get(id)||null,
    async set(id,data,{metadata,onlyIfNew,onlyIfMatch}){
      const existing=pages.get(id);
      if(onlyIfNew?existing:existing?.etag!==onlyIfMatch)return {modified:false};
      pages.set(id,{data,metadata,etag:randomUUID()});return {modified:true};
    }
  };
}
const key=randomBytes(32).toString('hex'),id=pageId(key),store=memoryStore();
const auth={Authorization:'Bearer '+key};
const origin='https://pathos.example';
const request=(method,headers,body)=>new Request(origin+'/api/pathos-personal/publication/'+id,{method,headers,body});
const share=method=>new Request(origin+'/pathos-share/'+id,{method});
const snapshot=projectArchive({
  works:[{id:'private-work',type:'Book',title:'A book',external:{secret:'Private data'}}],
  experiences:[{id:'private-entry',workId:'private-work',status:'completed',review:'A **review** <script>window.injected=1</script>'}]
},['private-entry'],{title:'A public website',username:'reader'});

async function bodyFor(value){
  const names={html:'published-reader.txt',css:'published-reader.css',reader:'published-reader.js',parser:'markdown-it.min.js',
    parserLicense:'markdown-it.LICENSE.txt',fontLicense:'fonts/LICENSE.txt',format:'review-format.js',
    serif:'fonts/newsreader-latin.woff2',sans:'fonts/instrument-sans-latin.woff2'};
  const assets=Object.fromEntries(await Promise.all(Object.entries(names).map(async([key,name])=>[key,await readFile('public/pathos-personal/'+name,name.endsWith('.woff2')?'base64':'utf8')])));
  const html=(await buildPublication(value,assets)).get('/index.html');
  return {html,body:JSON.stringify({snapshot:value,digest:await digest(html)})};
}

test('only approved reader fields are accepted',()=>{
  assert(validSnapshot(snapshot));
  for(const alter of [
    state=>{state.privateArchive={};},
    state=>{state.works[0].external={};},
    state=>{state.experiences[0].id='private-entry';},
    state=>{state.experiences[0].workId='missing';},
    state=>{state.experiences[0].cover='https://example.com/image?token=private';},
    state=>{state.experiences[0].quotes=[{text:'A quote',note:'',featured:true,id:'private-id'}];}
  ]){
    const state=structuredClone(snapshot);alter(state);assert(!validSnapshot(state));
  }
});

test('public read, owner-only edits, concurrency and immediate takedown',async()=>{
  const getStore=()=>store;
  const {html,body}=await bodyFor(snapshot);
  const create={...auth,'Content-Type':'application/json','If-None-Match':'*'};
  const manage=(method,headers,data)=>managePublication(request(method,headers,data),id,getStore);
  const read=method=>readPublication(share(method),id,getStore);
  assert.equal((await read('GET')).status,404);
  assert.equal((await manage('GET',{})).status,403);
  assert.equal((await manage('PUT',{...create,Origin:'https://other.example'},body)).status,403);
  assert.equal((await manage('PUT',create,body.replace(/"digest":"[a-f0-9]{64}"/,'"digest":"'+'0'.repeat(64)+'"'))).status,409);
  assert.equal((await manage('PUT',{...create,'Content-Length':5*1024*1024},body)).status,413);
  const published=await manage('PUT',create,body);
  assert.equal(published.status,201);
  const {revision}=await published.json();
  assert.equal((await manage('PUT',create,body)).status,409);
  assert.equal((await manage('DELETE',{Authorization:'Bearer '+randomBytes(32).toString('hex'),'If-Match':revision})).status,403);
  const rendered=await read('GET');
  assert.equal(await rendered.text(),html);
  assert(!html.includes(key)&&!html.includes('Private data')&&!html.includes('private-entry'));
  assert.match(rendered.headers.get('Content-Security-Policy'),/frame-ancestors 'none'; sandbox allow-scripts allow-popups$/);
  assert.equal(rendered.headers.get('Cache-Control'),'no-store');
  assert.equal((await read('HEAD')).headers.get('X-Pathos-Publication'),'v1');
  const update={...auth,'Content-Type':'application/json','If-Match':revision};
  const edited=await bodyFor({...snapshot,title:'Edited public copy'});
  const attempts=await Promise.all([manage('PUT',update,edited.body),manage('PUT',update,body)]);
  assert.deepEqual(attempts.map(response=>response.status).sort(),[200,409]);
  const current=await (await manage('GET',auth)).json();
  assert.equal((await manage('DELETE',{...auth,'If-Match':revision})).status,409);
  assert.equal((await manage('DELETE',{...auth,'If-Match':current.revision})).status,200);
  assert.equal((await read('GET')).status,404);
  assert.equal(store.pages.get(id).data,'','Takedown clears hosted content');
  const offline=await (await manage('GET',auth)).json();
  assert.equal(offline.published,false);
  assert.equal((await manage('PUT',{...update,'If-Match':offline.revision},body)).status,200);
  assert.equal(await (await read('GET')).text(),html,'Republishing uses the same link');
});
