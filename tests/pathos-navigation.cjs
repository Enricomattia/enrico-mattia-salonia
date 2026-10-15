// Navigation-only checks. No archive writes or remote requests.
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs/promises');
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function navigatePage(page,name){
  await settle(page);
  if(name==='metadata'||name==='import'){await page.locator('#settingsMenu>summary').click();await page.locator('#settingsMenu .menu-view[data-view="'+name+'"]').click();await settle(page);return;}
  const direct=page.locator('.tabs>.tab[data-view="'+name+'"]');
  if(await direct.isVisible())await direct.click();else{await page.locator('#moreMenuLabel').click();await page.locator('#moreMenu .menu-view[data-view="'+name+'"]').click()}
  await settle(page);
}
async function checkNavigation(page,output){
  const before=await page.evaluate(()=>JSON.stringify(db)),original=page.viewportSize(),owner=await page.evaluate(()=>window.pathosCanEdit);
  const pages=['home','library','passages','insights'];
  assert.deepEqual(await page.locator('.tabs>.tab').evaluateAll(nodes=>nodes.map(node=>node.dataset.view)),pages,'Four pages; Timeline is part of Home');
  assert.equal(await page.locator('[data-view="timeline"]').count(),0);
  for(const width of [1600,1180,1024,850,768,601,600,480,390,320]){
    await page.setViewportSize({width,height:844});await settle(page);
    const visible=await page.locator('.tabs>.tab').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>node.dataset.view));
    const overflow=await page.locator('#moreMenu .menu-view').evaluateAll(nodes=>nodes.filter(node=>!node.hidden).map(node=>node.dataset.view));
    assert.deepEqual(visible,pages,'All four pages fit inline at '+width);
    assert.equal(overflow.length,0);assert.equal(await page.locator('#moreMenu').isVisible(),false,'No More menu when everything fits');
    const geometry=await page.locator('.tabs').evaluate(nav=>{const nodes=[...nav.children].filter(node=>node.getClientRects().length);const boxes=nodes.map(node=>node.getBoundingClientRect());const box=nav.getBoundingClientRect();return{fits:nav.scrollWidth<=nav.clientWidth+1,rows:boxes.map(b=>Math.round(b.top+b.height/2)),inside:boxes.every(b=>b.left>=0&&b.right<=innerWidth+1),touch:boxes.every(b=>b.height>=44),bottom:Math.round(box.bottom),position:getComputedStyle(nav).position}});
    assert(geometry.fits&&geometry.inside,'Navigation fits its row at '+width);assert(geometry.rows.every(y=>Math.abs(y-geometry.rows[0])<=1),'One navigation row at '+width);
    if(width<=600){
      assert(geometry.touch,'Touch targets at '+width);
      assert.equal(geometry.position,'fixed');assert.equal(geometry.bottom,await page.evaluate(()=>innerHeight),'Phone navigation sits at the bottom');
      assert.equal(await page.locator('#navLogBtn').isVisible(),owner,'Log is in the bar only for editors');
      if(owner)assert.equal(await page.locator('#addBtn').isVisible(),false,'The bar replaces the header button on phones');
    }else assert.equal(await page.locator('#navLogBtn').isVisible(),false);
    await navigatePage(page,'passages');assert(await page.locator('#passages').isVisible());
    assert.equal(await page.locator('.tabs [aria-current="page"]:visible').count(),1);
    if(output&&[1600,390].includes(width)){await fs.mkdir(output,{recursive:true});await page.locator('.tabs').screenshot({path:path.join(output,(page.url().includes('personal')?'personal':owner?'owner':'guest')+'-navigation-'+width+'.png')});}
  }
  // Archive tools sit behind one control and are editor-only.
  await page.setViewportSize({width:1280,height:844});await settle(page);
  assert.equal(await page.locator('#settingsMenu').isVisible(),owner);
  if(owner){
    for(const name of ['metadata','import']){
      await navigatePage(page,name);assert(await page.locator('#'+name).isVisible());
      assert(await page.locator('#settingsMenu>summary').evaluate(node=>node.classList.contains('active')));
      assert.equal(await page.locator('.tabs [aria-current="page"]').count(),0);
    }
    await page.locator('#settingsMenu>summary').click();assert(await page.locator('#settingsMenu .menu-view[data-view="metadata"]').isVisible());
    await page.keyboard.press('Escape');assert.equal(await page.locator('#settingsMenu').getAttribute('open'),null);
    assert.equal(await page.evaluate(()=>document.activeElement.closest('#settingsMenu')!==null),true,'Escape returns focus to the control');
    await page.locator('#settingsMenu>summary').click();await page.mouse.click(10,600);
    assert.equal(await page.locator('#settingsMenu').getAttribute('open'),null,'An outside click closes the menu');
  }else assert.equal(await page.locator('[data-view="metadata"]:visible,[data-view="import"]:visible').count(),0);
  // Enlarged labels exercise measured overflow rather than viewport guessing.
  const enlarged=await page.addStyleTag({content:'.tabs>.tab,.tabs .more-menu>summary{font-size:44px!important}'});
  await page.setViewportSize({width:700,height:844});await page.evaluate(()=>layoutNavigation());await settle(page);
  assert(await page.locator('.tabs').evaluate(nav=>nav.scrollWidth<=nav.clientWidth+1));
  assert(await page.locator('#moreMenu').isVisible(),'Large labels move pages into More');
  assert(await page.locator('.tabs>.tab[data-view="home"]').isVisible(),'Home stays inline');
  await navigatePage(page,'insights');assert(await page.locator('#insights').isVisible());
  assert.equal(await page.locator('#moreMenuLabel').evaluate(node=>node.classList.contains('active')),!(await page.locator('.tabs>.tab[data-view="insights"]').isVisible()));
  await enlarged.evaluate(node=>node.remove());await page.evaluate(()=>layoutNavigation());await settle(page);
  assert.equal(await page.locator('#moreMenu').isVisible(),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),before,'Resizing and navigation never rewrite records');
  await page.setViewportSize(original);await page.evaluate(()=>showView('home'));await settle(page);
}
module.exports={checkNavigation,navigatePage};
