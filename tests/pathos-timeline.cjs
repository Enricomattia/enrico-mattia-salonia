/* Home diary checks. UI-only synthetic fixtures; no saves and no live archive requests. */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {navigatePage}=require('./pathos-navigation.cjs');

async function checkTimeline(page,outputDirectory){
  await page.bringToFront();
  const before=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
  const titles=['The waves','Perfect days','KA-IN','A room of one’s own','Past lives','The listening room','Invisible cities','Aftersun','The tempest','The years','In the mood for love','A night at the opera','The book of disquiet','Drive my car','Ways of seeing','A field recording','Orlando','The red shoes','Winter light'];
  const colors=['#52766e','#bb785b','#566e8a','#958961','#7e667c'];
  const fixture={schemaVersion:6,works:[],experiences:[]};
  titles.forEach((title,i)=>{
    const poster='data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="${colors[i%colors.length]}"/><circle cx="100" cy="105" r="58" fill="#fff" opacity=".16"/><text x="18" y="268" fill="white" font-family="Georgia" font-size="22">${title.slice(0,15).replace(/[<&]/g,'')}</text></svg>`).toString('base64');
    // Ten September entries (two on the same day), then nine in August; every third has no review.
    const endDate=i===1?'2026-09-28':i<10?'2026-09-'+String(28-i).padStart(2,'0'):'2026-08-'+String(30-i).padStart(2,'0');
    fixture.works.push({id:'ui-work-'+i,title,type:['Book','Film','Theatre','Concert'][i%4],creator:['Virginia Woolf','Wim Wenders','Groupe Acrobatique','Live performance'][i%4],...(i===5?{}:{cover:poster})});
    fixture.experiences.push({id:'ui-exp-'+i,workId:'ui-work-'+i,endDate,status:'completed',rating:[4.5,3,5,1.75][i%4],review:i%3===2?'':'A moment to return to. Notes on the images, the atmosphere, and what stayed with me.',...(i===0?{edition:{cover:poster+'#exact-edition',isbn:'9780140328721'}}:{})});
  });
  const ids=fixture.experiences.map(e=>e.id).sort((a,b)=>{const ea=fixture.experiences.find(e=>e.id===a),eb=fixture.experiences.find(e=>e.id===b);return eb.endDate.localeCompare(ea.endDate)||0;});
  await page.evaluate(value=>{db=value;renderAll();showView('home');},fixture);
  assert.equal(await page.locator('#currentSection').isVisible(),false);
  await page.evaluate(()=>{db.experiences[0].status='in-progress';renderAll();});
  assert(await page.locator('#currentSection').isVisible());
  assert.equal(await page.locator('#currentList [data-exp="ui-exp-0"]').count(),1);
  assert(await page.evaluate(()=>document.getElementById('currentSection').getBoundingClientRect().bottom<document.querySelector('.home-timeline-section').getBoundingClientRect().top),'Current is above the diary');
  assert.match(await page.locator('#timelineList [data-exp="ui-exp-0"] .diary-meta').innerText(),/^Started/);
  await page.evaluate(()=>{db.experiences[0].status='completed';renderAll();});
  // The former Timeline page now opens Home.
  await page.evaluate(()=>showView('timeline'));assert(await page.locator('#home').isVisible());assert.equal(await page.locator('#timeline').count(),0);
  const variant=page.url().includes('personal')?'personal':'hosted';
  for(const width of [1280,768,601,600,390,320]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>{showView('home');window.scrollTo({top:0,behavior:'instant'});});
    const order=await page.locator('#timelineList [data-exp]').evaluateAll(nodes=>nodes.map(node=>node.dataset.exp));
    assert.deepEqual(order,ids,'DOM/focus order is chronological, newest first, and includes every dated entry');
    assert.equal(await page.locator('#timelineList .diary-month').count(),2,'Entries are grouped by month');
    assert.equal(await page.locator('#timelineList .diary-month').first().locator('[data-exp]').count(),10);
    assert.equal(await page.locator('#timelineList time.diary-day').count(),titles.length-1,'A shared day is shown once');
    assert.equal(await page.locator('#timelineList .diary-row.is-compact').count(),fixture.experiences.filter(e=>!e.review).length,'Entries without a review are compact');
    assert.match(await page.locator('#timelineList img').first().getAttribute('src'),/#exact-edition$/);
    assert.equal(await page.locator('#timelineList [data-exp="ui-exp-5"] img').count(),0);
    assert.equal(await page.locator('#timelineList [data-exp="ui-exp-5"] .generated-cover').count(),1,'Missing artwork draws a typographic cover');
    assert.equal(await page.locator('#timelineList [data-exp="ui-exp-3"] .rating-value').innerText(),'1.75/5','Pips keep the exact rating');
    const firstBox=await page.locator('#timelineList [data-exp]').first().boundingBox();
    assert(firstBox.x>=0&&firstBox.x+firstBox.width<=width+1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page-wide horizontal overflow at '+width);
    assert.equal(await page.locator('#diaryMoreBtn').isVisible(),false);
    if(width<=600){
      for(const name of ['Home','Library','Passages','Insights']){
        const nav=page.locator('.tabs>.tab').filter({hasText:new RegExp('^'+name+'$')});
        assert(await nav.isVisible(),name+' is available at '+width);
        assert((await nav.boundingBox()).height>=44);
      }
      await navigatePage(page,'passages');
      assert(await page.locator('#passages').isVisible());
      await page.evaluate(()=>showView('library'));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Medium chips scroll inside their row');
      await page.locator('#libraryAdvanced>summary').click();
      const panel=await page.locator('#libraryAdvanced .filter-panel').boundingBox();
      assert(panel.x>=0&&panel.x+panel.width<=width+1,'Library filters fit the screen');
      await page.locator('#libraryAdvanced>summary').click();
      await page.evaluate(()=>showView('passages'));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    }
    if(outputDirectory&&[1280,390].includes(width)){
      await fs.mkdir(outputDirectory,{recursive:true});
      await page.evaluate(()=>{showView('home');window.scrollTo({top:0,behavior:'instant'});});
      await page.screenshot({path:path.join(outputDirectory,variant+'-home-'+width+'.png'),fullPage:width>600});
    }
  }
  // Keyboard order follows the diary.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{showView('home');window.scrollTo({top:0,behavior:'instant'});});
  await page.locator('#timelineList [data-exp="'+ids[0]+'"]').focus();
  for(let i=1;i<6;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.exp),ids[i]);}
  // An entry opens its work page; editing is one explicit step away and editor-only.
  const owner=await page.evaluate(()=>window.pathosCanEdit);
  await page.locator('#timelineList [data-exp="ui-exp-1"]').click();
  assert(await page.locator('#workDialog').isVisible());
  assert.equal(await page.locator('#workPageTitle').innerText(),titles[1]);
  assert.equal(await page.locator('#workDialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true,'Work page fits a phone');
  assert.equal(await page.locator('#workDialogBody .experience-edit').isVisible(),owner);
  if(owner){
    await page.locator('#workDialogBody .experience-edit').click();
    assert.equal(await page.locator('#workDialog').isVisible(),false);
    await page.locator('#entryDialog').waitFor();
    assert.equal(await page.locator('#entryForm [name="title"]').inputValue(),titles[1]);
    const dialog=await page.locator('#entryDialog').boundingBox();
    assert(dialog.x>=0&&dialog.x+dialog.width<=390);
    assert.equal(await page.locator('#entryDialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true,'Mobile form fits horizontally');
    assert.equal(await page.locator('#entryForm [name="title"]').evaluate(node=>getComputedStyle(node).fontSize),'16px','Avoid automatic iOS input zoom');
    await page.locator('#cancelBtn').click();
  }else await page.locator('#closeWorkDialog').click();
  // Vertical scrolling stays vertical.
  await page.mouse.move(160,350);await page.mouse.wheel(0,280);
  await page.waitForFunction(()=>window.scrollY>100);
  assert.equal(await page.evaluate(()=>window.scrollX),0);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(db))),fixture,'Layout, navigation and reading never rewrite archive records');
  // Long archives render in steps; the button moves focus to the first new entry.
  await page.evaluate(value=>{const big=JSON.parse(JSON.stringify(value));for(let i=0;i<60;i++)big.experiences.push({...big.experiences[i%19],id:'extra-'+i,endDate:'2025-0'+(1+i%9)+'-1'+(i%9)});db=big;diaryLimit=60;renderAll();showView('home');},fixture);
  assert.equal(await page.locator('#timelineList [data-exp]').count(),60);
  assert(await page.locator('#diaryMoreBtn').isVisible());
  await page.locator('#diaryMoreBtn').click();
  assert.equal(await page.locator('#timelineList [data-exp]').count(),79);
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#timelineList [data-exp]')].indexOf(document.activeElement)),60);
  assert.equal(await page.locator('#diaryMoreBtn').isVisible(),false);
  // Empty and short archives: no phantom rows.
  for(const count of [0,1,2]){
    await page.evaluate(({fixture,count})=>{db=JSON.parse(JSON.stringify(fixture));db.experiences=db.experiences.slice(0,count);db.works=db.works.slice(0,count);diaryLimit=60;renderAll();showView('home');},{fixture,count});
    assert.equal(await page.locator('#timelineList [data-exp]').count(),count);
    assert.equal(await page.locator('#timelineList .empty').count(),count?0:1);
  }
  await page.evaluate(value=>{db=value;diaryLimit=60;renderAll();showView('home');},before);
  await page.setViewportSize({width:1280,height:800});
}
module.exports={checkTimeline};
