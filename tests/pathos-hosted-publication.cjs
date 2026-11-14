const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,randomUUID}=require('node:crypto');
const {pageId,managePublication,readPublication}=require('../netlify/lib/pathos-publication.mjs');

const origin='https://pathos.example';
const key=randomBytes(32).toString('hex'),id=pageId(key);
const auth={Authorization:'Bearer '+key};
const manage=(method,headers=auth)=>new Request(origin+'/api/pathos-personal/publication/'+id,{method,headers});
const share=method=>new Request(origin+'/pathos-share/'+id,{method});

function previousCopy(){
  const revision=randomUUID();
  const html='<html><title>Previously published diary</title></html>';
  let page={data:html,metadata:{revision,published:true,csp:"default-src 'none'"},etag:'original'};
  const getStore=()=>({
    getMetadata:async value=>value===id?page:null,
    getWithMetadata:async value=>value===id?page:null,
    async set(value,data,{metadata,onlyIfMatch}){
      if(value!==id||onlyIfMatch!==page.etag)return {modified:false};
      page={data,metadata,etag:'next'};
      return {modified:true};
    }
  });
  return {getStore,revision,html};
}

test('the retired uploader rejects even authenticated writes without using storage',async()=>{
  for(const revision of ['new',randomUUID()]){
    const response=await managePublication(manage('PUT',{...auth,'X-Pathos-Revision':revision}),id,()=>{
      assert.fail('The retired uploader accessed storage');
    });
    assert.equal(response.status,410);
    assert.match((await response.json()).error,/your Netlify account/);
  }
});

test('a previous copy remains readable and only its editor can take it offline',async()=>{
  const {getStore,revision,html}=previousCopy();
  const page=await readPublication(share('GET'),id,getStore);
  assert.equal(page.status,200);
  assert.equal(page.headers.get('Cache-Control'),'no-store');
  assert.match(page.headers.get('X-Robots-Tag'),/noindex/);
  assert.match(page.headers.get('Content-Security-Policy'),/sandbox allow-scripts allow-popups/);
  assert.equal(await page.text(),html);
  const head=await readPublication(share('HEAD'),id,getStore);
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
  const status=await managePublication(manage('GET'),id,getStore);
  assert.deepEqual(await status.json(),{published:true,revision});
  for(const headers of [{},{...auth,Origin:'https://other.example'},{Authorization:'Bearer '+'0'.repeat(64)}]){
    assert.equal((await managePublication(manage('DELETE',headers),id,getStore)).status,403);
  }
  const remove=expected=>managePublication(manage('DELETE',{...auth,'X-Pathos-Revision':expected}),id,getStore);
  assert.equal((await remove(randomUUID())).status,409);
  assert.equal((await readPublication(share('GET'),id,getStore)).status,200);
  const takenOffline=await remove(revision);
  assert.equal(takenOffline.status,200);
  assert.equal((await takenOffline.json()).published,false);
  assert.equal((await remove(revision)).status,409);
  const missing=await readPublication(share('GET'),id,getStore);
  assert.equal(missing.status,404);
  assert.doesNotMatch(await missing.text(),/Previously published/);
});
