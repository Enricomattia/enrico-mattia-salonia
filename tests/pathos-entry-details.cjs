const assert=require('node:assert/strict');

// Both storage adapters use the real entry form; hosted tests stub only Supabase.
async function checkEntryDetails(page,{backup,restore}){
  const original=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
  const hosted=page.url().includes('/pathos/');
  const field=name=>page.locator('#entryForm [name="'+name+'"]');
  const submit=async()=>{await page.locator('#entryForm button[type="submit"]').click();await page.evaluate(()=>saveDb());};
  await page.locator('#addBtn').click();
  await field('type').selectOption('Film');
  await field('title').fill('Language test film');
  await field('endDate').fill('2026-10-15');
  assert.equal(await field('viewingLanguage').inputValue(),'');
  if(hosted)assert.equal(await field('isPrivate').isChecked(),false);
  else assert.equal(await field('isPrivate').count(),0);
  await field('viewingLanguage').fill('English');
  await submit();
  let film=await page.evaluate(()=>db.experiences.at(-1));
  assert.equal(film.viewingLanguage,'English');
  assert.equal(film.isPublic,hosted);
  await page.evaluate(id=>openExperience(id),film.id);
  assert.equal(await field('viewingLanguage').inputValue(),'English');
  await field('viewingLanguage').fill('Italian');
  await submit();
  await page.evaluate(id=>openEntryDialog({work:workFor(id)}),film.workId);
  assert.equal(await field('viewingLanguage').inputValue(),'','Do not infer the language of a rewatch');
  if(hosted){assert.equal(await field('isPrivate').isChecked(),false);await field('isPrivate').check();}
  await field('viewingLanguage').fill('French');
  await submit();
  let repeat=await page.evaluate(()=>db.experiences.at(-1));
  assert.equal(repeat.isPublic,false);
  await page.evaluate(id=>openExperience(id),repeat.id);
  if(hosted)assert.equal(await field('isPrivate').isChecked(),true);
  await page.getByRole('textbox',{name:'Review',exact:true}).fill('A private rewatch');
  await submit();
  assert.equal(await page.evaluate(id=>db.experiences.find(e=>e.id===id).isPublic,repeat.id),false);
  await page.evaluate(id=>openWork(id),film.workId);
  const text=await page.locator('#workDialogBody').innerText();
  assert(text.includes('Italian')&&text.includes('French'));
  await page.locator('#closeWorkDialog').click();
  await page.locator('#addBtn').click();
  assert.equal(await field('viewingLanguage').isVisible(),false);
  await field('title').fill('Publication series test book');
  await page.locator('#bookEditionDetails>summary').click();
  await field('editionPublisher').fill('Einaudi');
  await field('editionSeries').fill('Nuovi Coralli');
  await field('editionSeriesNumber').fill('15');
  await submit();
  const book=await page.evaluate(()=>db.experiences.at(-1));
  await page.evaluate(id=>openExperience(id),book.id);
  assert.equal(await field('editionSeries').inputValue(),'Nuovi Coralli');
  assert.equal(await field('editionSeriesNumber').inputValue(),'15');
  await submit();
  await page.evaluate(id=>openWork(id),book.workId);
  assert.match(await page.locator('.experience-edition').innerText(),/Einaudi · Nuovi Coralli n\. 15/);
  await page.locator('#closeWorkDialog').click();
  await page.evaluate(id=>openEntryDialog({work:workFor(id)}),book.workId);
  await page.locator('#bookEditionDetails>summary').click();
  await field('editionSeries').fill('Other series');
  await field('editionSeriesNumber').fill('2 bis');
  await submit();
  const recorded=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
  assert.equal(recorded.experiences.find(e=>e.id===book.id).edition.series,'Nuovi Coralli');
  assert.equal(recorded.experiences.at(-1).edition.seriesNumber,'2 bis');
  assert.deepEqual(await page.evaluate(()=>prepareBackup(JSON.parse(JSON.stringify(db))).experiences),recorded.experiences);
  const exported=await backup(page);
  assert.deepEqual(exported.experiences,recorded.experiences);
  if(!hosted){
    await restore(page,exported);
    await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
    assert.deepEqual(await page.evaluate(()=>db.experiences),recorded.experiences);
    const context=page.context();await context.setOffline(true);
    await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
    assert.deepEqual(await page.evaluate(()=>db.experiences),recorded.experiences);
    await context.setOffline(false);
  }
  // Legacy private entries (missing flag included) must stay private on edit.
  if(hosted){
    await page.evaluate(id=>{const e=db.experiences.find(e=>e.id===id);delete e.isPublic;openExperience(id);},repeat.id);
    assert.equal(await field('isPrivate').isChecked(),true);
    await submit();
    assert.equal(await page.evaluate(id=>db.experiences.find(e=>e.id===id).isPublic,repeat.id),false);
    assert.equal(await page.evaluate(()=>addExperience({title:'Imported new film',type:'Film'}).isPublic),true);
    assert.equal(await page.evaluate(()=>addExperience({title:'Explicit private import',type:'Film',isPublic:false}).isPublic),false);
  }
  await page.evaluate(async value=>{db=value;await saveDb();showView('home');},original);
}
module.exports={checkEntryDetails};
