const assert=require('node:assert/strict');
const path=require('node:path');
async function checkReviewFormatting(page,{backup,restore,outputDirectory}){
 const original=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
 const field=page.getByRole('textbox',{name:'Review',exact:true});
 const source=page.locator('#reviewInput');
 const command=name=>page.locator('[data-review-command="'+name+'"]');
 const settle=()=>page.waitForFunction(()=>(typeof pendingWrites==='undefined'||pendingWrites===0)&&!archiveBusy);
 const load=async value=>source.evaluate((el,text)=>{el.value=text;el.dispatchEvent(new Event('input',{bubbles:true}))},value);
 const select=async(start,end)=>{
  await field.evaluate((el,range)=>{
   el.focus();const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node,offset=0,first,last;
   while(node=walker.nextNode()){
    if(!first&&offset+node.length>=range[0])first=[node,range[0]-offset];
    if(offset+node.length>=range[1]){last=[node,range[1]-offset];break;}
    offset+=node.length;
   }
   const selection=getSelection(),r=document.createRange();r.setStart(...first);r.setEnd(...last);selection.removeAllRanges();selection.addRange(r);
  },[start,end]);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 };
 await page.setViewportSize({width:1280,height:900});
 await page.evaluate(()=>openEntryDialog());
 await page.locator('#entryForm [name="type"]').selectOption('Film');
 await page.locator('#entryForm [name="title"]').fill('Formatting fixture');
 await page.locator('#entryForm [name="endDate"]').fill('2026-10-28');
 assert.equal(await source.isVisible(),false);
 assert.equal(await field.getAttribute('contenteditable'),'true');
 assert.equal(await page.locator('[data-review-preview]').count(),0);
 await field.fill('Bold italic');await select(0,4);await command('bold').click();
 assert.equal(await field.locator('strong').innerText(),'Bold');assert.equal(await field.innerText(),'Bold italic');
 await command('italic').click();assert.equal(await field.locator('em').innerText(),'Bold');
 await command('italic').click();await command('bold').click();assert.equal(await field.locator('strong,em').count(),0);
 await select(5,11);await field.press('Control+i');assert.equal(await field.locator('em').innerText(),'italic');
 await field.press('Control+z');assert.equal(await field.locator('em').count(),0);
 await field.press('Control+Shift+z');assert.equal(await field.locator('em').innerText(),'italic');
 await load('');await command('bold').click();assert.equal(await command('bold').getAttribute('aria-pressed'),'true');
 await page.keyboard.insertText('Typing in bold');assert.equal(await field.locator('strong').innerText(),'Typing in bold');
 await command('bold').click();await page.keyboard.insertText(' and plain');assert.equal(await field.innerText(),'Typing in bold and plain');
 assert.equal(await field.locator('strong').innerText(),'Typing in bold');
 await load('');await command('quote').click();await page.keyboard.insertText('A quotation');assert.equal(await field.locator('blockquote').innerText(),'A quotation');
 await command('quote').click();assert.equal(await field.locator('blockquote').count(),0);
 for(const [name,tag] of [['bullet','ul'],['number','ol']]){
  await load('');await command(name).click();await page.keyboard.insertText('First');await field.press('Enter');await page.keyboard.insertText('Second');
  assert.equal(await field.locator(tag+' li').count(),2,'Enter continues a list');
  await field.press('Enter');await field.press('Enter');await page.keyboard.insertText('Outside');assert.equal(await field.locator(tag+' li').count(),2,'An empty item exits the list');
 }
 await load('Reference');await select(0,9);await command('link').click();
 const url=page.locator('[data-review-link-url]');await url.fill('javascript:alert(1)');await url.press('Enter');assert(await page.locator('[data-review-link-error]').isVisible());assert.equal(await field.locator('a').count(),0);
 await url.fill('https://example.com');await url.press('Enter');assert.equal(await field.locator('a').getAttribute('href'),'https://example.com');
 assert.equal(await page.locator('#entryDialog').evaluate(el=>el.open),true,'Entering a link does not submit the entry');
 await select(1,1);await command('link').click();assert.equal(await url.inputValue(),'https://example.com');await page.locator('[data-review-link-remove]').click();assert.equal(await field.locator('a').count(),0);
 await select(0,9);await command('link').click();await url.fill('https://cancelled.example');await url.press('Escape');assert.equal(await field.locator('a').count(),0);assert.equal(await page.locator('#entryDialog').evaluate(el=>el.open),true);
 await load('[**First** second](https://example.com)');await select(8,8);await command('link').click();await page.locator('[data-review-link-remove]').click();assert.equal(await field.locator('a').count(),0,'Removing a link includes differently formatted parts');assert.equal(await field.locator('strong').innerText(),'First');

 // Existing Markdown is loaded visually; no edit must preserve its exact source.
 const review='A **bold** and *italic* review with ~~cuts~~.\n\n> A quotation\n\n- First\n- Second\n\n1. One\n2. Two\n\n[Reference](https://example.com)  \n';
 await load(review);
 for(const selector of ['strong','em','s','blockquote','ul','ol','a'])assert.equal(await field.locator(selector).count(),1);
 assert.doesNotMatch(await field.innerText(),/\*\*|~~|\]\(https:/);
 if(outputDirectory){await field.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(outputDirectory,'review-direct-desktop.png')});}
 await page.setViewportSize({width:320,height:760});
 assert.equal(await page.locator('#entryDialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 assert.equal(await page.locator('.review-toolbar').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 assert.equal(await command('bold').evaluate(el=>el.getBoundingClientRect().height>=44),true);
 if(outputDirectory){await field.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(outputDirectory,'review-direct-mobile.png')});}
 await page.locator('#entryForm button[type="submit"]').click();await settle();
 let saved=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));const id=saved.experiences.at(-1).id;
 assert.equal(saved.experiences.at(-1).review,review);assert.equal(saved.schemaVersion,6);
 await page.evaluate(id=>openExperiencePage(id),id);
 assert.equal(await page.locator('#experience-'+id+' .experience-review strong').innerText(),'bold');await page.locator('#closeWorkDialog').click();
 await page.evaluate(()=>showView('home'));
 assert.match(await page.locator('[data-exp="'+id+'"] .diary-excerpt').innerText(),/A bold and italic review/);
 assert.doesNotMatch(await page.locator('[data-exp="'+id+'"] .diary-excerpt').innerText(),/\*\*|https:\/\//);
 await page.evaluate(()=>showView('library'));await page.locator('#searchInput').fill('bold and italic');assert.equal(await page.locator('.work-card').count(),1);await page.locator('#searchInput').fill('');
 assert.equal(await page.evaluate(id=>reviewWords(db.experiences.find(e=>e.id===id)),id),14);
 await page.evaluate(id=>openExperience(id),id);assert.equal(await field.locator('strong').innerText(),'bold');
 await page.locator('#entryForm [name="rating"]').fill('4.5');await page.locator('#entryForm button[type="submit"]').click();await settle();assert.equal(await source.inputValue(),review,'An unrelated save preserves the source');
 await page.evaluate(id=>openExperience(id),id);await select(2,6);await command('bold').click();await field.press('Control+z');assert.equal(await source.inputValue(),review,'Undo restores the exact original string');
 await field.fill('Cancelled change');await page.locator('#cancelBtn').click();assert.equal(await page.evaluate(id=>db.experiences.find(e=>e.id===id).review,id),review);
 saved=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));const exported=await backup(page);await restore(page,exported);
 assert.deepEqual(await page.evaluate(()=>({works:db.works,experiences:db.experiences})),{works:saved.works,experiences:saved.experiences});
 await page.reload();await page.waitForFunction(()=>window.pathosCanEdit);await page.evaluate(id=>openExperience(id),id);
 assert.equal(await field.locator('strong').innerText(),'bold');assert.equal(await source.inputValue(),review);

 // Literal text and pasted HTML cannot introduce executable markup or image fetches.
 await load('');const requests=[];const record=request=>{if(request.url().includes('review-paste.invalid'))requests.push(request.url())};page.on('request',record);
 await field.evaluate(el=>{
  const data=new DataTransfer();data.setData('text/plain','Pasted bold bad link');
  data.setData('text/html','<p><strong>Pasted bold</strong> <a href="javascript:alert(1)">bad link</a><img src="https://review-paste.invalid/pixel.png" onerror="window.reviewAttack=1"><script>window.reviewAttack=1</script></p>');
  el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
 });
 assert.equal(await field.locator('strong').innerText(),'Pasted bold');assert.equal(await field.locator('a,img,script,iframe,svg').count(),0);assert.equal(await page.evaluate(()=>window.reviewAttack),undefined);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));assert.deepEqual(requests,[]);page.off('request',record);
 await load('');await field.fill('Literal **stars** & <img src=x>');assert.equal(await field.locator('strong,img').count(),0);
 assert.match(await source.inputValue(),/\\\*\\\*stars/);
 await page.locator('#cancelBtn').click();
 if(await page.evaluate(()=>location.pathname.includes('personal'))){
  await page.context().setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
  await page.evaluate(id=>openExperience(id),id);assert.equal(await field.locator('strong').innerText(),'bold');
  await field.press('Control+End');await field.press('Enter');await command('bold').click();await page.keyboard.insertText('Offline addition');
  await page.locator('#entryForm button[type="submit"]').click();await settle();await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady);
  await page.evaluate(id=>openExperiencePage(id),id);assert.equal(await page.locator('#experience-'+id+' .experience-review strong').last().innerText(),'Offline addition');await page.locator('#closeWorkDialog').click();
  await page.context().setOffline(false);
 }
 await page.setViewportSize({width:1280,height:900});await restore(page,original);
}
module.exports={checkReviewFormatting};
