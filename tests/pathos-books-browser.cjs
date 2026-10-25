// Real app assets, synthetic public catalogues and isolated archives only.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright');
const {checkBookProfile,checkIsbnFallback}=require('./pathos-book-profile.cjs');
async function backup(page){const waiting=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('backupBtn').click());const chunks=[];for await(const chunk of await(await waiting).createReadStream())chunks.push(chunk);return JSON.parse(Buffer.concat(chunks))}
async function restore(page,value){await page.locator('#restoreInput').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});await page.waitForFunction(()=>!document.getElementById('restoreInput').value&&(typeof pendingWrites==='undefined'||pendingWrites===0)&&!archiveBusy)}
const root=path.resolve(__dirname,'../public'),key='synthetic-google-books-key',isbn='9780140328721';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6v7sAAAAASUVORK5CYII=','base64');
const cover='data:image/png;base64,'+pixel.toString('base64');
const google={id:'google_1',volumeInfo:{title:'A shared title',authors:['Author One'],publisher:'Puffin',publishedDate:'1988',language:'en',industryIdentifiers:[{identifier:isbn}],imageLinks:{thumbnail:'https://books.google.com/books/content?id=google_1'}}};
const edition={key:'/books/OL1M',title:'A shared title',isbn_13:[isbn],publishers:['Puffin'],languages:[{key:'/languages/eng'}],publish_date:'1988',covers:[1]};
const translated={key:'/books/OL201M',title:'Il titolo italiano',publishers:['Einaudi'],languages:[{key:'/languages/ita'}],publish_date:'2001'};
const moduleSource=`export function createClient(){return{auth:{getUser:async()=>({data:{user:{id:window.PATHOS_CONFIG.ownerUserId}}}),getSession:async()=>({data:{session:{access_token:'synthetic-owner-access-token'}}})},rpc:async(name,args)=>{if(name==='pathos_replace_my_archive'){sessionStorage.setItem('__syntheticCloud',JSON.stringify(args.p_archive));return{}}return{data:JSON.parse(sessionStorage.getItem('__syntheticCloud')||'null')||window.__cloud}}}}`;
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;if(!/^\/(pathos|pathos-personal)\/(fonts\/)?[a-z0-9.-]+$/i.test(pathname))throw Error();const body=await fs.readFile(path.join(root,pathname));res.writeHead(200,{'Content-Type':pathname.endsWith('.html')?'text/html':pathname.endsWith('.png')?'image/png':pathname.endsWith('.woff2')?'font/woff2':pathname.endsWith('.webmanifest')?'application/manifest+json':pathname.endsWith('.css')?'text/css':'text/javascript','Cache-Control':'no-store'}).end(body)}catch{res.writeHead(404).end()}});
let origin,browser;
(async()=>{
 if(process.env.PATHOS_BOOKS_PREVIEW){const target=new URL(process.env.PATHOS_BOOKS_PREVIEW);assert.match(target.hostname,/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/);origin=target.origin}else{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port}
 browser=await chromium.launch({channel:process.env.PATHOS_BROWSER||'msedge',headless:true});
 for(const variant of ['personal','hosted']){
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:1180,height:850},locale:'it-IT'}),calls=[],errors=[];let staleRelease;
  await context.addInitScript(()=>window.__cloud={schemaVersion:6,works:[],experiences:[]});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.includes('@supabase/'))return route.fulfill({contentType:'text/javascript',body:moduleSource});
   if(url.origin===origin)return route.continue();
   if(['covers.openlibrary.org','books.google.com'].includes(url.hostname))return route.fulfill({contentType:'image/png',body:pixel});
   if(['openlibrary.org','www.googleapis.com'].includes(url.hostname)){
    calls.push(url.href);assert(!url.href.includes('private review')&&!url.href.includes('synthetic-owner-access-token'));
    if(url.pathname.includes('/OL999W/editions')){await new Promise(resolve=>staleRelease=resolve);return route.fulfill({json:{entries:[translated]}}).catch(()=>{})}
    if(url.hostname==='www.googleapis.com'){assert.equal(url.searchParams.get('key'),key);return route.fulfill({json:{totalItems:1,items:[google,{...google,id:'wrong',volumeInfo:{title:'Unrelated volume',industryIdentifiers:[{identifier:'9788806223387'}]}}]}})}
    if(url.pathname.startsWith('/isbn/'))return route.fulfill({json:{...edition,works:[{key:'/works/OL1W'}]}});
    if(url.pathname.endsWith('/editions.json'))return route.fulfill({json:{size:101,entries:url.searchParams.get('offset')==='100'?[translated]:Array.from({length:100},(_,i)=>({...edition,key:'/books/OL'+(i+1)+'M',isbn_13:[],publishers:['Publisher '+i]}))}});
    if(url.pathname==='/search.json'){
     const q=url.searchParams.get('q')||'';
     if(q.startsWith('key:'))return route.fulfill({json:{docs:[{key:'/works/OL1W',editions:{docs:[{...translated,language:['ita'],publisher:['Einaudi']}]}}]}});
     return route.fulfill({json:{numFound:21,docs:url.searchParams.get('offset')==='20'?[{key:'/works/OL3W',title:'A later result',author_name:['Author Three']}]:[{key:'/works/OL1W',title:'A shared title',author_name:['Author One'],cover_i:1},{key:'/works/OL2W',title:'A shared title',author_name:['Author Two'],cover_i:2}]}});
    }
   }
   return route.abort();
  });
  await context.route('**/api/pathos/catalogue',async route=>{
   const body=route.request().postDataJSON();assert.equal(route.request().headers()['x-pathos-google-books'],key);assert.equal(route.request().headers().authorization,'Bearer synthetic-owner-access-token');
   const item={provider:'googlebooks',id:'google_1',type:'Book',title:'A shared title',creator:'Author One',year:'',cover:'https://books.google.com/books/content?id=google_1',genres:['Fiction'],description:'A catalogue description.',sourceUrl:'https://books.google.com/books?id=google_1',suggestedEdition:{isbn,publisher:'Puffin',publishYear:'1988',language:'en',googleBooksId:'google_1',source:'Google Books'}};
   if(body.action==='detail'){assert.equal(body.provider,'googlebooks');return route.fulfill({json:{item}})}
   return route.fulfill({json:{items:[item],nextPage:null}});
  });
  await context.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='[data-netlify-deploy-id]{display:none!important}';document.head.append(style)}));
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(origin+(variant==='personal'?'/pathos-personal/index.html':'/pathos/app.html'));await page.waitForFunction(()=>window.pathosCanEdit);
  await checkBookProfile(page,{backup,restore,outputDirectory:process.env.PATHOS_UI_SCREENSHOTS});
  await checkIsbnFallback(page,{backup,restore});
  const field=name=>page.locator('#entryForm [name="'+name+'"]');
  await page.locator('#addBtn').click();await field('title').fill('A shared title');await page.evaluate(()=>runCatalogSearch());
  assert.equal(await page.locator('#catalogResults [data-cat]').count(),2,'Same title by different authors remains selectable');assert(!calls.some(url=>url.includes('googleapis')));
  await page.locator('#catalogResults').getByRole('button',{name:'More results',exact:true}).click();await page.locator('#catalogResults').getByText('A later result',{exact:true}).waitFor();
  await page.locator('#catalogResults [data-cat]').first().click();await page.waitForFunction(()=>document.getElementById('editionCurrent').textContent.includes('editions loaded'));
  assert.equal(await field('cover').inputValue(),'');assert.equal(await field('editionCover').inputValue(),'');assert.equal(await field('editionOlid').inputValue(),'');
  await page.locator('#bookEditionDetails>summary').click();
  await page.locator('#editionSearch').fill('OL201M');await page.locator('#editionResults').getByRole('button',{name:'Load more editions',exact:true}).click();await page.locator('#editionResults').getByText('Il titolo italiano',{exact:true}).waitFor();
  assert.equal(await field('editionOlid').inputValue(),'','Loading results does not select an edition');
  await page.locator('#editionResults [data-ed]').click();assert.equal(await field('editionPublisher').inputValue(),'Einaudi');
  await page.locator('#editionSearch').fill('');await page.locator('#editionLanguageFilter').fill('Italian');await page.locator('#editionPublisherFilter').fill('Einaudi');await page.locator('#editionLookupBtn').click();await page.locator('#editionResults').getByText('Il titolo italiano',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.getElementById('editionLookupBtn').disabled);
  assert(calls.some(raw=>new URL(raw).searchParams.get('q')?.includes('language:ita publisher:"Einaudi"')));
  await page.locator('#cancelBtn').click();
  await page.evaluate(()=>showView('metadata'));await page.locator('#googleBooksKeyInput').fill(key);await page.locator('#saveGoogleBooksBtn').click();assert.match(await page.locator('#googleBooksKeyStatus').innerText(),/enabled/);
  await page.locator('#addBtn').click();await field('title').fill('A shared title');await page.evaluate(()=>runCatalogSearch());assert.equal(await page.locator('#catalogResults [data-cat]').count(),4);
  await page.locator('#catalogResults [data-cat]').filter({hasText:'Google Books'}).first().click();await page.locator('#bookEditionDetails>summary').click();
  assert.equal(await field('editionIsbn').inputValue(),'');assert.equal(await field('cover').inputValue(),'');await page.locator('#editionResults [data-ed]').click();
  assert.equal(await field('editionGoogleBooksId').inputValue(),'google_1');assert.equal(await field('editionYear').inputValue(),'1988');
  await field('editionCover').fill(cover);await field('editionSeries').fill('Manual series');await field('editionSeriesNumber').fill('15');await field('editionLanguage').fill('French');
  await page.locator('#editionSearch').fill(isbn);await page.locator('#editionLookupBtn').click();await page.waitForFunction(()=>document.getElementById('editionCurrent').textContent==='Select the edition matching your copy.');
  assert.equal(await page.locator('#editionResults [data-ed]').count(),1,'Equivalent ISBN-10/13 source records merge; unrelated volumes are omitted');assert.equal(await field('editionCover').inputValue(),cover,'Lookup preserves a manually entered cover until a result is chosen');assert.equal(await field('editionSeries').inputValue(),'Manual series');
  assert.equal(await field('editionLanguage').inputValue(),'French','Exact lookup does not clear the consolidated recorded language before a result is chosen');
  await page.locator('#entryForm button[type="submit"]').click();await page.evaluate(()=>saveDb());
  const recorded=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));assert.equal(recorded.experiences.length,1);assert.equal(recorded.experiences[0].edition.googleBooksId,'google_1');assert.equal(recorded.experiences[0].edition.seriesNumber,'15');
  const download=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('backupBtn').click());const chunks=[];for await(const chunk of await(await download).createReadStream())chunks.push(chunk);const exported=JSON.parse(Buffer.concat(chunks));assert(!JSON.stringify(exported).includes(key));assert.deepEqual(exported.experiences,recorded.experiences);
  await page.reload();await page.waitForFunction(()=>window.pathosCanEdit);assert.deepEqual(await page.evaluate(()=>db.experiences),recorded.experiences);
  await page.locator('#addBtn').click();await page.evaluate(()=>{void loadEditionsForWork('/works/OL999W')});while(!staleRelease)await new Promise(resolve=>setTimeout(resolve,10));await page.locator('#cancelBtn').click();await page.locator('#addBtn').click();staleRelease();await page.evaluate(()=>Promise.resolve());assert.equal(await field('editionPublisher').inputValue(),'');assert.equal(await page.locator('#editionResults').isVisible(),false);await page.locator('#cancelBtn').click();
  if(variant==='personal'){
   await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
   assert(await page.evaluate(async()=>!!await(await caches.open('pathos-personal-shell-v23')).match('/pathos-personal/book-catalogue.mjs')));
   await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);assert.deepEqual(await page.evaluate(()=>db.experiences),recorded.experiences);await context.setOffline(false);
  }else{
   await page.locator('#discoverBtn').click();await page.locator('#discoveryQuery').fill('Google book');await page.locator('#discoveryForm button').click();await page.locator('.discover-result').click();await page.locator('.discover-preview a.source-link').waitFor();assert.equal(await page.locator('.discover-preview a.source-link').innerText(),'Google Books ↗');await page.locator('#discoveryPreview').getByRole('button',{name:'Log experience',exact:true}).click();assert.equal(await field('editionGoogleBooksId').inputValue(),'google_1','Existing work retains its recorded edition');await page.locator('#cancelBtn').click();
  }
  await page.locator('#addBtn').click();await page.locator('#bookEditionDetails>summary').click();await page.locator('#editionSearch').fill(isbn);await page.locator('#editionLookupBtn').click();await page.locator('#editionResults [data-ed]').waitFor();
  for(const width of [1180,390,320]){await page.setViewportSize({width,height:850});assert(await page.locator('#entryDialog').evaluate(node=>node.scrollWidth<=node.clientWidth));}
  await page.locator('#editionSearch').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.PATHOS_UI_SCREENSHOTS||os.tmpdir(),'pathos-books-'+variant+'-mobile.png')});assert.deepEqual(errors,[]);await context.close();
  console.log('PASS '+variant+': book title/edition pagination, Italian publisher filter, Google/ISBN choice, exact-cover preservation, stale cancellation, metadata round trip and mobile fit');
 }
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server.close()});
