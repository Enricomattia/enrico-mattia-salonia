const assert=require('node:assert/strict');
const path=require('node:path');
async function checkEntryRecall(page,{backup,restore,outputDirectory}){
 const original=await page.evaluate(()=>JSON.parse(JSON.stringify(db))),hosted=page.url().includes('/pathos/');
 const venue='Cinema Lumière, Sala 2';
 const fixture={schemaVersion:6,works:[
  {id:'recall-book',title:'Book with recorded identifiers',type:'Book'},
  {id:'recall-edition',title:'Book with edition details',type:'Book'},
  {id:'recall-film',title:'Film diary',type:'Film'},
  {id:'recall-theatre',title:'Theatre diary',type:'Theatre'},
  {id:'recall-concert',title:'Concert diary',type:'Concert'}
 ],experiences:[
  {id:'recall-reading',workId:'recall-book',status:'in-progress',startDate:'2026-01-01',edition:{isbn:'9780140328721',source:'manual'},quotes:[{id:'recall-quote',text:'Keep this passage',note:'p. 3',featured:false}]},
  {id:'recall-language',workId:'recall-edition',status:'completed',endDate:'2026-02-01',edition:{publisher:'Exact publisher',language:'Klingon'}},
  {id:'recall-first',workId:'recall-film',status:'completed',endDate:'2026-03-01',venue,viewingLanguage:'English'},
  {id:'recall-repeat',workId:'recall-film',status:'completed',endDate:'2026-04-01',venue:' cinema lumière,  sala 2 ',viewingLanguage:'eng'},
  {id:'recall-old',workId:'recall-film',status:'completed',endDate:'2025-03-01',venue,viewingLanguage:'Italian'},
  {id:'recall-planned',workId:'recall-film',status:'planned',venue,viewingLanguage:'English'},
  {id:'recall-play',workId:'recall-theatre',status:'completed',endDate:'2026-05-01',venue},
  {id:'recall-gig',workId:'recall-concert',status:'completed',endDate:'2026-06-01',venue:'Concert hall'}
 ].map(e=>({rating:'',review:'',quotes:[],tags:[],isPublic:true,...e}))};
 await page.evaluate(async value=>{db=migrateDatabase(value).database;await saveDb();showView('home');},fixture);
 const loaded=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
 for(const [id,hidden] of [['recall-first',venue],['recall-play',venue]]){
  const card=page.locator('#timelineList [data-exp="'+id+'"]');
  assert(!(await card.innerText()).includes(hidden),'Film/theatre diary cards omit the venue');
  await card.click();assert(!(await page.locator('#workDialogBody').innerText()).includes(hidden),'Reading cards omit the venue too');
  await page.locator('#closeWorkDialog').click();
 }
 assert((await page.locator('#timelineList [data-exp="recall-gig"]').innerText()).includes('Concert hall'));
 await page.evaluate(()=>openWork('recall-book'));assert.equal(await page.locator('.experience-edition').count(),0,'Identifiers-only editions omit the placeholder');await page.locator('#closeWorkDialog').click();
 await page.evaluate(()=>openWork('recall-edition'));assert.match(await page.locator('.experience-edition').innerText(),/Exact publisher.*Klingon/);await page.locator('#closeWorkDialog').click();
 assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(db))),loaded,'Rendering does not rewrite the archive');
 const field=name=>page.locator('#entryForm [name="'+name+'"]');
 const submit=async()=>{await page.locator('#entryForm button[type="submit"]').click();await page.waitForFunction(()=>!document.getElementById('entryDialog').open);await page.evaluate(()=>saveDb());};
 await page.evaluate(()=>openExperience('recall-reading'));
 await field('endDate').fill('2025-12-31');assert.equal(await field('status').inputValue(),'in-progress','An invalid date does not mark a book complete');
 await field('endDate').fill('2026-07-01');assert.equal(await field('status').inputValue(),'completed');await submit();
 const reading=await page.evaluate(()=>db.experiences.find(e=>e.id==='recall-reading'));
 assert.equal(reading.status,'completed');assert.equal(reading.edition.isbn,'9780140328721');assert.deepEqual(reading.quotes,loaded.experiences[0].quotes);
 assert.equal(await page.locator('#currentList [data-exp="recall-reading"]').count(),0);
 await page.evaluate(()=>openExperience('recall-reading'));await field('status').selectOption('in-progress');
 await page.locator('[data-today="endDateInput"]').click();assert.equal(await field('status').inputValue(),'completed','Today also completes a book');
 await field('endDate').fill('');assert.equal(await field('status').inputValue(),'completed','Clearing a date does not invent another status');
 await field('status').selectOption('dnf');await page.locator('#cancelBtn').click();
 await page.evaluate(()=>openExperience('recall-first'));assert.equal(await field('venue').inputValue(),venue);await page.locator('#cancelBtn').click();
 await page.evaluate(()=>openEntryDialog());await field('type').selectOption('Film');await field('title').fill('Suggested film');
 await field('status').selectOption('in-progress');await field('endDate').fill('2026-08-01');assert.equal(await field('status').inputValue(),'in-progress','Other media keep the chosen status');
 await field('status').selectOption('completed');await field('venue').fill('Lumi');
 await page.locator('[data-suggestions="venues"] button').filter({hasText:venue}).click();assert.equal(await field('venue').inputValue(),venue,'Commas in venues remain part of one value');
 await field('viewingLanguage').fill('Kli');await field('viewingLanguage').press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await field('viewingLanguage').inputValue(),'Klingon','Book languages also appear for films');
 await field('viewingLanguage').fill(' english ');await field('venue').fill(' cinema lumière,  sala 2 ');await submit();
 const added=await page.evaluate(()=>db.experiences.at(-1));assert.equal(added.venue,venue);assert.equal(added.viewingLanguage,'English');
 await page.evaluate(()=>openEntryDialog());await field('venue').fill('Cancelled venue');await page.locator('#cancelBtn').click();
 await page.evaluate(()=>openEntryDialog());await field('venue').fill('Cancelled');assert.equal(await page.locator('[data-suggestions="venues"] button').count(),0);await page.locator('#cancelBtn').click();
 await page.evaluate(()=>openExperience('recall-language'));await page.locator('#bookEditionDetails>summary').evaluate(el=>el.parentElement.open=true);
 await field('editionLanguage').fill('Eng');await page.locator('#editionPanel [data-suggestions="languages"] button').filter({hasText:'English'}).click();assert.equal(await field('editionLanguage').inputValue(),'English');await page.locator('#cancelBtn').click();
 await page.evaluate(()=>{showView('insights');insightPeriod='2026';renderInsights();});
 await page.locator('#languageStatsMedium').selectOption('Film');await page.locator('#venueStatsMedium').selectOption('Film');
 const english=page.locator('#languageStats button').filter({hasText:'English'}),cinema=page.locator('#venueStats button').filter({hasText:venue});
 assert.equal(await english.innerText(),'English · 3');assert.equal(await cinema.innerText(),venue+' · 3','Counts include repeat films, group spelling variants and omit planned/other-year/theatre entries');
 await cinema.click();assert.equal(await page.locator('#insightDialogList [data-exp]').count(),3);assert.match(await page.locator('#insightDialogTitle').innerText(),/Film.*Venue/);await page.locator('#closeInsightDialog').click();
 await english.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#insightDialogList [data-exp]').count(),3);await page.locator('#closeInsightDialog').click();
 await page.locator('#venueStatsMedium').selectOption('Theatre');assert.equal(await page.locator('#venueStats button').innerText(),venue+' · 1');
 await page.evaluate(()=>{insightPeriod='all';renderInsights();});await page.locator('#venueStatsMedium').selectOption('Film');assert.equal(await cinema.innerText(),venue+' · 4');
 const recorded=await page.evaluate(()=>JSON.parse(JSON.stringify(db))),exported=await backup(page);assert.deepEqual(exported.experiences,recorded.experiences);
 assert.equal(recorded.experiences.find(e=>e.id==='recall-repeat').viewingLanguage,'eng','Legacy records are not normalized in storage');
 if(outputDirectory){
  for(const width of [1280,390,320]){await page.setViewportSize({width,height:844});await page.locator('#venueStatsPanel').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(outputDirectory,(hosted?'hosted':'personal')+'-detail-stats-'+width+'.png')});}
  await page.setViewportSize({width:1280,height:844});
 }
 if(!hosted){await restore(page,exported);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);await page.context().setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);assert.deepEqual(await page.evaluate(()=>db.experiences),recorded.experiences);await page.context().setOffline(false);}
 await page.evaluate(()=>openEntryDialog());await field('venue').fill('Lumi');assert.equal(await page.locator('[data-suggestions="venues"] button').count(),1,'Restored and reloaded archives rebuild suggestions');await page.locator('#cancelBtn').click();
 await page.evaluate(async value=>{db=value;await saveDb();insightPeriod=null;showView('home');},original);
}
module.exports={checkEntryRecall};
