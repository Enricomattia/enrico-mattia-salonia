const assert=require('node:assert/strict');
const path=require('node:path');
async function checkReviewFormatting(page,{backup,restore,outputDirectory}){
 const original=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
 const field=page.locator('#reviewInput'),preview=page.locator('#reviewPreview');
 const command=name=>page.locator('[data-review-command="'+name+'"]');
 const select=async(start,end)=>field.evaluate((el,range)=>{el.focus();el.setSelectionRange(...range)},[start,end]);
 const settle=()=>page.waitForFunction(()=>(typeof pendingWrites==='undefined'||pendingWrites===0)&&!archiveBusy);
 const open=()=>page.evaluate(()=>openEntryDialog());
 await page.setViewportSize({width:1280,height:900});
 await open();await page.locator('#entryForm [name="type"]').selectOption('Film');
 await page.locator('#entryForm [name="title"]').fill('Formatting fixture');
 await page.locator('#entryForm [name="endDate"]').fill('2026-10-28');
 await field.fill('Bold italic');await select(0,4);await command('bold').click();assert.equal(await field.inputValue(),'**Bold** italic');
 await command('italic').click();assert.equal(await field.inputValue(),'***Bold*** italic','Italic nests inside bold');
 await command('italic').click();await command('bold').click();assert.equal(await field.inputValue(),'Bold italic','Formatting toggles off');
 await select(5,11);await field.press('Control+i');assert.equal(await field.inputValue(),'Bold *italic*');
 await field.fill(' spaced ');await select(0,8);await command('bold').click();assert.equal(await field.inputValue(),' **spaced** ');
 await field.fill('');await command('quote').click();await page.keyboard.type('A quote');assert.equal(await field.inputValue(),'> A quote');
 for(const [name,prefix] of [['bullet','- '],['number','1. ']]){
   await field.fill('First\nSecond');await select(0,12);await command(name).click();assert((await field.inputValue()).startsWith(prefix));
   await command(name).click();assert.equal(await field.inputValue(),'First\nSecond');
 }
 await field.fill('Reference');await select(0,9);await command('link').click();await page.keyboard.type('https://example.com');assert.equal(await field.inputValue(),'[Reference](https://example.com)');
 await field.fill('Original');await select(0,8);await command('bold').click();await field.press('Control+z');assert.equal(await field.inputValue(),'Original','Toolbar changes can be undone');
 const source='A **bold** and *italic* review with ~~cuts~~.\n\n> A quotation\n\n- First\n- Second\n\n1. One\n2. Two\n\n[Reference](https://example.com)';
 await field.fill(source);await page.locator('[data-review-preview]').click();assert(await preview.isVisible());assert.equal(await field.isVisible(),false);
 for(const selector of ['strong','em','s','blockquote','ul','ol','a'])assert.equal(await preview.locator(selector).count(),1);
 const expected=await preview.innerHTML();
 if(outputDirectory){await page.screenshot({path:path.join(outputDirectory,'review-preview-desktop.png')});}
 await page.setViewportSize({width:320,height:760});
 assert.equal(await page.locator('#entryDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 assert.equal(await page.locator('.review-toolbar').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 assert.equal(await command('bold').evaluate(el=>el.getBoundingClientRect().height>=44),true);
 if(outputDirectory){await preview.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(outputDirectory,'review-preview-mobile.png')});}
 await page.locator('#entryForm button[type="submit"]').click();await settle();
 const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(db))),entry=saved.experiences.at(-1);
 assert.equal(entry.review,source);assert.equal(saved.schemaVersion,6);
 await page.evaluate(id=>openExperiencePage(id),entry.id);
 assert.equal(await page.locator('#experience-'+entry.id+' .experience-review').innerHTML(),expected,'Reading and preview use identical safe HTML');
 await page.locator('#closeWorkDialog').click();
 await page.evaluate(()=>showView('home'));
 assert.match(await page.locator('[data-exp="'+entry.id+'"] .diary-excerpt').innerText(),/A bold and italic review/);
 assert.doesNotMatch(await page.locator('[data-exp="'+entry.id+'"] .diary-excerpt').innerText(),/\*\*|https:\/\//);
 await page.evaluate(()=>showView('library'));await page.locator('#searchInput').fill('bold and italic');assert.equal(await page.locator('.work-card').count(),1);await page.locator('#searchInput').fill('');
 assert.equal(await page.evaluate(id=>reviewWords(db.experiences.find(e=>e.id===id)),entry.id),14);
 const exported=await backup(page);assert.equal(exported.experiences.at(-1).review,source);await restore(page,exported);
 assert.deepEqual(await page.evaluate(()=>({works:db.works,experiences:db.experiences})),{works:saved.works,experiences:saved.experiences});
 await page.reload();await page.waitForFunction(()=>window.pathosCanEdit);
 await page.evaluate(id=>openExperience(id),entry.id);assert.equal(await field.inputValue(),source);assert(await field.isVisible());
 await field.fill('Cancelled change');await page.locator('#cancelBtn').click();assert.equal(await page.evaluate(id=>db.experiences.find(e=>e.id===id).review,entry.id),source);
 await open();assert.equal(await field.inputValue(),'');assert(await field.isVisible());
 const attack='<img src=x onerror="window.reviewAttack=1">\n<script>window.reviewAttack=1</script>\n[bad](javascript:alert(1))\n![pixel](https://example.com/pixel.png)';
 await field.fill(attack);await page.locator('[data-review-preview]').click();assert.equal(await preview.locator('img,script,iframe,svg').count(),0);assert.equal(await page.evaluate(()=>window.reviewAttack),undefined);await page.locator('#cancelBtn').click();
 if(await page.evaluate(()=>location.pathname.includes('personal'))){
   await page.context().setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
   assert.equal(await page.evaluate(id=>db.experiences.find(e=>e.id===id).review,entry.id),source);
   await page.evaluate(id=>openExperience(id),entry.id);await field.fill(source+'\n\nOffline **addition**.');await page.locator('#entryForm button[type="submit"]').click();await settle();
   await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);await page.evaluate(id=>openExperiencePage(id),entry.id);
   assert.equal(await page.locator('#experience-'+entry.id+' .experience-review strong').last().innerText(),'addition');await page.locator('#closeWorkDialog').click();
   await page.context().setOffline(false);
 }
 await page.setViewportSize({width:1280,height:900});await restore(page,original);
}
module.exports={checkReviewFormatting};
