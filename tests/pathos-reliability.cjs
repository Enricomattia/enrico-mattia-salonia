/* Browser regression tests. Uses synthetic archives and an isolated local origin.
 * npm run test:pathos (Edge by default; PATHOS_BROWSER=chrome or chromium).
 * Optional PATHOS_UPDATE_BASELINE_REF tests an older checked-in PWA release.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fsp=require('node:fs/promises');
const http=require('node:http');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {checkTimeline}=require('./pathos-timeline.cjs');
const {checkEntryDetails}=require('./pathos-entry-details.cjs');
const {checkCoverAccents}=require('./pathos-cover-accent.cjs');
const {checkNavigation,navigatePage}=require('./pathos-navigation.cjs');
const {checkPreferences}=require('./pathos-preferences.cjs');
const {checkEntryImprovements}=require('./pathos-entry-improvements.cjs');
const {checkEntryRecall}=require('./pathos-entry-recall.cjs');
const {checkGenreVocabulary}=require('./pathos-genres.cjs');
const root=path.resolve(__dirname,'..');
const publicRoot=path.join(root,'public');
const launch={headless:true,...(process.env.PATHOS_BROWSER==='chromium'?{}:{channel:process.env.PATHOS_BROWSER||'msedge'})};
let release='current';
const copy=x=>JSON.parse(JSON.stringify(x));
const pixel='data:image/png;base64,'+fs.readFileSync(path.join(publicRoot,'pathos-personal/icon-192.png')).toString('base64');
const fixture={schemaVersion:6,works:[{id:'book-1',title:'Synthetic book',type:'Book',creator:'Test author',cover:pixel,aliases:[],liked:true,owned:true,genres:['Classics'],external:{isbn:'9780140328721'},sourceMetadata:{}}],experiences:[{id:'reading-1',workId:'book-1',startDate:'2026-10-01',endDate:'2026-10-01',status:'completed',rating:4.5,review:'A review\nwith paragraphs.',moods:['reflective'],pace:'slow',quotes:[{id:'quote-1',text:'A saved passage',note:'p. 12',featured:true}],tags:['test'],isPublic:true,edition:{isbn:'9780140328721',ean:'9780140328721',identifierType:'catalogue',identifierValue:'custom-1',sourceId:'storygraph-test-uid',publisher:'Manual publisher',publishYear:'2020',language:'Italian',format:'Paperback',pages:'123',printing:'2ª',contributors:'Test translator',cover:pixel,source:'manual'}}]};
const baseline={};
if(process.env.PATHOS_UPDATE_BASELINE_REF){
  for(const name of ['index.html','sw.js','cover-accent.mjs','book-catalogue.mjs']){
    try{baseline[name]=execFileSync('git',['show',process.env.PATHOS_UPDATE_BASELINE_REF+':public/pathos-personal/'+name],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});}
    catch(error){if(!['cover-accent.mjs','book-catalogue.mjs'].includes(name))throw error;}
  }
}
const server=http.createServer(async(req,res)=>{
  try{
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(!/^\/(pathos|pathos-personal)\/(fonts\/)?[a-z0-9.-]+$/i.test(pathname)){res.writeHead(404).end();return;}
    const name=path.basename(pathname);
    let bytes=await fsp.readFile(path.join(publicRoot,pathname));
    if(pathname.startsWith('/pathos-personal/')&&['index.html','sw.js','cover-accent.mjs','book-catalogue.mjs'].includes(name)){
      let source=release==='before'&&baseline[name]?baseline[name]:bytes.toString();
      if(name==='sw.js'&&!(release==='before'&&baseline[name]))source=source.replace(/pathos-personal-shell-v\d+/g,'pathos-personal-shell-test-'+release);
      if(name==='index.html')source=source.replace('</head>','<meta name="pathos-test-release" content="'+release+'"></head>');
      bytes=Buffer.from(source);
    }
    const type=name.endsWith('.html')?'text/html':/\.m?js$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.png')?'image/png':name.endsWith('.woff2')?'font/woff2':'application/manifest+json';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
let origin,browser,temporary;
const persistentContexts=[];
const errors=[];
async function observe(page){
  page.dialogs=[];page.confirmRestore=true;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async dialog=>{
    page.dialogs.push(dialog.message());
    if(dialog.type()==='confirm'&&!page.confirmRestore)await dialog.dismiss();else await dialog.accept();
  });
  return page;
}
async function context(){
  const ctx=await browser.newContext({acceptDownloads:true});
  await ctx.route('**/*',route=>route.request().url().startsWith(origin)||route.request().url().startsWith('data:')?route.continue():route.abort());
  return ctx;
}
async function personal(ctx){
  const page=await observe(await ctx.newPage());
  await page.goto(origin+'/pathos-personal/index.html');
  await page.waitForFunction(()=>window.pathosPersonalReady);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  return page;
}
async function saved(page){await page.waitForFunction(()=>pendingWrites===0&&!archiveBusy);}
async function archive(page){return page.evaluate(()=>JSON.parse(JSON.stringify(db)));}
async function disk(page){return page.evaluate(()=>readLocalArchive());}
async function restore(page,value){
  await page.locator('#restoreInput').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});
  await page.waitForFunction(()=>!document.getElementById('restoreInput').value);
  await saved(page);
}
async function backup(page){
  const download=page.waitForEvent('download');
  await page.evaluate(()=>document.getElementById('backupBtn').click());
  const chunks=[];for await(const chunk of await(await download).createReadStream())chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
async function run(name,fn){await fn();console.log('PASS '+name);}
async function checkArchiveViews(page){
  await checkNavigation(page,process.env.PATHOS_UI_SCREENSHOTS);
  await checkCoverAccents(page);
  const before=await archive(page);
  await page.evaluate(value=>{db=value;renderAll();showView('home');},fixture);
  await page.evaluate(()=>{insightPeriod='all';renderInsights();});
  assert.equal(await page.locator('#insightStats .insight-stat').nth(2).locator('strong').textContent(),'1');
  await page.evaluate(()=>{insightPeriod=null;renderInsights();});
  assert.equal(await page.locator('#homeLatestReviews').count(),0);
  assert.equal(await page.locator('#home').getByText('Recent reviews',{exact:true}).count(),0);
  await page.evaluate(()=>showView('library'));
  assert.equal((await page.locator('#libraryGrid').innerText()).includes('1 experience'),false);
  await page.locator('.work-card[data-work="book-1"]').click();
  assert.equal(await page.locator('#workDialogBody .experience-review').count(),1);
  assert.equal(await page.locator('#workDialogBody .work-summary-review,#workDialogBody .work-metrics').count(),0);
  assert.equal((await page.locator('#workDialogBody').innerText()).includes('LATEST REVIEW'),false);
  await page.locator('#closeWorkDialog').click();
  assert.equal(await page.locator('#reviews,[data-view="reviews"]').count(),0);
  assert.equal(await page.locator('[data-view="timeline"]').count(),0);
  await page.evaluate(()=>showView('timeline'));
  assert(await page.locator('#home').isVisible(),'The former Timeline route opens the Home diary');
  await navigatePage(page,'passages');
  assert.equal(await page.locator('#passagesList .passage-card').count(),1);
  const repeated=copy(fixture);
  repeated.experiences.push({...copy(repeated.experiences[0]),id:'reading-2',endDate:'2026-10-14',rating:3,repeat:true,review:'Second reading review',edition:{...repeated.experiences[0].edition,cover:pixel+'#second-edition'}});
  await page.evaluate(value=>{db=value;renderAll();},repeated);
  assert.equal(await page.locator('#passagesList .passage-card').count(),2);
  await page.evaluate(()=>openWork('book-1'));
  assert.equal(await page.locator('#workDialogBody .experience-review').count(),2);
  assert.equal(await page.locator('#workDialogBody .experience-review').first().innerText(),'Second reading review');
  await page.locator('#closeWorkDialog').click();
  await page.evaluate(()=>showView('timeline'));
  assert.equal(await page.locator('#timelineList .timeline-cover img').count(),2);
  assert.equal(await page.locator('#timelineList [data-exp="reading-2"] img').getAttribute('src'),pixel+'#second-edition');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#timelineList .timeline-cover img').first().isVisible(),true);
  await page.screenshot({path:path.join(temporary,(await page.url()).includes('personal')?'personal-timeline-mobile.png':'hosted-timeline-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>showView('passages'));
  await page.screenshot({path:path.join(temporary,(await page.url()).includes('personal')?'personal-passages.png':'hosted-passages.png'),fullPage:true});
  assert.deepEqual(await archive(page),repeated,'Changing views must never rewrite records');
  await checkTimeline(page,process.env.PATHOS_UI_SCREENSHOTS||temporary);
  await page.evaluate(value=>{db=value;renderAll();showView('home');},before);
}

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
  temporary=await fsp.mkdtemp(path.join(os.tmpdir(),'pathos-tests-'));
  browser=await chromium.launch(launch);
  const ctx=await context();
  let page=await personal(ctx);
  await run('create, edit, delete and reload through the personal form',async()=>{
    assert.equal((await archive(page)).works.length,0);
    await page.locator('#addBtn').click();
    await page.locator('[name="type"]').selectOption('Film');
    await page.locator('[name="title"]').fill('Synthetic film');
    await page.locator('[name="endDate"]').fill('2026-10-14');
    await page.locator('[name="viewingLanguage"]').fill('Italian');
    await page.locator('#entryForm button[type="submit"]').click();await saved(page);
    let data=await archive(page);assert.equal(data.experiences.length,1);
    const id=data.experiences[0].id;
    assert.equal(data.experiences[0].viewingLanguage,'Italian');
    await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
    await page.evaluate(id=>openExperience(id),id);
    assert.equal(await page.locator('#entryDialog').evaluate(el=>el.open),true);
    await page.locator('[name="review"]').fill('Edited review');
    await page.locator('#entryForm button[type="submit"]').click();await saved(page);
    assert.equal((await disk(page)).experiences[0].review,'Edited review');
    await page.evaluate(id=>openExperience(id),id);
    await page.locator('#deleteBtn').click();await saved(page);
    assert.equal((await disk(page)).experiences.length,0);
  });
  await run('movie language, edition series, repeat isolation, round trip and offline reload',()=>checkEntryDetails(page,{backup,restore}));
  await run('favourite shelf, book ownership, single language field, quiet insights and clean reading pages',()=>checkPreferences(page,{backup,restore,outputDirectory:process.env.PATHOS_UI_SCREENSHOTS}));
  await run('shared tag/mood vocabulary, exact filters, statistics, universal uploads and offline backup continuity',()=>checkEntryImprovements(page,{backup,restore}));
  await run('quiet edition/venue cards, automatic book completion, saved detail suggestions and filtered statistics',()=>checkEntryRecall(page,{backup,restore,outputDirectory:process.env.PATHOS_UI_SCREENSHOTS}));
  await run('saved genres, shared starter terms, punctuation, empty archives and offline continuity',()=>checkGenreVocabulary(page,{backup,restore,outputDirectory:process.env.PATHOS_UI_SCREENSHOTS}));
  await run('restore/export round trip, preserved edition and passage IDs, cancellation and durable undo',async()=>{
    await restore(page,fixture);assert.deepEqual((await archive(page)).experiences,fixture.experiences);
    const exported=await backup(page);assert.deepEqual(exported.experiences,fixture.experiences);
    const replacement={schemaVersion:6,works:[],experiences:[]};
    page.confirmRestore=false;await restore(page,replacement);page.confirmRestore=true;
    assert.equal((await disk(page)).works.length,1);
    await restore(page,replacement);assert.equal((await disk(page)).works.length,0);
    await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
    assert.equal(await page.locator('#undoRestoreBtn').evaluate(el=>el.hidden),false);
    await page.evaluate(()=>document.getElementById('undoRestoreBtn').click());await saved(page);
    await page.waitForFunction(()=>db.works.length===1);
    assert.deepEqual((await disk(page)).experiences,fixture.experiences);
    await page.evaluate(()=>openExperience('reading-1'));
    await page.locator('#entryForm button[type="submit"]').click();await saved(page);
    const edited=(await archive(page)).experiences[0];
    assert.equal(edited.edition.contributors,'Test translator');assert.equal(edited.edition.cover,pixel);
    assert.equal(edited.isPublic,true);assert.equal(edited.quotes[0].id,'quote-1');
  });
  await run('malformed, duplicate, dangling-reference and future-schema restores do not touch disk or recovery',async()=>{
    const before=await disk(page),recovery=await page.evaluate(()=>readLocalArchive('before-restore'));
    const duplicate=copy(fixture);duplicate.works.push(copy(duplicate.works[0]));
    const missing=copy(fixture);missing.experiences[0].workId='missing';
    const badPassage=copy(fixture);badPassage.experiences[0].quotes=[{text:42}];
    const badEdition=copy(fixture);badEdition.experiences[0].edition.cover={url:'invalid'};
    const badSeries=copy(fixture);badSeries.experiences[0].edition.series=['invalid'];
    const badLanguage=copy(fixture);badLanguage.experiences[0].viewingLanguage={invalid:true};
    const duplicatePassage=copy(fixture);duplicatePassage.experiences[0].quotes.push(copy(duplicatePassage.experiences[0].quotes[0]));
    for(const value of ['{bad json',duplicate,missing,badPassage,badEdition,badSeries,badLanguage,duplicatePassage,{...fixture,schemaVersion:99}]){
      await restore(page,value);assert.deepEqual(await disk(page),before);
      assert.deepEqual(await page.evaluate(()=>readLocalArchive('before-restore')),recovery);
    }
  });
  await run('aborted restore rolls back both archive and recovery copy',async()=>{
    const before=await disk(page),recovery=await page.evaluate(()=>readLocalArchive('before-restore'));
    await page.evaluate(()=>{
      window.originalPut=IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put=function(value,key){const result=window.originalPut.call(this,value,key);if(key==='personal')this.transaction.abort();return result;};
    });
    await restore(page,{schemaVersion:6,works:[],experiences:[]});
    assert.deepEqual(await disk(page),before);
    assert.deepEqual(await page.evaluate(()=>readLocalArchive('before-restore')),recovery);
    assert.deepEqual(await archive(page),before);
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;return saveDb();});
  });
  await run('failed writes retain exportable memory; later successful saves clear the failure',async()=>{
    const before=await disk(page);
    await page.evaluate(()=>{window.originalWrite=writeLocalArchive;writeLocalArchive=()=>Promise.reject(new Error('Simulated quota failure'));db.experiences[0].review='Unsaved recovery review';return saveDb();});
    assert.deepEqual(await disk(page),before);
    assert.equal((await backup(page)).experiences[0].review,'Unsaved recovery review');
    await restore(page,{schemaVersion:6,works:[],experiences:[]});
    assert.equal((await archive(page)).experiences[0].review,'Unsaved recovery review');
    await page.evaluate(()=>{writeLocalArchive=window.originalWrite;return saveDb();});
    assert.equal(await page.evaluate(()=>lastSaveFailed),false);
    assert.equal((await disk(page)).experiences[0].review,'Unsaved recovery review');
  });
  await run('stale and simultaneous windows cannot overwrite each other',async()=>{
    const peer=await personal(ctx);
    assert.equal(await page.evaluate(()=>{db.experiences[0].review='First window';return saveDb();}),true);
    assert.equal(await peer.evaluate(()=>{db.experiences[0].review='Stale window';return saveDb();}),false);
    assert.equal((await disk(peer)).experiences[0].review,'First window');
    assert.equal((await backup(peer)).experiences[0].review,'Stale window');
    await peer.close();
    const other=await personal(ctx);
    const writes=await Promise.all([page.evaluate(()=>{db.experiences[0].review='Concurrent A';return saveDb();}),other.evaluate(()=>{db.experiences[0].review='Concurrent B';return saveDb();})]);
    assert.equal(writes.filter(Boolean).length,1);
    await other.close();await page.close();page=await personal(ctx);
  });
  await run('ISBN enrichment fills gaps without replacing manual edition metadata or uploaded covers',async()=>{
    await restore(page,fixture);
    await page.route('https://openlibrary.org/isbn/**',route=>route.fulfill({json:{key:'/books/OL123M',isbn_13:['9780140328721'],publishers:['Fetched publisher'],publish_date:'1990',covers:[123],works:[{key:'/works/OL123W'}]}}));
    await page.evaluate(()=>enrichBook(db.works[0]));
    const enriched=(await archive(page)).experiences[0].edition;
    assert.equal(enriched.publisher,'Manual publisher');assert.equal(enriched.sourceId,'storygraph-test-uid');
    assert.equal(enriched.cover,pixel);assert.equal(enriched.olid,'/books/OL123M');
    await page.evaluate(()=>saveDb());
  });
  await run('StoryGraph and generic CSV imports preserve the existing archive and deduplicate repeat imports',async()=>{
    const initial=(await archive(page)).experiences[0];
    const csv='Title,Authors,ISBN/UID,Format,Read Status,Star Rating,Review\nCSV book,CSV author,storygraph-csv-uid,Paperback,read,4,Imported review';
    for(let i=0;i<2;i++){
      await page.locator('#storygraphInput').setInputFiles({name:'storygraph.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
      await page.waitForFunction(()=>!document.getElementById('storygraphInput').value&&backgroundTasks===0);await saved(page);
    }
    assert.equal((await archive(page)).experiences.length,2);
    assert.deepEqual((await archive(page)).experiences[0],initial);
    assert.equal((await archive(page)).experiences[1].edition.sourceId,'storygraph-csv-uid');
    await page.locator('#genericInput').setInputFiles({name:'events.csv',mimeType:'text/csv',buffer:Buffer.from('Title,Type,EndDate,Review\nCSV concert,Concert,2026-10-14,Concert review')});
    await page.waitForFunction(()=>backgroundTasks===0&&!document.getElementById('genericInput').value);await saved(page);
    assert.equal((await disk(page)).experiences.length,3);
  });
  await run('offline reload, editing, uploaded cover and reopen',async()=>{
    await ctx.setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
    await page.evaluate(()=>openExperience('reading-1'));
    await page.locator('[name="review"]').fill('Offline edit');
    await page.locator('#entryForm button[type="submit"]').click();await saved(page);
    await page.close();page=await personal(ctx);
    assert.equal((await archive(page)).experiences[0].review,'Offline edit');
    assert.equal((await archive(page)).experiences[0].edition.cover,pixel);
    await ctx.setOffline(false);
  });
  await run('Timeline navigation, retained reviews/passages, mobile/touch and exact-edition covers',()=>checkArchiveViews(page));
  await run('official-page image suggestions preserve records until Save, protect manual covers and fail safely offline',async()=>{
    const eventUrl='https://venue.example/events/ka-in/',image1='https://images.example/production-01.png',image2='https://images.example/production-02.png';
    const event={schemaVersion:6,works:[{id:'event-work',title:'KA-IN',type:'Theatre',cover:eventUrl,creator:'Test troupe'}],experiences:[{id:'event-experience',workId:'event-work',endDate:'2026-10-14',review:'Event review',rating:4,status:'completed',sourceUrl:eventUrl,isPublic:false,quotes:[]}]};
    let mode='ok',lookups=0;
    await page.route('https://images.example/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from(pixel.split(',')[1],'base64')}));
    await page.route('**/api/pathos/page-images',async route=>{
      lookups++;
      if(mode==='blocked')return route.fulfill({status:502,json:{error:'Could not read that page. Your cover is unchanged.'}});
      if(route.request().postDataJSON().mode==='store')return route.fulfill({json:{dataUrl:pixel}});
      return route.fulfill({json:{pageUrl:eventUrl,images:[{url:image1,source:'Page image'},{url:image2,source:'Page image'}]}});
    });
    await restore(page,event);
    await page.evaluate(()=>openExperience('event-experience'));
    await page.locator('.page-image-choice').first().waitFor();
    assert.equal(await page.locator('.page-image-choice').count(),2);
    assert.equal((await archive(page)).works[0].cover,eventUrl);
    await page.locator('.page-image-choice').first().click();
    await page.waitForFunction(()=>!coverTaskBusy&&document.getElementById('entryForm').elements.cover.value.startsWith('data:image/jpeg'));
    const stored=await page.locator('[name="cover"]').inputValue();
    assert.equal((await disk(page)).works[0].cover,eventUrl);
    await page.locator('#cancelBtn').click();assert.equal((await archive(page)).works[0].cover,eventUrl);
    await page.evaluate(()=>openExperience('event-experience'));await page.locator('.page-image-choice').first().waitFor();
    await page.locator('.page-image-choice').first().click();
    await page.waitForFunction(()=>!coverTaskBusy&&document.getElementById('entryForm').elements.cover.value.startsWith('data:image/jpeg'));
    await page.locator('#entryForm button[type="submit"]').click();await saved(page);
    let data=await disk(page);assert.equal(data.experiences[0].cover,stored);assert.equal(data.works[0].cover,eventUrl,'An experience cover does not replace other experiences artwork');
    assert.equal(data.experiences[0].id,'event-experience');assert.equal(data.experiences[0].sourceUrl,eventUrl);assert.equal(data.experiences[0].review,'Event review');assert.equal(data.experiences[0].isPublic,false);
    const previousLookups=lookups;
    await page.evaluate(()=>openExperience('event-experience'));
    assert.equal(lookups,previousLookups,'Existing manual covers must not trigger automatic replacement lookup');
    await page.locator('#findPageImageBtn').click();await page.locator('.page-image-choice').first().waitFor();
    page.confirmRestore=false;await page.locator('.page-image-choice').nth(1).click();page.confirmRestore=true;
    assert.equal(await page.locator('[name="cover"]').inputValue(),stored);
    await page.locator('#cancelBtn').click();
    await page.evaluate(()=>openExperience('event-experience'));mode='blocked';
    await page.locator('#findPageImageBtn').click();await page.waitForFunction(()=>document.getElementById('pageImageStatus').textContent.includes('Could not read'));
    assert.equal(await page.locator('[name="cover"]').inputValue(),stored);
    await ctx.setOffline(true);await page.locator('#findPageImageBtn').click();
    assert.match(await page.locator('#pageImageStatus').textContent(),/needs a connection/);
    assert.equal((await archive(page)).experiences[0].cover,stored);
    await ctx.setOffline(false);await page.locator('#cancelBtn').click();
    await page.locator('#addBtn').click();assert.equal(await page.locator('#findPageImageBtn').isVisible(),false);
    await page.locator('#cancelBtn').click();
  });
  await ctx.close();

  await run('two staged releases: Later, two clients, pending/failed writes, open form, offline browser restart',async()=>{
    release='before';
    const updateFixture=copy(fixture);
    updateFixture.works[0].genres=['Fiction, general'];
    Object.assign(updateFixture.experiences[0].edition,{series:'Nuovi Coralli',seriesNumber:'15'});
    updateFixture.works.push({id:'update-film',title:'Update language test',type:'Film'});
    updateFixture.experiences.push({id:'update-watch',workId:'update-film',viewingLanguage:'Italian',venue:'Update cinema',status:'completed',rating:'',quotes:[]});
    const profile=path.join(temporary,'profile');
    let installed=await chromium.launchPersistentContext(profile,launch);persistentContexts.push(installed);
    let app=await personal(installed);
    // Seed the old release using its own persistence path; no real user data.
    await app.evaluate(value=>{db=value;saveDb();},updateFixture);
    await app.waitForFunction(()=>pendingWrites===0);
    if(baseline['cover-accent.mjs'])assert.equal(await app.evaluate(async()=>{
      const cacheName=(await caches.keys()).find(name=>name.startsWith('pathos-personal-shell-'));
      return (await(await caches.open(cacheName)).match('/pathos-personal/cover-accent.mjs')).text();
    }),baseline['cover-accent.mjs'],'The old app runs the old cached presentation module');
    const peer=await personal(installed);
    release='current';
    await app.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await app.locator('#pathosUpdateBanner').waitFor({state:'visible'});
    await app.locator('#pathosUpdateLater').click();assert.equal(await app.locator('#pathosUpdateBanner').isVisible(),false);
    assert.equal(await app.locator('meta[name="pathos-test-release"]').getAttribute('content'),'before');
    await app.reload();await app.waitForFunction(()=>window.pathosPersonalReady);
    await app.locator('#pathosUpdateBanner').waitFor({state:'visible'});
    await app.locator('#pathosUpdateNow').click();
    await app.waitForFunction(()=>document.querySelector('meta[name="pathos-test-release"]').content==='current');
    await app.waitForFunction(()=>window.pathosPersonalReady);
    assert.deepEqual((await archive(app)).experiences,updateFixture.experiences);
    assert.equal(await app.evaluate(async()=>{
      const cacheName=(await caches.keys()).find(name=>name.startsWith('pathos-personal-shell-'));
      return (await(await caches.open(cacheName)).match('/pathos-personal/cover-accent.mjs')).text();
    }),fs.readFileSync(path.join(publicRoot,'pathos-personal/cover-accent.mjs'),'utf8'),'Accepted update switches to the new cached presentation module');
    assert.equal(await app.evaluate(async()=>{
      const cacheName=(await caches.keys()).find(name=>name.startsWith('pathos-personal-shell-'));
      return(await(await caches.open(cacheName)).match('/pathos-personal/book-catalogue.mjs')).text();
    }),fs.readFileSync(path.join(publicRoot,'pathos-personal/book-catalogue.mjs'),'utf8'),'The accepted update includes the new book catalogue module for offline startup');
    assert.equal(await peer.locator('meta[name="pathos-test-release"]').getAttribute('content'),'before');
    await peer.close();
    release='next';
    await app.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await app.locator('#pathosUpdateBanner').waitFor({state:'visible'});
    await app.locator('#addBtn').click();await app.locator('[name="title"]').fill('Unfinished draft');
    await app.evaluate(()=>document.getElementById('pathosUpdateNow').click());
    assert.equal(await app.locator('#entryDialog').evaluate(el=>el.open),true);
    assert.equal(await app.locator('meta[name="pathos-test-release"]').getAttribute('content'),'current');
    await app.locator('#cancelBtn').click();
    await app.evaluate(()=>{window.originalWrite=writeLocalArchive;writeLocalArchive=()=>Promise.reject(new Error('Simulated failure'));return saveDb();});
    await app.locator('#pathosUpdateNow').click();
    assert.equal(await app.evaluate(()=>archiveBusy),false);
    assert.equal(await app.locator('meta[name="pathos-test-release"]').getAttribute('content'),'current');
    await app.evaluate(()=>{writeLocalArchive=window.originalWrite;return saveDb();});
    await app.evaluate(()=>{writeLocalArchive=value=>new Promise((resolve,reject)=>setTimeout(()=>window.originalWrite(value).then(resolve,reject),500));db.experiences[0].review='Saved before update';saveDb();});
    await app.locator('#pathosUpdateNow').click();
    assert.equal(await app.locator('meta[name="pathos-test-release"]').getAttribute('content'),'current');
    await app.waitForFunction(()=>document.querySelector('meta[name="pathos-test-release"]').content==='next');
    await app.waitForFunction(()=>window.pathosPersonalReady);
    assert.equal((await archive(app)).experiences[0].review,'Saved before update');
    assert.deepEqual((await app.evaluate(()=>caches.keys())).filter(x=>x.startsWith('pathos-personal-shell-')),['pathos-personal-shell-test-next']);
    await installed.close();
    installed=await chromium.launchPersistentContext(profile,launch);persistentContexts.push(installed);await installed.setOffline(true);
    app=await personal(installed);
    assert.equal((await archive(app)).experiences[0].review,'Saved before update');
    assert.equal((await archive(app)).experiences[0].edition.cover,pixel);
    assert.equal((await archive(app)).experiences[0].edition.series,'Nuovi Coralli');
    assert.equal((await archive(app)).experiences[1].viewingLanguage,'Italian');
    assert.equal((await archive(app)).experiences[1].venue,'Update cinema');
    assert.deepEqual((await archive(app)).works[0].genres,['Fiction, general']);
    assert.equal(await app.evaluate(()=>window.PATHOS_STARTER_TERMS.genres.length),161,'Starter choices load after a full offline browser restart');
    assert.equal(await app.locator('link[rel="manifest"]').getAttribute('href'),'/pathos-personal/manifest.webmanifest');
    await app.screenshot({path:path.join(temporary,'personal.png'),fullPage:true});
    await installed.close();
  });

  await run('hosted public/owner UI, ordered saves, stale-window refusal, failed-load editing guard and restore',async()=>{
    release='current';
    const hosted=await context();
    // Substitute only the Supabase browser module; never contact the live archive.
    const module=`export function createClient(){return {auth:{getUser:async()=>({data:{user:window.mockOwner?{id:window.PATHOS_CONFIG.ownerUserId}:null}}),signOut:async()=>({}),signInWithPassword:async()=>({})},rpc:async(name,args)=>{window.mockCalls.push(name);if(window.mockLoadError)return{error:{message:'Simulated load error'}};if(name==='pathos_replace_my_archive'){if(window.mockSaveError)return{error:{message:'Simulated save error'}};window.mockCloud=JSON.parse(JSON.stringify(args.p_archive));return{};}return{data:JSON.parse(JSON.stringify(window.mockCloud))};}}}`;
    await hosted.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:module}));
    await hosted.addInitScript(value=>{window.mockOwner=false;window.mockCloud=value;window.mockCalls=[];},fixture);
    const guest=await observe(await hosted.newPage());await guest.goto(origin+'/pathos/app.html');
    await guest.waitForFunction(()=>document.querySelector('.pathos-sync-status').textContent==='Public archive');
    assert.equal(await guest.evaluate(()=>window.pathosCanEdit),false);
    assert.equal(await guest.locator('#addBtn').isVisible(),false);
    assert.deepEqual(await guest.evaluate(()=>window.mockCalls),['pathos_get_public_archive']);
    await checkArchiveViews(guest);
    await hosted.addInitScript(()=>{window.mockOwner=true;});
    const owner=await observe(await hosted.newPage());await owner.goto(origin+'/pathos/app.html');
    await owner.waitForFunction(()=>window.pathosCanEdit);
    await checkNavigation(owner,process.env.PATHOS_UI_SCREENSHOTS);
    await checkEntryDetails(owner,{backup,restore});
    await checkPreferences(owner,{backup,restore,outputDirectory:process.env.PATHOS_UI_SCREENSHOTS});
    await checkEntryImprovements(owner,{backup,restore});
    await checkEntryRecall(owner,{backup,restore,outputDirectory:process.env.PATHOS_UI_SCREENSHOTS});
    await checkGenreVocabulary(owner,{backup,restore,outputDirectory:process.env.PATHOS_UI_SCREENSHOTS});
    await owner.evaluate(()=>{db.experiences[0].review='Cloud edit';return saveDb();});
    assert.equal(await owner.evaluate(()=>window.mockCloud.experiences[0].review),'Cloud edit');
    assert.deepEqual(await owner.evaluate(()=>{db.experiences[0].review='Queued A';const a=saveDb();db.experiences[0].review='Queued B';return Promise.all([a,saveDb()]);}),[true,true]);
    assert.equal(await owner.evaluate(()=>window.mockCloud.experiences[0].review),'Queued B');
    await owner.evaluate(()=>{window.mockCloud.experiences[0].review='Other device';});
    assert.equal(await owner.evaluate(()=>{db.experiences[0].review='Stale cloud edit';return saveDb();}),false);
    assert.equal(await owner.evaluate(()=>window.mockCloud.experiences[0].review),'Other device');
    assert.equal((await backup(owner)).experiences[0].review,'Stale cloud edit');
    await owner.reload();await owner.waitForFunction(()=>window.pathosCanEdit);
    await owner.evaluate(()=>{window.mockSaveError=true;db.experiences[0].review='Retry';});
    assert.equal(await owner.evaluate(()=>saveDb()),false);
    await owner.evaluate(()=>{window.mockSaveError=false;});assert.equal(await owner.evaluate(()=>saveDb()),true);
    const download=owner.waitForEvent('download');
    await owner.locator('#restoreInput').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
    assert.match((await download).suggestedFilename(),/^pathos-before-restore-/);
    await owner.waitForFunction(()=>!document.getElementById('restoreInput').value);
    assert.deepEqual(await owner.evaluate(()=>window.mockCloud.experiences),fixture.experiences);
    const eventUrl='https://venue.example/events/ka-in/',poster=origin+'/pathos-personal/icon-192.png';
    const event={schemaVersion:6,works:[{id:'event',title:'KA-IN',type:'Theatre',cover:eventUrl}],experiences:[{id:'attendance',workId:'event',sourceUrl:eventUrl,review:'Hosted event review',isPublic:true,status:'completed',endDate:'2026-10-14'}]};
    const eventOwner=await observe(await hosted.newPage());
    await eventOwner.addInitScript(value=>{window.mockCloud=value;},event);
    await eventOwner.route('**/api/pathos/page-images',route=>route.fulfill({json:route.request().postDataJSON().mode==='store'?{dataUrl:pixel}:{pageUrl:eventUrl,images:[{url:poster,source:'Page image'}]}}));
    await eventOwner.goto(origin+'/pathos/app.html');await eventOwner.waitForFunction(()=>window.pathosCanEdit);
    await eventOwner.evaluate(()=>openExperience('attendance'));await eventOwner.locator('.page-image-choice').waitFor();
    assert.equal(await eventOwner.evaluate(()=>window.mockCloud.works[0].cover),eventUrl);
    await eventOwner.locator('.page-image-choice').click();
    await eventOwner.waitForFunction(()=>!coverTaskBusy&&document.getElementById('entryForm').elements.cover.value.startsWith('data:image/jpeg'));
    assert.equal(await eventOwner.evaluate(()=>window.mockCloud.works[0].cover),eventUrl);
    await eventOwner.locator('#entryForm button[type="submit"]').click();
    await eventOwner.waitForFunction(()=>window.mockCloud.experiences[0].cover?.startsWith('data:image/jpeg'));
    assert.equal(await eventOwner.evaluate(()=>window.mockCloud.experiences[0].isPublic),true);
    assert.equal(await eventOwner.evaluate(()=>window.mockCloud.experiences[0].review),'Hosted event review');
    const failed=await observe(await hosted.newPage());
    await failed.addInitScript(()=>{window.mockLoadError=true;});await failed.goto(origin+'/pathos/app.html');
    await failed.waitForFunction(()=>document.querySelector('.pathos-sync-status').textContent.startsWith('Load failed'));
    assert.equal(await failed.evaluate(()=>window.pathosCanEdit),false);
    await hosted.close();
  });
  if(process.env.PATHOS_SITE_URL)await run('hosted route uses the full viewport while academic pages retain their header',async()=>{
    const siteOrigin=new URL(process.env.PATHOS_SITE_URL).origin;
    const site=await browser.newContext();
    await site.route('**/*',route=>route.request().url().startsWith(siteOrigin)?route.continue():route.abort());
    await site.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:`export const createClient=()=>({auth:{getUser:async()=>({data:{user:null}})},rpc:async()=>({data:${JSON.stringify(fixture)}})});`}));
    const p=await observe(await site.newPage());
    await p.goto(siteOrigin+'/pathos');
    await p.frameLocator('iframe[title="Πathos"]').locator('.pathos-wordmark').waitFor();
    assert.equal(await p.locator('body>header').count(),0);
    assert.equal(await p.locator('body>footer').count(),0);
    let box=await p.locator('iframe[title="Πathos"]').boundingBox();
    assert.equal(box.y,0);assert.equal(box.height,p.viewportSize().height);
    assert.match(await p.locator('meta[name="robots"]').getAttribute('content'),/noindex/);
    await p.screenshot({path:path.join(temporary,'hosted-route.png'),fullPage:true});
    await p.setViewportSize({width:390,height:844});
    box=await p.locator('iframe[title="Πathos"]').boundingBox();
    assert.equal(box.y,0);assert.equal(box.height,844);
    await p.goto(siteOrigin+'/research');
    assert.equal(await p.locator('body>header').isVisible(),true);
    assert.equal(await p.locator('body>footer').isVisible(),true);
    await p.locator('body>header nav').getByRole('link',{name:'Home',exact:true}).click();
    await p.waitForURL(siteOrigin+'/');
    assert.equal(await p.locator('body>header').isVisible(),true);
    await site.close();
  });
  assert.deepEqual(errors,[],'Unexpected browser JavaScript errors');
  console.log('All Πathos browser checks passed. Screenshot: '+path.join(temporary,'personal.png'));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await Promise.allSettled(persistentContexts.map(ctx=>ctx.close()));
  await browser?.close();await new Promise(resolve=>server.close(resolve));
});
