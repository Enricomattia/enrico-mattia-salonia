const assert=require('node:assert/strict');
async function checkEntryImprovements(page,{backup,restore}){
 const original=await page.evaluate(()=>JSON.parse(JSON.stringify(db))),hosted=page.url().includes('/pathos/');
 const fixture={schemaVersion:6,works:[{id:'vocab-book',title:'Vocabulary book',type:'Book',liked:true}],experiences:[
  {id:'vocab-first',workId:'vocab-book',status:'completed',endDate:'2026-01-01',tags:['Rome','art'],moods:['Reflective'],rating:4,review:'First reading',quotes:[]},
  {id:'vocab-second',workId:'vocab-book',status:'completed',endDate:'2026-02-01',tags:['Art'],moods:['reflective','dark'],rating:5,review:'Second reading',quotes:[]}
 ]};
 await page.evaluate(async value=>{db=migrateDatabase(value).database;await saveDb();showView('library');},fixture);
 assert.equal(await page.locator('#libraryTagFilter option').count(),3,'Case variants share one vocabulary term');
 await page.locator('#libraryAdvanced>summary').click();await page.locator('#libraryTagFilter').selectOption('Rome');await page.locator('#libraryMoodFilter').selectOption('dark');
 assert.equal(await page.locator('#libraryGrid .work-card').count(),0,'Filters must match the same experience');
 await page.locator('#libraryMoodFilter').selectOption('Reflective');assert.equal(await page.locator('#libraryGrid .work-card').count(),1);
 await page.evaluate(()=>{showView('insights');insightPeriod='all';renderInsights();});
 assert.match(await page.locator('#tagStats').innerText(),/art · 2/);assert.match(await page.locator('#moodStats').innerText(),/Reflective · 2/);
 await page.locator('#moodStats button').filter({hasText:'Reflective'}).click();assert.equal(await page.locator('#insightDialogList [data-exp]').count(),2);await page.locator('#closeInsightDialog').click();
 await page.evaluate(()=>{insightPeriod='2026';db.experiences[0].endDate='2025-01-01';renderInsights();});
 assert.match(await page.locator('#moodStats').innerText(),/Reflective · 1/);
 await page.evaluate(()=>openExperience('vocab-second'));await page.locator('#bookProfileDetails>summary').click();
 const moods=page.locator('[name="bookMoods"]');await moods.fill('hopeful, ref');await moods.press('ArrowDown');await page.keyboard.press('Enter');
 assert.equal(await moods.inputValue(),'hopeful, Reflective, ');
 await page.locator('#moreEntryDetails>summary').evaluate(el=>{el.parentElement.open=true;});
 const tags=page.locator('[name="tags"]');await tags.fill('art, ro');await page.locator('[data-suggestions="tags"] button').filter({hasText:'Rome'}).click();assert.equal(await tags.inputValue(),'art, Rome, ');
 await page.locator('#bookEditionDetails>summary').click();assert.equal(await page.locator('[name="editionPublisher"]').count(),1);
 await page.locator('[name="editionPublisher"]').fill('Single publisher');await page.locator('#entryForm button[type="submit"]').click();await page.evaluate(()=>saveDb());
 const edited=await page.evaluate(()=>db.experiences.find(e=>e.id==='vocab-second'));
 assert.deepEqual(edited.tags,['art','Rome']);assert.deepEqual(edited.moods,['hopeful','Reflective']);assert.equal(edited.edition.publisher,'Single publisher');
 // Every medium supports custom uploads, independent of catalogue availability.
 const png=require('node:fs').readFileSync(require('node:path').join(__dirname,'../public/pathos-personal/icon-192.png'));
 for(const type of ['Film','TV','Theatre','Videogame','Album','Concert','Exhibition','Podcast','Opera','Other']){
  await page.evaluate(()=>openEntryDialog());await page.locator('[name="type"]').selectOption(type);await page.locator('[name="title"]').fill('Custom '+type);
  await page.locator('#moreEntryDetails>summary').click();await page.locator('#experienceCoverFile').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:png});
  await page.waitForFunction(()=>!coverTaskBusy&&document.getElementById('entryForm').elements.cover.value.startsWith('data:image/jpeg'));
  if(type==='Theatre'){
   await page.setViewportSize({width:320,height:844});await page.locator('#experienceCoverPreview').scrollIntoViewIfNeeded();
   assert(await page.locator('#entryDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'Custom cover controls fit a narrow phone');
   if(process.env.PATHOS_UI_SCREENSHOTS)await page.screenshot({path:require('node:path').join(process.env.PATHOS_UI_SCREENSHOTS,(hosted?'hosted':'personal')+'-custom-cover-320.png')});
   await page.setViewportSize({width:1280,height:844});
  }
  await page.locator('#entryForm button[type="submit"]').click();await page.evaluate(()=>saveDb());
  assert.match(await page.evaluate(()=>db.experiences.at(-1).cover),/^data:image\/jpeg;base64,/);
 }
 const attendance=await page.evaluate(()=>db.experiences.find(e=>workFor(e.workId).type==='Theatre'));
 await page.evaluate(id=>{const e=db.experiences.find(e=>e.id===id);e.sourceUrl='https://venue.example/play';openExperiencePage(id);},attendance.id);
 assert.equal(await page.locator('#workDialogBody a').filter({hasText:'Open reference'}).count(),0);await page.locator('#closeWorkDialog').click();
 // Cancelling an upload or pending download must not touch the archive.
 const recorded=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
 await page.evaluate(id=>openExperience(id),attendance.id);await page.locator('#experienceCoverFile').setInputFiles({name:'cover.png',mimeType:'image/png',buffer:png});await page.locator('#cancelBtn').click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(db))),recorded);
 // Copy a previously remote event image on Save, without rewriting sibling records.
 await page.route('**/api/pathos/page-images',async route=>{
  if(route.request().postDataJSON().mode!=='store')return route.fallback();
  if(route.request().postDataJSON().url.includes('fail'))return route.fulfill({status:502,json:{error:'Unavailable'}});
  return route.fulfill({json:{dataUrl:'data:image/png;base64,'+png.toString('base64')}});
 });
 await page.evaluate(id=>openExperience(id),attendance.id);await page.locator('#experienceCoverInput').fill('https://images.example/fail.png');
 await page.locator('#entryForm button[type="submit"]').click();await page.waitForFunction(()=>!coverTaskBusy&&document.getElementById('experienceCoverStatus').textContent.includes('Could not store'));
 assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(db))),recorded);
 await page.locator('#experienceCoverInput').fill('https://images.example/saved.png');await page.locator('#entryForm button[type="submit"]').click();await page.waitForFunction(()=>!document.getElementById('entryDialog').open);await page.evaluate(()=>saveDb());
 assert.equal(await page.evaluate(id=>db.experiences.find(e=>e.id===id).cover,attendance.id),attendance.cover,'The downloaded pixels persist as an embedded cover');
 await page.unroute('**/api/pathos/page-images');
 const exported=await backup(page);assert.deepEqual(exported.experiences,recorded.experiences);
 const invalid=structuredClone(exported);invalid.experiences[0].cover=23;assert.match(await page.evaluate(value=>{try{prepareBackup(value);return''}catch(error){return error.message}},invalid),/cover|text/i);
 if(!hosted){await restore(page,exported);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);await page.context().setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);assert.deepEqual(await page.evaluate(()=>db.experiences),recorded.experiences);const img=page.locator('#timelineList img').first();if(await img.count())assert(await img.evaluate(img=>img.complete&&img.naturalWidth>0));await page.context().setOffline(false);}
 await page.evaluate(async value=>{db=value;await saveDb();showView('home');},original);
}
module.exports={checkEntryImprovements};
