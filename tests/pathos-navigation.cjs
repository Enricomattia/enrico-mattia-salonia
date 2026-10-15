// Navigation-only checks. No archive writes or remote requests.
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs/promises');
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function navigatePage(page,name){
  await settle(page);const direct=page.locator('.tabs>.tab[data-view="'+name+'"]');
  if(await direct.isVisible())await direct.click();else{await page.locator('#moreMenuLabel').click();await page.locator('#moreMenu .menu-view[data-view="'+name+'"]').click()}
  await settle(page);
}
async function checkNavigation(page,output){
  const before=await page.evaluate(()=>JSON.stringify(db)),original=page.viewportSize(),owner=await page.evaluate(()=>window.pathosCanEdit);
  const pages=owner?['home','library','timeline','passages','insights','metadata','import']:['home','library','timeline','passages','insights'];
  assert.deepEqual(await page.locator('.tabs>.tab').evaluateAll(nodes=>nodes.map(node=>node.dataset.view)),['home','library','timeline','passages','insights','metadata','import']);
  for(const width of [1600,1180,1024,850,768,601,600,480,390,320]){
    await page.setViewportSize({width,height:844});await settle(page);
    const visible=await page.locator('.tabs>.tab').evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>node.dataset.view));
    const overflow=await page.locator('#moreMenu .menu-view').evaluateAll(nodes=>nodes.filter(node=>!node.hidden).map(node=>node.dataset.view));
    assert.deepEqual([...visible,...overflow].sort(),[...pages].sort(),'Every allowed page has exactly one route at '+width);
    assert.equal(new Set([...visible,...overflow]).size,pages.length);
    assert.equal(await page.locator('#moreMenu').isVisible(),overflow.length>0,'More exists only for actual overflow');
    if(width>=1024){assert.deepEqual(visible,pages);assert.equal(overflow.length,0);}
    const geometry=await page.locator('.tabs').evaluate(nav=>{const nodes=[...nav.children].filter(node=>node.getClientRects().length);const boxes=nodes.map(node=>node.getBoundingClientRect());return{fits:nav.scrollWidth<=nav.clientWidth+1,rows:boxes.map(box=>box.top),inside:boxes.every(box=>box.left>=0&&box.right<=innerWidth+1),touch:boxes.every(box=>box.height>=44)}});
    assert(geometry.fits&&geometry.inside,'Navigation fits its row at '+width);assert(geometry.rows.every(y=>Math.abs(y-geometry.rows[0])<1),'One navigation row');if(width<=600)assert(geometry.touch);
    await navigatePage(page,'passages');assert(await page.locator('#passages').isVisible());
    assert.equal(await page.locator('.tabs [aria-current="page"]:visible').count(),1);
    assert.equal(await page.locator('#moreMenuLabel').evaluate(node=>node.classList.contains('active')),overflow.includes('passages'));
    if(output&&[1600,390].includes(width)){await fs.mkdir(output,{recursive:true});await page.locator('.tabs').screenshot({path:path.join(output,(page.url().includes('personal')?'personal':owner?'owner':'guest')+'-navigation-'+width+'.png')});}
  }
  // Enlarged labels exercise measured overflow rather than viewport guessing.
  const enlarged=await page.addStyleTag({content:'.tabs>.tab,.tabs .more-menu>summary{font-size:20px!important}'});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>layoutNavigation());await settle(page);
  assert(await page.locator('.tabs').evaluate(nav=>nav.scrollWidth<=nav.clientWidth+1));await navigatePage(page,'insights');assert(await page.locator('#insights').isVisible());
  await enlarged.evaluate(node=>node.remove());
  // A focused inline link moves safely into More when resized and back again.
  await page.setViewportSize({width:1600,height:844});await settle(page);await navigatePage(page,'passages');await page.locator('.tabs>.tab[data-view="passages"]').focus();
  await page.setViewportSize({width:320,height:844});await settle(page);
  if(!(await page.locator('.tabs>.tab[data-view="passages"]').isVisible())){
    assert.equal(await page.evaluate(()=>document.activeElement.id),'moreMenuLabel');await page.locator('#moreMenuLabel').click();await page.locator('#moreMenu .menu-view[data-view="passages"]').focus();
    await page.setViewportSize({width:1600,height:844});await settle(page);assert.equal(await page.evaluate(()=>document.activeElement.dataset.view),'passages');assert.equal(await page.locator('#moreMenu').getAttribute('open'),null);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),before,'Resizing and navigation never rewrite records');
  await page.setViewportSize(original);await page.evaluate(()=>showView('home'));await settle(page);
}
module.exports={checkNavigation,navigatePage};
