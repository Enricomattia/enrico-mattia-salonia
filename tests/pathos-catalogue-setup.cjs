/* Real Personal UI and service worker; isolated storage and synthetic credentials. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../public');
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!/^\/pathos-personal\/(fonts\/)?[a-z0-9.-]+$/i.test(pathname)){res.writeHead(404).end();return;}
    const body=await fs.readFile(path.join(root,pathname));
    const type=pathname.endsWith('.html')?'text/html':/\.m?js$/.test(pathname)?'text/javascript':pathname.endsWith('.css')?'text/css':pathname.endsWith('.woff2')?'font/woff2':pathname.endsWith('.png')?'image/png':'application/manifest+json';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(body);
  }catch{res.writeHead(404).end();}
});
let browser,origin;
(async()=>{
  if(process.env.PATHOS_CATALOGUE_PREVIEW){
    const target=new URL(process.env.PATHOS_CATALOGUE_PREVIEW);
    assert.match(target.hostname,/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/);origin=target.origin;
  }else{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;}
  const output=process.env.PATHOS_UI_SCREENSHOTS||path.resolve(__dirname,'../output/pathos-catalogue-guide');
  await fs.mkdir(output,{recursive:true});
  browser=await chromium.launch({headless:true,channel:process.env.PATHOS_BROWSER||'msedge'});
  const context=await browser.newContext({viewport:{width:1180,height:850},acceptDownloads:true});
  const calls=[],errors=[];
  let responseStatus=200,delay=false,release;
  const key='synthetic-google-books-key',token='synthetic-tmdb-read-access-token';
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin||url.protocol==='data:')return route.continue();
    if(['openlibrary.org','www.googleapis.com','api.themoviedb.org'].includes(url.hostname)){
      calls.push({url:url.href,headers:request.headers()});
      assert(!url.href.includes('unfinished+review')&&!String(request.postData()).includes('unfinished review'));
      if(url.pathname==='/3/configuration'||url.hostname!=='api.themoviedb.org')assert(!url.href.includes('private'),'Connection tests only send the fixed public sample');
      if(delay)await new Promise(resolve=>release=resolve);
      return route.fulfill({status:responseStatus,json:{items:[],docs:[]}}).catch(()=>{});
    }
    return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/pathos-personal/index.html');
  await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosCatalogues);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const original=await page.evaluate(()=>JSON.stringify(db));
  const disk=await page.evaluate(()=>readLocalArchive());
  const testButton=provider=>page.locator('[data-test-catalogue="'+provider+'"]');
  const testStatus=provider=>page.locator('#'+provider+'TestStatus');
  const open=async provider=>{await page.locator('#settingsMenu>summary').click();await page.locator('#settingsMenu [data-view="metadata"]').click();await page.locator('.catalogue-source[data-catalogue-guide="'+provider+'"]').click();};
  const test=async(provider,status=200)=>{
    responseStatus=status;await testButton(provider).click();
    await page.waitForFunction(provider=>document.getElementById(provider+'TestStatus').textContent&&!document.querySelector('[data-test-catalogue="'+provider+'"]').disabled,provider);
  };
  assert(await page.locator('#catalogueIntro').isVisible());
  await page.screenshot({path:path.join(output,'first-visit-desktop.png'),fullPage:true});
  await page.locator('#catalogueIntroLater').click();await page.reload();
  await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosCatalogues);
  assert.equal(await page.locator('#catalogueIntro').isVisible(),false,'Later stays dismissed after reload');
  await open('openlibrary');
  await test('openlibrary');assert.match(await testStatus('openlibrary').innerText(),/Connection works/);
  assert.equal(calls.length,1);assert.equal(calls[0].headers.authorization,undefined);
  assert.equal(new URL(calls[0].url).searchParams.get('q'),'isbn:9780140328721');
  await page.locator('#catalogue-googlebooks>summary').click();
  await testButton('googlebooks').click();assert.match(await testStatus('googlebooks').innerText(),/Paste/);assert.equal(calls.length,1);
  await page.locator('#googleBooksKeyInput').fill('bad');await testButton('googlebooks').click();assert.match(await testStatus('googlebooks').innerText(),/Check/);
  await page.locator('#googleBooksKeyInput').fill(key);await test('googlebooks');
  assert.match(await testStatus('googlebooks').innerText(),/Save this credential/);
  assert.equal(await page.evaluate(()=>googleBooksKey()),'','Testing never saves a credential');
  const googleCall=calls.at(-1);assert.equal(new URL(googleCall.url).searchParams.get('key'),key);assert.equal(googleCall.headers.authorization,undefined);
  await page.locator('#saveGoogleBooksBtn').click();assert.equal(await page.evaluate(()=>googleBooksKey()),key);
  await test('googlebooks',403);assert.match(await testStatus('googlebooks').innerText(),/enable Books API/);
  await page.locator('#googleBooksKeyInput').fill(key+'-edited');assert.equal(await testStatus('googlebooks').innerText(),'','Editing clears stale results');
  await page.locator('#catalogueGuideDone').click();
  await page.locator('#addBtn').click();await page.locator('#entryForm [name="type"]').selectOption('Film');
  await page.locator('#titleInput').fill('private unfinished title');
  await page.locator('#entryForm [name="endDate"]').fill('2026-11-07');
  await page.locator('#entryForm [name="rating"]').fill('4.25');
  await page.getByRole('textbox',{name:'Review',exact:true}).fill('private unfinished review');
  const formSnapshot=()=>page.evaluate(()=>({fields:[...new FormData(document.getElementById('entryForm')).entries()],review:document.querySelector('.review-surface .ProseMirror').innerHTML}));
  const draft=await formSnapshot();
  assert.equal(await page.locator('#entryCatalogueSetup').innerText(),'Enable film search');
  await page.locator('#entryCatalogueSetup').click();
  assert.equal(await page.locator('#catalogue-tmdb').getAttribute('open'),'');
  assert.equal(await page.locator('#catalogueGuideDone').innerText(),'Back to entry');
  await page.locator('#tmdbTokenInput').fill('12345678901234567890123456789012');await testButton('tmdb').click();
  assert.match(await testStatus('tmdb').innerText(),/long API Read Access Token/);
  await page.locator('#tmdbTokenInput').fill(token);await test('tmdb',401);assert.match(await testStatus('tmdb').innerText(),/refused/);
  await test('tmdb',429);assert.match(await testStatus('tmdb').innerText(),/limit/);
  await test('tmdb',503);assert.match(await testStatus('tmdb').innerText(),/temporarily unavailable/);
  await test('tmdb');assert.match(await testStatus('tmdb').innerText(),/Connection works.*Save/);
  assert.equal(calls.at(-1).headers.authorization,'Bearer '+token);
  assert.equal(new URL(calls.at(-1).url).search,'');
  await page.locator('#saveTmdbBtn').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#catalogueGuide').isVisible(),false);
  assert.equal(await page.locator('#entryDialog').isVisible(),true);
  assert.deepEqual(await formSnapshot(),draft,'Setup preserves all unfinished entry fields and formatted review');
  assert.equal(await page.locator('#entryCatalogueSetup').evaluate(node=>document.activeElement===node),true,'Escape returns focus to the entry link');
  assert.match(await page.locator('#catalogHint').innerText(),/TMDB/);
  await page.locator('#entryForm [name="type"]').selectOption('Album');assert.equal(await page.locator('#entryCatalogueSetup').isVisible(),false);
  await page.locator('#entryForm [name="type"]').selectOption('TV');assert(await page.locator('#entryCatalogueSetup').isVisible());
  await page.locator('#cancelBtn').click();
  await open('tmdb');
  delay=true;responseStatus=200;await testButton('tmdb').click();await page.waitForFunction(()=>backgroundTasks>0);
  await page.locator('#tmdbTokenInput').fill(token+'-new');
  await page.waitForFunction(()=>backgroundTasks===0);assert.equal(await testStatus('tmdb').innerText(),'');
  delay=false;release?.();
  // Storage errors remain visible; the saved credential and diary are untouched.
  await page.evaluate(()=>{window.originalCatalogueSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='culturalArchive.tmdbToken')throw new DOMException('Synthetic quota failure','QuotaExceededError');return window.originalCatalogueSetItem.call(this,key,value);};});
  await page.locator('#saveTmdbBtn').click();assert.match(await page.locator('#tmdbTokenStatus').innerText(),/Could not save/);
  assert.equal(await page.evaluate(()=>tmdbToken()),token);
  await page.evaluate(()=>{Storage.prototype.setItem=window.originalCatalogueSetItem;});
  await page.locator('#catalogueGuideDone').click();
  for(const width of [1180,390,320]){
    await page.setViewportSize({width,height:844});
    await page.locator('.catalogue-source[data-catalogue-guide="googlebooks"]').click();
    assert(await page.locator('#catalogueGuide').evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth+1));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(output,'google-books-'+width+'.png'),fullPage:true});
    await page.keyboard.press('Escape');
  }
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosCatalogues);
  await open('tmdb');assert.equal(await page.locator('#tmdbTokenInput').inputValue(),token);
  const count=calls.length;await testButton('tmdb').click();assert.match(await testStatus('tmdb').innerText(),/internet/);assert.equal(calls.length,count);
  const caches=await page.evaluate(async()=>{const names=await window.caches.keys(),cache=await window.caches.open(names.find(name=>name.startsWith('pathos-personal-shell-')));return(await cache.keys()).map(request=>new URL(request.url).pathname);});
  for(const name of ['catalogue-setup.css','catalogue-setup.js'])assert(caches.includes('/pathos-personal/'+name));
  await page.locator('#tmdbTokenInput').fill('');await page.locator('#saveTmdbBtn').click();assert.equal(await page.evaluate(()=>tmdbToken()),'');
  await page.locator('#catalogue-googlebooks>summary').click();await page.locator('#googleBooksKeyInput').fill('');await page.locator('#saveGoogleBooksBtn').click();
  await page.locator('#catalogueGuideDone').click();
  const download=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('backupBtn').click());
  const chunks=[];for await(const chunk of await(await download).createReadStream())chunks.push(chunk);
  const exported=Buffer.concat(chunks).toString();assert(!exported.includes(key)&&!exported.includes(token));
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),original,'Tutorial and tests never mutate the archive');
  assert.deepEqual(await page.evaluate(()=>readLocalArchive()),disk,'Tutorial never writes IndexedDB');
  assert.deepEqual(errors,[]);
  console.log('PASS catalogue discovery, setup, draft preservation, test isolation, failures, cancellation, saved credentials, mobile and offline shell');
  console.log('Screenshots: '+output);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
