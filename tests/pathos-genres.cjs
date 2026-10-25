const assert=require('node:assert/strict');
const path=require('node:path');
async function checkGenreVocabulary(page,{backup,restore,outputDirectory}){
 const hosted=page.url().includes('/pathos/'),original=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
 const field=name=>page.locator('#entryForm [name="'+name+'"]');
 const submit=async()=>{await page.locator('#entryForm button[type="submit"]').click();await page.waitForFunction(()=>!document.getElementById('entryDialog').open);await page.evaluate(()=>saveDb());};
 await page.evaluate(async()=>{db={schemaVersion:6,works:[],experiences:[]};await saveDb();showView('home');});
 if(!hosted){
  const starters=await page.evaluate(()=>window.PATHOS_STARTER_TERMS);
  assert.deepEqual(Object.keys(starters).sort(),['genres','moods']);assert.equal(starters.genres.length,161);assert.equal(starters.moods.length,5);
  assert(starters.genres.includes('Authors, Italian'));assert(starters.moods.includes('adventurous'));
  await page.evaluate(()=>openEntryDialog());await page.locator('#bookProfileDetails>summary').click();
  await field('bookGenres').fill('Authors, Ita');await page.locator('#cancelBtn').click();
  await page.evaluate(()=>openEntryDialog());await page.locator('#bookProfileDetails>summary').click();
  await field('bookGenres').fill('Auth');assert.equal(await page.locator('[data-suggestions="genres"] button').filter({hasText:'Authors, Italian'}).count(),1);
  await field('bookMoods').fill('adv');assert.equal(await page.locator('[data-suggestions="moods"] button').innerText(),'adventurous');
  assert.equal(await field('bookGenres').inputValue(),'Auth');assert.equal(await field('bookMoods').inputValue(),'adv','Starter terms are choices, never auto-filled');await page.locator('#cancelBtn').click();
  assert.deepEqual(await page.evaluate(()=>db),{schemaVersion:6,works:[],experiences:[]});
  assert.equal((await backup(page)).experiences.length,0,'Starter choices do not create archive records');
  await page.evaluate(()=>showView('insights'));assert(await page.locator('#moodStatsPanel').isHidden());
  assert.equal(await page.locator('#libraryMoodFilter option').count(),1,'Unused starter moods do not populate archive filters');
  assert(await page.evaluate(async()=>{const name=(await caches.keys()).find(name=>name.startsWith('pathos-personal-shell-'));return !!await(await caches.open(name)).match('/pathos-personal/starter-terms.js');}));
 }else assert.equal(await page.evaluate(()=>window.PATHOS_STARTER_TERMS),undefined,'Hosted suggestions use the loaded archive');
 const fixture={schemaVersion:6,works:[
  {id:'genre-work',title:'Genre original',type:'Book',genres:['Local genre','fiction','Study "closely"; now'],sourceMetadata:{genres:['Ignored fallback']}},
  {id:'genre-catalogue',title:'Catalogue original',type:'Book',sourceMetadata:{genres:['Fiction, general']}},
  {id:'genre-empty',title:'Intentionally empty genres',type:'Book',genres:[],sourceMetadata:{genres:['Do not suggest this fallback']}}
 ],experiences:[{id:'genre-reading',workId:'genre-work',status:'completed',moods:['Reflective'],quotes:[],tags:[],rating:'',isPublic:true}]};
 await page.evaluate(async value=>{db=migrateDatabase(value).database;await saveDb();showView('home');},fixture);
 await page.evaluate(()=>openExperience('genre-reading'));await page.locator('#bookProfileDetails>summary').click();
 assert.equal(await field('bookGenres').inputValue(),'Local genre, fiction, "Study ""closely""; now"');await submit();
 assert.deepEqual(await page.evaluate(()=>db.works[0].genres),fixture.works[0].genres,'An unrelated save preserves punctuation inside recorded genres');
 await page.evaluate(()=>openEntryDialog());await field('title').fill('Genre suggestion test');await page.locator('#bookProfileDetails>summary').click();
 await field('bookGenres').fill('new genre, loc');await field('bookGenres').press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await field('bookGenres').inputValue(),'new genre, Local genre, ');
 // Filter using the start of a quoted term, so a comma inside it is not a delimiter.
 await field('bookGenres').fill('new genre, local GENRE, "Fiction, gen');
 await page.locator('[data-suggestions="genres"]').getByRole('button',{name:'Fiction, general',exact:true}).click();
 assert.equal(await field('bookGenres').inputValue(),'new genre, local GENRE, "Fiction, general", ');
 assert.equal(await page.locator('[data-suggestions="genres"]').getByRole('button',{name:'Fiction, general',exact:true}).count(),0,'A chosen genre is not suggested twice');
 await field('bookMoods').fill('ref');await page.locator('[data-suggestions="moods"] button').filter({hasText:'Reflective'}).click();await submit();
 const saved=await page.evaluate(()=>({e:db.experiences.at(-1),w:db.works.at(-1)}));
 assert.deepEqual(saved.w.genres,['new genre','Local genre','Fiction, general']);assert.deepEqual(saved.e.moods,['Reflective'],'The local spelling takes precedence over starter terms');
 await page.evaluate(()=>openEntryDialog());await page.locator('#bookProfileDetails>summary').click();await field('bookGenres').fill('Cancelled genre');await page.locator('#cancelBtn').click();
 await page.evaluate(()=>openEntryDialog());await page.locator('#bookProfileDetails>summary').click();await field('bookGenres').fill('Cancelled');assert.equal(await page.locator('[data-suggestions="genres"] button').count(),0);
 await field('bookGenres').fill('Ignored fallback');assert.equal(await page.locator('[data-suggestions="genres"] button').count(),0);
 await field('bookGenres').fill('Do not suggest');assert.equal(await page.locator('[data-suggestions="genres"] button').count(),0);await page.locator('#cancelBtn').click();
 const recorded=await page.evaluate(()=>JSON.parse(JSON.stringify(db))),exported=await backup(page);assert.deepEqual(exported.works,recorded.works);assert.deepEqual(exported.experiences,recorded.experiences);
 if(!hosted){await restore(page,exported);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);await page.context().setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);assert.deepEqual(await page.evaluate(()=>db.works),recorded.works);assert.deepEqual(await page.evaluate(()=>db.experiences),recorded.experiences);}
 await page.evaluate(()=>openEntryDialog());await page.locator('#bookProfileDetails>summary').click();await field('bookGenres').fill('new gen');assert.equal(await page.locator('[data-suggestions="genres"] button').innerText(),'new genre','Newly saved genres are reusable after reload/restore');
 if(!hosted){await field('bookMoods').fill('adv');assert.equal(await page.locator('[data-suggestions="moods"] button').innerText(),'adventurous','Starter choices remain available offline');}
 if(outputDirectory){await page.setViewportSize({width:320,height:844});await field('bookGenres').fill('fic');await field('bookGenres').evaluate(input=>input.scrollIntoView({block:'center',behavior:'instant'}));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert(await page.locator('#entryDialog').evaluate(el=>el.scrollWidth<=el.clientWidth));await page.screenshot({path:path.join(outputDirectory,(hosted?'hosted':'personal')+'-genre-suggestions-320.png')});await page.setViewportSize({width:1280,height:844});}
 await page.locator('#cancelBtn').click();if(!hosted)await page.context().setOffline(false);
 await page.evaluate(async value=>{db=value;await saveDb();showView('home');},original);
}
module.exports={checkGenreVocabulary};
