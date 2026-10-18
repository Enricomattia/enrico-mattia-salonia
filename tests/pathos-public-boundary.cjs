// Read-only live boundary check using the checked-in publishable key.
// No passwords, tokens, private records, or production writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/pathos/config.js'),'utf8'),sandbox);
const config=sandbox.window.PATHOS_CONFIG;
const allowed=['id','workId','rating','review','startDate','endDate','status','venue','viewingLanguage','tags','cover','quotes','edition','sourceUrl','repeat'];
async function request(route,body){
  const result=await fetch(config.supabaseUrl+'/rest/v1/'+route,{method:body?'POST':'GET',headers:{apikey:config.supabasePublishableKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  return {status:result.status,data:await result.json()};
}
(async()=>{
  for(const table of ['pathos_works','pathos_experiences']){
    const response=await request(table+'?select=owner_id&limit=1');
    assert.ok([401,403].includes(response.status)||(response.status===200&&Array.isArray(response.data)&&response.data.length===0),'Anonymous table read must be denied or empty');
    console.log('PASS anonymous '+table+' read: '+response.status+' (no rows exposed)');
  }
  const archive=await request('rpc/pathos_get_public_archive',{p_owner_id:config.ownerUserId});
  assert.equal(archive.status,200);assert.ok(Array.isArray(archive.data.experiences));
  for(const experience of archive.data.experiences){
    assert.ok(Object.keys(experience).every(key=>allowed.includes(key)),'Public RPC includes an unexpected field');
    assert.equal(typeof experience.viewingLanguage,'string');
  }
  for(const work of archive.data.works){
    assert.ok(Object.keys(work).every(key=>['id','title','type','creator','year','cover','aliases','liked'].includes(key)));
    assert.equal(typeof work.liked,'boolean');
  }
  console.log('PASS public RPC: '+archive.data.experiences.length+' published experiences, allowed fields only');
  const own=await request('rpc/pathos_get_my_archive',{});
  assert.ok([401,403].includes(own.status),'Anonymous private RPC must be denied');
  console.log('PASS anonymous private RPC denied: '+own.status);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
