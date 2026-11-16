const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const {buildSync}=require('esbuild');
const root=path.resolve(__dirname,'..');
const filename=path.join(root,'tests/pathos-hosted-profile.cjs');
const bundle=buildSync({
  stdin:{
    contents:'export {handleProfile,config} from "./netlify/functions/pathos-profile"; export {requireOwner} from "./src/lib/pathos-catalogue";',
    resolveDir:root,loader:'ts'
  },
  bundle:true,packages:'external',write:false,format:'cjs',platform:'node'
});
const compiled=new Module(filename,module);
compiled.filename=filename;compiled.paths=module.paths;
compiled._compile(bundle.outputFiles[0].text,filename);
const {handleProfile,config,requireOwner}=compiled.exports;
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'public/pathos/config.js'),'utf8'),scope);
const ownerId=scope.window.PATHOS_CONFIG.ownerUserId;
const origin='https://enricomattiasalonia.com',url=origin+'/api/pathos/profile';
const photo='data:image/jpeg;base64,/9j/AA==',bearer='Bearer test-owner-session-not-real-1234';
const put=(body,headers={})=>new Request(url,{method:'PUT',body:JSON.stringify(body),headers:{'Content-Type':'application/json',...headers}});
function fixture(){
  let value=null;
  const calls=[];
  const openStore=()=>({get:async key=>{calls.push(['get',key]);return value;},set:async(key,next)=>{calls.push(['set',key]);value=next;}});
  return {calls,openStore};
}
function verifyAs(id){
  return request=>requireOwner(request,async(target,init)=>{
    assert.equal(new URL(target).pathname,'/auth/v1/user');
    assert.equal(init.headers.Authorization,bearer);
    return Response.json({id});
  });
}

test('a public hosted profile returns only the display name and optional photo',async()=>{
  assert.equal(config.path,'/api/pathos/profile');
  const {openStore,calls}=fixture();
  const response=await handleProfile(new Request(url,{headers:{Origin:'https://preview.example'}}),openStore);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'*');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.match(response.headers.get('X-Robots-Tag'),/noindex/);
  assert.deepEqual(await response.json(),{format:'pathos-profile-v1',name:'Enrico Mattia Salonia',photo:''});
  assert.deepEqual(calls,[['get','photo']]);
});

test('only the verified owner can set or clear the hosted photo',async()=>{
  const {openStore,calls}=fixture();
  assert.equal((await handleProfile(put({photo}),openStore)).status,401);
  assert.equal((await handleProfile(put({photo},{Authorization:bearer}),openStore,verifyAs('someone-else'))).status,403);
  assert.equal((await handleProfile(put({photo},{Authorization:bearer,Origin:'https://other.example'}),openStore,verifyAs(ownerId))).status,403);
  assert.deepEqual(calls,[]);
  const save=await handleProfile(put({photo},{Authorization:bearer,Origin:origin}),openStore,verifyAs(ownerId));
  assert.equal(save.status,200);
  assert.equal(save.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal((await save.json()).photo,photo);
  assert.equal((await (await handleProfile(new Request(url),openStore)).json()).photo,photo);
  await handleProfile(put({photo:''},{Authorization:bearer}),openStore,verifyAs(ownerId));
  assert.equal((await (await handleProfile(new Request(url),openStore)).json()).photo,'');
});

test('invalid or oversized uploads never reach the store',async()=>{
  const {openStore,calls}=fixture();
  for(const body of [{photo:'https://example.com/profile.jpg'},{photo,ownerId:'secret'},{photo:null}]){
    assert.equal((await handleProfile(put(body,{Authorization:bearer}),openStore,verifyAs(ownerId))).status,400);
  }
  assert.equal((await handleProfile(put({photo:'a'.repeat(80*1024)},{Authorization:bearer}),openStore,verifyAs(ownerId))).status,413);
  assert.deepEqual(calls,[]);
});
