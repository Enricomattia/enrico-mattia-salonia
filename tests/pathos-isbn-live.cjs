// Opt-in normal live Hoepli lookup through a local build or PR preview. Personal only.
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const target=new URL(process.env.PATHOS_SITE_URL||'http://127.0.0.1:3118');
assert(target.hostname==='127.0.0.1'||target.hostname==='localhost'||/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/.test(target.hostname));
const isbn='9788811361190';let browser;
(async()=>{
 browser=await chromium.launch({headless:true,channel:process.env.PATHOS_BROWSER||'msedge'});const context=await browser.newContext({acceptDownloads:true}),calls=[];
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===target.origin){if(url.pathname==='/api/pathos/isbn-fallback')calls.push(route.request().postDataJSON());return route.continue()}if(url.hostname==='openlibrary.org')return url.pathname==='/search.json'?route.fulfill({json:{docs:[]}}):route.fulfill({status:404,json:{}});return route.abort()});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(target.origin+'/pathos-personal/index.html');await page.waitForFunction(()=>window.pathosPersonalReady);assert.equal(await page.evaluate(()=>db.works.length),0);
 const field=name=>page.locator('#entryForm [name="'+name+'"]');await page.locator('#addBtn').click();await field('title').fill(isbn);await page.evaluate(()=>runCatalogSearch());await page.locator('#catalogResults [data-cat]').filter({hasText:'Hoepli'}).click();await page.locator('#bookEditionDetails>summary').click();await page.locator('#editionResults [data-ed]').click();assert.equal(await field('editionIsbn').inputValue(),isbn);assert.equal(await field('editionPublisher').inputValue(),'Garzanti');assert.equal(await field('editionPages').inputValue(),'LIII + 87');
 await page.locator('#entryForm button[type="submit"]').click();await page.waitForFunction(()=>pendingWrites===0&&!archiveBusy);const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));assert.equal(saved.experiences[0].edition.printing,'18ª');assert.equal(saved.experiences[0].edition.source,'Hoepli');assert.deepEqual(calls,[{isbn}]);
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);assert.deepEqual(await page.evaluate(()=>db.experiences),saved.experiences);assert.deepEqual(errors,[]);
 console.log('PASS real ISBN fallback → select Garzanti edition → isolated Personal save → offline reload: '+target.origin);
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>browser?.close());
