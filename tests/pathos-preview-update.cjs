/* Two-deployment Netlify preview check, with synthetic records only.
 * Set PATHOS_PREVIEW_URL and PATHOS_PREVIEW_PROFILE (a pathos-preview-* temp dir).
 * Run `node tests/pathos-preview-update.cjs seed`, deploy a bumped shell version
 * to the same PR hostname, then run `node tests/pathos-preview-update.cjs verify`.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {chromium}=require('playwright');
const target=new URL(process.env.PATHOS_PREVIEW_URL||'https://invalid.invalid');
assert.match(target.hostname,/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/,'Only a Netlify PR preview is allowed');
const profile=path.resolve(process.env.PATHOS_PREVIEW_PROFILE||'');
assert.ok(profile.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(profile).startsWith('pathos-preview-'),'Use a dedicated pathos-preview-* profile under the temporary directory');
const stage=process.argv[2];assert.ok(['seed','verify'].includes(stage));
const stateFile=profile+'.json';
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6v7sAAAAASUVORK5CYII=';
const fixture={schemaVersion:6,works:[{id:'preview-book',title:'Πathos preview test book',type:'Book',creator:'Synthetic author',cover:pixel,aliases:[]}],experiences:[{id:'preview-reading',workId:'preview-book',status:'completed',startDate:'2026-10-14',endDate:'2026-10-14',rating:4,review:'Preview review',quotes:[{id:'preview-passage',text:'Preview passage',note:'p. 1',featured:true}],edition:{isbn:'9780140328721',sourceId:'synthetic-storygraph-uid',publisher:'Manual publisher',cover:pixel,contributors:'Synthetic translator',source:'manual'}}]};
const launch={headless:true,channel:process.env.PATHOS_BROWSER||'msedge'};
let context;
const errors=[];
async function page(){
  const p=await context.newPage();
  p.on('pageerror',error=>errors.push(error.message));
  p.on('dialog',dialog=>dialog.accept());
  await p.goto(target.origin+'/pathos-personal/index.html');
  await p.waitForFunction(()=>window.pathosPersonalReady);
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
  return p;
}
async function getArchive(p){return p.evaluate(()=>JSON.parse(JSON.stringify(db)));}
async function shellCaches(p){return p.evaluate(async()=>(await caches.keys()).filter(x=>x.startsWith('pathos-personal-shell-')));}
async function start(){
  context=await chromium.launchPersistentContext(profile,launch);
  // Personal has no cloud connection. Prevent unrelated external requests here too.
  await context.route('**/*',route=>route.request().url().startsWith(target.origin)||route.request().url().startsWith('data:')?route.continue():route.abort());
}
(async()=>{
  await start();let app=await page();
  if(stage==='seed'){
    assert.equal((await getArchive(app)).works.length,0,'Seed needs an empty isolated preview profile');
    await app.locator('#restoreInput').setInputFiles({name:'synthetic-preview.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
    await app.waitForFunction(()=>!document.getElementById('restoreInput').value&&pendingWrites===0&&!archiveBusy);
    const state={origin:target.origin,archive:await getArchive(app),caches:await shellCaches(app)};
    await fs.writeFile(stateFile,JSON.stringify(state,null,2));
    assert.deepEqual(state.caches,['pathos-personal-shell-v4']);
    console.log('PASS preview release A seeded and persisted: '+state.caches.join(', '));
    return;
  }
  const state=JSON.parse(await fs.readFile(stateFile,'utf8'));assert.equal(state.origin,target.origin);
  assert.deepEqual(await getArchive(app),state.archive);
  const peer=await page();await peer.evaluate(()=>window.previewClientMarker='still-open');
  await app.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
  await app.locator('#pathosUpdateBanner').waitFor({state:'visible',timeout:45000});
  assert.ok((await shellCaches(app)).includes('pathos-personal-shell-v4'));
  await app.locator('#pathosUpdateLater').click();
  assert.equal(await app.locator('#pathosUpdateBanner').isVisible(),false);
  assert.deepEqual(await getArchive(app),state.archive);
  await app.reload();await app.waitForFunction(()=>window.pathosPersonalReady);
  await app.locator('#pathosUpdateBanner').waitFor({state:'visible'});
  await app.locator('#addBtn').click();await app.locator('[name="title"]').fill('Unfinished preview entry');
  await app.evaluate(()=>document.getElementById('pathosUpdateNow').click());
  assert.equal(await app.locator('#entryDialog').evaluate(el=>el.open),true);
  await app.locator('#cancelBtn').click();
  const reload=app.waitForEvent('load');await app.locator('#pathosUpdateNow').click();await reload;
  await app.waitForFunction(()=>window.pathosPersonalReady);
  assert.deepEqual(await shellCaches(app),['pathos-personal-shell-v5']);
  assert.deepEqual(await getArchive(app),state.archive);
  assert.equal(await peer.evaluate(()=>window.previewClientMarker),'still-open');
  await peer.close();
  await context.setOffline(true);
  await app.reload();await app.waitForFunction(()=>window.pathosPersonalReady);
  await app.evaluate(()=>openExperience('preview-reading'));
  await app.locator('[name="review"]').fill('Offline preview edit');
  await app.locator('#entryForm button[type="submit"]').click();
  await app.waitForFunction(()=>pendingWrites===0&&!archiveBusy);
  await context.close();await start();await context.setOffline(true);app=await page();
  const reopened=await getArchive(app);
  assert.equal(reopened.experiences[0].review,'Offline preview edit');
  assert.deepEqual(reopened.experiences[0].edition,state.archive.experiences[0].edition);
  assert.deepEqual(reopened.experiences[0].quotes,state.archive.experiences[0].quotes);
  await app.screenshot({path:profile+'-desktop.png',fullPage:true});
  await app.setViewportSize({width:390,height:844});
  await app.screenshot({path:profile+'-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS real Netlify preview v4 → v5: Later, update re-offer, open-entry guard, two clients, cache cleanup, preserved archive, offline edit and browser restart');
  console.log('Screenshots: '+profile+'-desktop.png and '+profile+'-mobile.png');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await context?.close();});
