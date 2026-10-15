/* UI-only synthetic fixtures; no saves and no live archive requests. */
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');

async function checkTimeline(page,outputDirectory){
  await page.bringToFront();
  const before=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
  const titles=['The waves','Perfect days','KA-IN','A room of one’s own','Past lives','The listening room','Invisible cities','Aftersun','The tempest','The years','In the mood for love','A night at the opera','The book of disquiet','Drive my car','Ways of seeing','A field recording','Orlando','The red shoes','Winter light'];
  const colors=['#52766e','#bb785b','#566e8a','#958961','#7e667c'];
  const fixture={schemaVersion:6,works:[],experiences:[]};
  titles.forEach((title,i)=>{
    const poster='data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="${colors[i%colors.length]}"/><circle cx="100" cy="105" r="58" fill="#fff" opacity=".16"/><path d="M0 240 L200 80 V300 H0Z" fill="#fff" opacity=".12"/><text x="18" y="268" fill="white" font-family="Georgia" font-size="22">${title.slice(0,15)}</text></svg>`).toString('base64');
    fixture.works.push({id:'ui-work-'+i,title,type:['Book','Film','Theatre','Concert'][i%4],creator:['Virginia Woolf','Wim Wenders','Groupe Acrobatique','Live performance'][i%4],cover:poster});
    fixture.experiences.push({id:'ui-exp-'+i,workId:'ui-work-'+i,endDate:'2026-09-'+String(28-i).padStart(2,'0'),status:'completed',rating:4.5,review:'A moment to return to. Notes on the images, the atmosphere, and what stayed with me.',...(i===0?{edition:{cover:poster+'#exact-edition',isbn:'9780140328721'}}:{})});
  });
  await page.evaluate(value=>{db=value;renderAll();showView('home');},fixture);
  assert.equal(await page.locator('#currentSection').isVisible(),false);
  await page.evaluate(()=>{db.experiences[0].status='in-progress';renderAll();});
  assert(await page.locator('#currentSection').isVisible());
  assert(await page.evaluate(()=>document.getElementById('currentSection').getBoundingClientRect().bottom<document.querySelector('.home-timeline-section').getBoundingClientRect().top),'Current is above the timeline');
  await page.evaluate(()=>{db.experiences[0].status='completed';renderAll();});
  const variant=page.url().includes('personal')?'personal':'hosted';
  for(const width of [1280,768,601,600,390,320]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(()=>{showView('home');window.scrollTo({top:0,behavior:'instant'});});
    if(width>600)await page.waitForFunction(()=>document.querySelector('#homeTimelineTrack path')?.getAttribute('d'));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#homeTimelineTrack button[data-exp]').count(),12);
    for(const track of ['#homeTimelineTrack','#timelineList']){
      if(track==='#timelineList')await page.evaluate(()=>showView('timeline'));
      if(width>600)await page.waitForFunction(selector=>!!document.querySelector(selector+' path')?.getAttribute('d'),track);
      const positions=await page.locator(track+' .serpent-stop').evaluateAll(nodes=>nodes.map(node=>({x:node.offsetLeft,y:node.offsetTop,id:node.querySelector('button').dataset.exp})));
      assert.deepEqual(positions.map(p=>p.id),titles.slice(0,track==='#timelineList'?19:12).map((_,i)=>'ui-exp-'+i),'DOM/focus order must remain chronological');
      if(width>600){
        assert(positions[0].x<positions[1].x&&positions[1].x<positions[2].x);
        assert(positions[3].x>positions[4].x&&positions[4].x>positions[5].x);
        assert(positions[6].y>positions[3].y&&positions[3].y>positions[0].y);
      }else{
        assert(positions.every((p,i)=>p.x===positions[0].x&&(!i||p.y>positions[i-1].y)),'Phone timeline is a single chronological column');
        assert.equal(await page.locator(track+' svg').isVisible(),false);
        const cardWidth=(await page.locator(track+' button').first().boundingBox()).width;
        const viewport=page.locator(track==='#timelineList'?'#fullTimelineScroll':'#homeTimelineScroll');
        assert(cardWidth>=(await viewport.boundingBox()).width*.9,'Phone cards use nearly all available width');
        assert(await viewport.evaluate(node=>node.scrollWidth<=node.clientWidth+1),'Phone timeline needs no horizontal scrolling');
      }
      assert.equal(await page.locator(track+' .serpent-cover img').count(),positions.length);
      assert.match(await page.locator(track+' img').first().getAttribute('src'),/#exact-edition$/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Only the timeline canvas may overflow horizontally');
      if(width>600&&width<=768){
        const viewport=page.locator(track==='#timelineList'?'#fullTimelineScroll':'#homeTimelineScroll');
        assert(await viewport.evaluate(node=>node.scrollWidth>node.clientWidth));
        await viewport.evaluate(node=>node.scrollLeft=node.scrollWidth);
        assert(await viewport.evaluate(node=>node.scrollLeft>0),'Native horizontal panning works');
        await viewport.evaluate(node=>node.scrollLeft=0);
      }
    }
    if(width<=600){
      assert.equal(await page.locator('#homeTimelineNext').isVisible(),false);
      assert.equal(await page.locator('[data-timeline-pan="1"]').isVisible(),false);
      for(const name of ['Home','Library','Timeline','Insights']){
        const nav=page.locator('.tabs>.tab').filter({hasText:new RegExp('^'+name+'$')});
        assert(await nav.isVisible(),name+' is available at '+width);
        assert((await nav.boundingBox()).height>=44);
      }
      await page.locator('#moreMenuLabel').click();
      await page.locator('#moreMenu .menu-view[data-view="passages"]').click();
      assert(await page.locator('#passages').isVisible());
      await page.evaluate(()=>showView('library'));
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
      await page.evaluate(()=>{showView('timeline');window.scrollTo({top:0,behavior:'instant'});});
      await page.screenshot({path:path.join(outputDirectory,variant+'-timeline-'+width+'.png'),fullPage:width>600});
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{showView('home');window.scrollTo({top:0,behavior:'instant'});});
  await page.mouse.move(160,350);await page.mouse.wheel(0,280);
  await page.waitForFunction(()=>window.scrollY>100);
  assert.equal(await page.locator('#homeTimelineScroll').evaluate(node=>node.scrollLeft),0,'Vertical scrolling is not converted into horizontal scrolling');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  const touch=await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  const start={x:160,y:540};
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});
  for(let y=510;y>=300;y-=30)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x,y}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>window.scrollY>100);
  assert.equal(await page.locator('#homeTimelineScroll').evaluate(node=>node.scrollLeft),0);
  // Let the browser finish touch momentum before switching to keyboard input.
  await page.evaluate(()=>new Promise(resolve=>{let previous=-1,stable=0;function frame(){const y=window.scrollY;stable=y===previous?stable+1:0;previous=y;if(stable>=5)resolve();else requestAnimationFrame(frame);}frame();}));
  await touch.send('Emulation.setTouchEmulationEnabled',{enabled:false});await touch.detach();
  await page.locator('#homeTimelineScroll').evaluate(node=>node.scrollLeft=0);
  await page.locator('#homeTimelineTrack [data-exp="ui-exp-0"]').focus();
  for(let i=1;i<7;i++){
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.exp),'ui-exp-'+i);
    const box=await page.locator('#homeTimelineTrack [data-exp="ui-exp-'+i+'"]').boundingBox();
    assert(box.x>=-1&&box.x+box.width<=391,'Focused card pans into view: '+JSON.stringify({i,box}));
  }
  await page.evaluate(()=>{window.scrollTo({top:0,behavior:'instant'});document.getElementById('homeTimelineScroll').scrollLeft=0;});
  assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(db))),fixture,'Layout, navigation and panning never rewrite archive records');
  if(await page.evaluate(()=>window.pathosCanEdit)){
    await page.evaluate(()=>openExperience('ui-exp-0'));
    await page.locator('#entryDialog').waitFor();
    const dialog=await page.locator('#entryDialog').boundingBox();
    assert(dialog.x>=0&&dialog.x+dialog.width<=390);
    assert.equal(await page.locator('#entryDialog').evaluate(node=>node.scrollWidth<=node.clientWidth),true,'Mobile form fits horizontally');
    assert.equal(await page.locator('#entryForm [name="title"]').evaluate(node=>getComputedStyle(node).fontSize),'16px','Avoid automatic iOS input zoom');
    await page.locator('#cancelBtn').click();
  }
  // Empty and partial final rows must not create phantom cards or paths.
  for(const count of [0,1,2,4,5]){
    await page.evaluate(({fixture,count})=>{db=JSON.parse(JSON.stringify(fixture));db.experiences=db.experiences.slice(0,count);renderAll();showView('timeline');},{fixture,count});
    assert.equal(await page.locator('#timelineList button').count(),count);
    assert.equal(await page.locator('#timelineList svg').count(),count?1:0);
  }
  await page.evaluate(value=>{db=value;renderAll();showView('home');},before);
  await page.setViewportSize({width:1280,height:800});
}
module.exports={checkTimeline};
