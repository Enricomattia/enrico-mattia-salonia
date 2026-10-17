const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');

// Exercise actual forms and saves in isolated Personal / mocked owner sessions.
async function checkPreferences(page,{backup,restore,outputDirectory}){
  const original=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
  const hosted=page.url().includes('/pathos/'),variant=hosted?'hosted':'personal';
  const poster=color=>'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="240"><rect width="160" height="240" fill="${color}"/></svg>`).toString('base64');
  const oldCover=poster('#456e72'),newCover=poster('#a75d46');
  const fixture={schemaVersion:6,works:[
    {id:'pref-book',title:'The waves',creator:'Virginia Woolf',type:'Book',liked:true,sourceMetadata:{owned:'Yes'},cover:oldCover},
    {id:'pref-film',title:'Perfect days',creator:'Wim Wenders',type:'Film',cover:poster('#68825c')},
    ...['Invisible cities','The tempest','The years','Orlando'].map((title,i)=>({id:'pref-extra-'+i,title,type:'Book',liked:true,cover:poster(['#b59153','#566c93','#8c6b83','#47756c'][i])}))
  ],experiences:[
    {id:'pref-first',workId:'pref-book',status:'completed',endDate:'2026-09-01',rating:4,source:'StoryGraph',review:'The earlier reading.',quotes:[],edition:{isbn:'9780140328721',sourceId:'recorded-uid',publisher:'Hogarth Press',language:'Italian',cover:oldCover}},
    {id:'pref-second',workId:'pref-book',status:'completed',endDate:'2026-10-16',rating:5,source:'StoryGraph',review:'The later reading.',quotes:[],edition:{isbn:'9780140328721',sourceId:'recorded-uid-2',publisher:'Hogarth Press',language:'Italian',cover:newCover}},
    {id:'pref-viewing',workId:'pref-film',status:'in-progress',startDate:'2026-10-17',rating:'',review:'',quotes:[]},
    ...[0,1,2,3].map(i=>({id:'pref-extra-exp-'+i,workId:'pref-extra-'+i,status:'completed',endDate:'2026-09-1'+i,rating:4,review:'A moment worth keeping.',quotes:[]}))
  ]};
  fixture.works.forEach(work=>work.aliases=[]);
  await page.evaluate(async value=>{db=value;await saveDb();showView('home');},fixture);
  assert.equal(await page.locator('#favouritesShelf button').count(),5,'One cover per favourite work, including rereads');
  assert.equal(await page.locator('#favouritesShelf [data-work="pref-book"] img').getAttribute('src'),newCover,'The shelf uses the latest recorded edition');
  assert(await page.locator('#favouritesShelf button').evaluateAll(nodes=>nodes.every(node=>node.children.length===1&&node.firstElementChild.classList.contains('favourite-cover'))),'Only cover artwork, without separate titles or metadata');
  assert(await page.evaluate(()=>document.getElementById('favouritesSection').getBoundingClientRect().bottom<document.getElementById('currentSection').getBoundingClientRect().top),'Favourites precede Current');
  const beforeReading=await page.evaluate(()=>JSON.stringify(db));
  await page.locator('#favouritesShelf [data-work="pref-book"]').click();
  assert.equal(await page.locator('#workPageTitle').innerText(),'The waves');
  assert.doesNotMatch(await page.locator('#workDialogBody').innerText(),/ISBN|EAN|UID|9780140328721|recorded-uid|imported from/i);
  assert.match(await page.locator('#workDialogBody').innerText(),/Hogarth Press/);
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),beforeReading,'Reading does not discard hidden identifiers or import provenance');
  await page.locator('#favoriteWorkBtn').click();await page.evaluate(()=>saveDb());
  assert.equal(await page.locator('#favouritesShelf button').count(),4);
  await page.locator('#favoriteWorkBtn').click();await page.evaluate(()=>saveDb());
  assert.equal(await page.locator('#favouritesShelf button').count(),5);
  await page.locator('#closeWorkDialog').click();
  const field=name=>page.locator('#entryForm [name="'+name+'"]');
  const submit=async()=>{await page.locator('#entryForm button[type="submit"]').click();await page.evaluate(()=>saveDb());};
  await page.evaluate(()=>openExperience('pref-second'));
  assert(await field('liked').isChecked());assert(await field('owned').isChecked(),'Imported ownership is recognised without migration');
  await page.locator('#bookEditionDetails>summary').click();
  assert.equal(await field('editionLanguage').count(),1,'Only one book language control');
  assert.equal(await field('editionLanguage').inputValue(),'Italian');
  assert.equal(await field('editionIsbn').inputValue(),'9780140328721','ISBN remains editable in recording');
  await field('liked').uncheck();await field('owned').uncheck();await submit();
  assert.equal(await page.evaluate(()=>workFor('pref-book').owned),false,'Explicit unowned overrides an imported Yes');
  assert.equal(await page.locator('#favouritesShelf [data-work="pref-book"]').count(),0);
  await page.evaluate(()=>openExperience('pref-second'));
  assert.equal(await field('liked').isChecked(),false);assert.equal(await field('owned').isChecked(),false);
  await field('liked').check();await field('owned').check();await page.locator('#cancelBtn').click();
  assert.equal(await page.evaluate(()=>workFor('pref-book').owned),false,'Cancel does not save flags');
  await page.evaluate(()=>openExperience('pref-second'));
  await field('liked').check();await field('owned').check();await submit();
  // Repeating a work carries its flags; matching an existing work manually must not clear them.
  await page.evaluate(()=>openEntryDialog({work:workFor('pref-book')}));
  assert(await field('liked').isChecked());assert(await field('owned').isChecked());
  await field('endDate').fill('2026-10-17');await submit();
  await page.locator('#addBtn').click();await field('title').fill('The waves');
  await page.locator('#moreEntryDetails>summary').click();await field('creator').fill('Virginia Woolf');
  await submit();
  assert.equal(await page.evaluate(()=>workFor('pref-book').liked),true);
  assert.equal(await page.evaluate(()=>workFor('pref-book').owned),true,'An unselected manual match preserves ownership');
  await page.evaluate(()=>openExperience('pref-viewing'));
  assert.equal(await field('owned').isVisible(),false,'Ownership appears only for books');
  await field('liked').check();await submit();
  assert.equal(await page.locator('#favouritesShelf [data-work="pref-film"]').count(),1,'The main form can favourite a film');
  if(hosted){
    await page.evaluate(()=>{window.pathosCanEdit=false;window.dispatchEvent(new CustomEvent('pathos-owner-change',{detail:{active:false}}));});
    assert.equal(await page.locator('#favouritesSection').isVisible(),false,'Private favourite marks are hidden outside the owner editor');
    await page.evaluate(()=>{window.pathosCanEdit=true;window.dispatchEvent(new CustomEvent('pathos-owner-change',{detail:{active:true}}));});
    assert.equal(await page.locator('#favouritesShelf button').count(),6,'The shelf refreshes when owner mode returns');
  }
  const recorded=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
  const exported=await backup(page);
  assert.deepEqual(exported.works,recorded.works);
  assert.equal(exported.experiences.find(e=>e.id==='pref-second').edition.sourceId,'recorded-uid-2');
  assert.equal(exported.experiences.find(e=>e.id==='pref-second').source,'StoryGraph');
  const invalid=JSON.parse(JSON.stringify(exported));invalid.works[0].owned='yes';
  assert.match(await page.evaluate(value=>{try{prepareBackup(value);return''}catch(error){return error.message}},invalid),/ownership/i);
  if(!hosted){
    await restore(page,exported);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
    assert.deepEqual(await page.evaluate(()=>db.works),recorded.works);
    await page.context().setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
    assert.equal(await page.evaluate(()=>workFor('pref-book').owned),true);
    assert.equal(await page.locator('#favouritesShelf button').count(),6);
    await page.context().setOffline(false);
  }
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>showView('home'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'The shelf scrolls inside the page');
    if(width<=390)assert(await page.locator('#favouritesShelf').evaluate(node=>node.scrollWidth>node.clientWidth));
    if(outputDirectory&&width!==320){await fs.mkdir(outputDirectory,{recursive:true});await page.screenshot({path:path.join(outputDirectory,variant+'-favourites-'+width+'.png')});}
    await page.evaluate(()=>{showView('insights');insightPeriod='all';renderInsights();});
    assert.match(await page.locator('#insightHeadline').innerText(),/^\d+ experiences$/);
    assert(await page.locator('#insightHeadline').evaluate(node=>parseFloat(getComputedStyle(node).fontSize)<=24),'A quiet opening instead of the large breakdown');
    if(outputDirectory&&width!==320)await page.screenshot({path:path.join(outputDirectory,variant+'-insights-'+width+'.png')});
  }
  await page.setViewportSize({width:1280,height:844});
  await page.evaluate(async value=>{db=value;await saveDb();showView('home');},original);
}
module.exports={checkPreferences};
