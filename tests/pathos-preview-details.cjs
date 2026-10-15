// Real deploy-preview assets, synthetic archives and isolated browser contexts.
const assert=require('node:assert/strict');
const os=require('node:os');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {checkEntryDetails}=require('./pathos-entry-details.cjs');
const {checkCoverAccents}=require('./pathos-cover-accent.cjs');
const {checkNavigation}=require('./pathos-navigation.cjs');
const target=new URL(process.env.PATHOS_PREVIEW_URL||'https://invalid.invalid');
assert.match(target.hostname,/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/,'Only a Netlify PR preview is allowed');
const moduleSource=`export function createClient(){return {auth:{getUser:async()=>({data:{user:{id:window.PATHOS_CONFIG.ownerUserId}}})},rpc:async(name,args)=>{if(name==='pathos_replace_my_archive'){window.testCloud=JSON.parse(JSON.stringify(args.p_archive));return{};}return{data:window.testCloud};}}}`;
let browser;
async function backup(page){
  const waiting=page.waitForEvent('download');
  await page.evaluate(()=>document.getElementById('backupBtn').click());
  const chunks=[];
  for await(const chunk of await(await waiting).createReadStream())chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function restore(page,value){
  await page.locator('#restoreInput').setInputFiles({name:'preview.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  await page.waitForFunction(()=>!document.getElementById('restoreInput').value&&pendingWrites===0&&!archiveBusy);
}
(async()=>{
  browser=await chromium.launch({headless:true,channel:process.env.PATHOS_BROWSER||'msedge'});
  const screenshots=await fs.mkdtemp(path.join(os.tmpdir(),'pathos-preview-details-'));
  for(const variant of ['personal','hosted']){
    const context=await browser.newContext({acceptDownloads:true});
    await context.addInitScript(()=>window.testCloud={schemaVersion:6,works:[],experiences:[]});
    await context.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js'))return route.fulfill({contentType:'text/javascript',body:moduleSource});
      return url.startsWith(target.origin)||url.startsWith('data:')?route.continue():route.abort();
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(target.origin+(variant==='personal'?'/pathos-personal/index.html':'/pathos/app.html'));
    await page.waitForFunction(()=>window.pathosCanEdit);
    await checkNavigation(page,process.env.PATHOS_UI_SCREENSHOTS);
    if(variant==='personal'){
      await page.evaluate(()=>navigator.serviceWorker.ready);
      await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
      assert((await page.evaluate(()=>caches.keys())).includes('pathos-personal-shell-v14'));
    }
    assert.equal(await page.locator('#reviews,[data-view="reviews"]').count(),0);
    await page.locator('[data-view="timeline"].tab').click();
    assert(await page.locator('#timeline').isVisible());
    await checkCoverAccents(page);
    await checkEntryDetails(page,{backup,restore});
    await page.locator('#addBtn').click();
    await page.locator('[name="type"]').selectOption('Film');
    await page.locator('[name="title"]').fill('Preview film');
    await page.locator('[name="viewingLanguage"]').fill('Italian');
    await page.screenshot({path:path.join(screenshots,variant+'-film-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#entryDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.screenshot({path:path.join(screenshots,variant+'-film-mobile.png')});
    assert.deepEqual(errors,[]);
    await context.close();
    console.log('PASS real '+variant+' preview: navigation, new fields, backups, private/public defaults and offline Personal');
  }
  console.log('Screenshots: '+screenshots);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>browser?.close());
