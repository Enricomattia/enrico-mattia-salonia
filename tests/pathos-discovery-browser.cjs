/* Owner catalogue UI checks; synthetic archives and mocked services only. */
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright');
const {checkNavigation}=require('./pathos-navigation.cjs');
const root=path.resolve(__dirname,'../public');
const server=http.createServer(async(req,res)=>{
 try{const pathname=new URL(req.url,'http://local').pathname;if(!/^\/pathos\/[a-z0-9.-]+$/i.test(pathname))throw new Error();
 const body=await fs.readFile(path.join(root,pathname));res.writeHead(200,{'Content-Type':pathname.endsWith('.html')?'text/html':pathname.endsWith('.css')?'text/css':'text/javascript'}).end(body);
 }catch{res.writeHead(404).end();}
});
const item={provider:'openlibrary',id:'/works/OL123W',type:'Book',title:'An unfamiliar book',creator:'A new author',year:'2024',cover:'',genres:['Fiction','Memory'],description:'An intimate novel about family relationships, memory and emotional life, told in reflective, contemplative prose. '.repeat(2),sourceUrl:'https://openlibrary.org/works/OL123W'};
const fixture={schemaVersion:6,works:Array.from({length:6},(_,i)=>({id:'work-'+i,title:'Past work '+i,creator:'Past author',type:i%2?'Book':'Film',sourceMetadata:{genres:i<3?['Fiction','Memory']:['Technical reference']}})),experiences:Array.from({length:6},(_,i)=>({id:'exp-'+i,workId:'work-'+i,status:'completed',rating:i<3?5:1,review:i<3?'An intimate story about relationships, memory, reflective prose and emotional life.':'I disliked this dry technical reference about tax, legal compliance, database procedures and accounting.',isPublic:false,quotes:[{id:'q-'+i,text:'Private passage, must not be used for matching'}],edition:i%2?{isbn:'9780140328721',cover:'data:image/png;base64,private-cover'}:null}))};
let browser,context,origin;
const errors=[],apiCalls=[];
const moduleText=`export function createClient(){return {auth:{getUser:async()=>({data:{user:window.__owner?{id:window.PATHOS_CONFIG.ownerUserId}:null}}),getSession:async()=>({data:{session:window.__owner?{access_token:'synthetic-owner-access-token'}:null}}),signOut:async()=>{window.__owner=false;return{};}},rpc:async(name,args)=>{window.__rpc.push(name);if(name==='pathos_replace_my_archive'){window.__cloud=JSON.parse(JSON.stringify(args.p_archive));return{};}return{data:JSON.parse(JSON.stringify(window.__cloud))};}}}`;
(async()=>{
 if(process.env.PATHOS_DISCOVERY_PREVIEW){const target=new URL(process.env.PATHOS_DISCOVERY_PREVIEW);assert.match(target.hostname,/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/);origin=target.origin;}
 else {await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;}
 browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:1280,height:844}});
 await context.route('**/*',route=>route.request().url().startsWith(origin)||route.request().url().startsWith('data:')||(process.env.PATHOS_REAL_MODEL==='1'&&/^https:\/\/(?:cdn\.jsdelivr\.net|huggingface\.co|[^/]+\.hf\.co)\//.test(route.request().url()))?route.continue():route.abort());
 await context.route('https://cdn.jsdelivr.net/npm/@supabase/**',route=>route.fulfill({contentType:'text/javascript',body:moduleText}));
 await context.route('**/api/pathos/catalogue',async route=>{
  const request=route.request(),body=request.postDataJSON();apiCalls.push({body,headers:request.headers()});
  assert.equal(request.headers().authorization,'Bearer synthetic-owner-access-token');
  assert(!request.postData().includes('Past work')&&!request.postData().includes('Private passage')&&!request.postData().includes('An intimate story'));
  if(body.action==='check')return route.fulfill({json:{ok:true}});
  if(body.action==='search')return route.fulfill({json:{items:[body.type==='Film'?{...item,provider:'tmdb',id:'11',type:'Film',title:'An unfamiliar film',sourceUrl:'https://www.themoviedb.org/movie/11'}:item]}});
  return route.fulfill({json:{item:body.type==='Film'?{...item,provider:'tmdb',id:'11',type:'Film',title:'An unfamiliar film',sourceUrl:'https://www.themoviedb.org/movie/11'}:item}});
 });
 await context.route('https://openlibrary.org/works/OL123W/editions.json**',route=>route.fulfill({json:{entries:[]}}));
 await context.addInitScript(value=>{window.__cloud=value;window.__rpc=[];window.__owner=false;},fixture);
 const guest=await context.newPage();guest.on('pageerror',e=>errors.push(e.message));
 await guest.goto(origin+'/pathos/app.html');await guest.waitForFunction(()=>document.querySelector('.pathos-sync-status')?.textContent==='Public archive');
 await checkNavigation(guest,process.env.PATHOS_UI_SCREENSHOTS);
 assert.equal(await guest.locator('#discoverBtn').isVisible(),false);
 assert.equal(apiCalls.length,0,'Guests do not query the catalogue or load a model');
 // Spoofing the presentation flag cannot bypass the private auth closure.
 await guest.evaluate(()=>{window.pathosCanEdit=true;});
 await assert.rejects(guest.evaluate(()=>window.pathosOwnerCatalogue({action:'check'})),/Sign in/);assert.equal(apiCalls.length,0);
 await guest.close();
 await context.addInitScript(()=>{window.__owner=true;window.__workers=[];window.__messages=[];window.__NativeWorker=window.Worker;window.Worker=class{
  constructor(){window.__workers.push(this);}
  postMessage(data){window.__messages.push(data);if(data.type==='cancel')return;setTimeout(async()=>{
   const {evaluateMatch}=await import('/pathos/match-engine.mjs');
   const history=data.history.map((e,i)=>i===0?{...e,title:'<img src=x onerror=alert(1)>'}:e);
   const result=evaluateMatch(data.candidate,history,[1,0],history.map(e=>window.__forceRelated||e.rating>=4?[1,0]:[0,1]));
   this.onmessage?.({data:{id:data.id,type:'result',result}});
  },30);}
  terminate(){this.terminated=true;}
 };});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(origin+'/pathos/app.html');await page.waitForFunction(()=>window.pathosCanEdit);
 await checkNavigation(page,process.env.PATHOS_UI_SCREENSHOTS);
 const before=await page.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive()));
 await page.locator('#discoverBtn').click();await page.locator('#discoveryQuery').fill('An unfamiliar book');await page.locator('#discoveryForm button').click();
 await page.locator('.discover-result').click();await page.locator('#calculateMatch').waitFor();
 assert.equal(await page.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive())),before);
 assert.equal(await page.evaluate(()=>window.__workers.length),0,'Preview does not download a model until requested');
 await page.locator('#calculateMatch').click();await page.locator('.discover-match-title').waitFor();
 assert.equal(await page.locator('.discover-match-title').textContent(),'Strong match');
 assert.equal(await page.locator('.discover-evidence img').count(),0,'Evidence must render as text');
 assert.equal(await page.locator('.discover-evidence strong').first().textContent(),'<img src=x onerror=alert(1)>');
 assert.match(await page.locator('.discover-match-explanation').innerText(),/5\/5/);
 assert.match(await page.locator('.discover-match-explanation').innerText(),/Fiction, Memory/);
 assert.match(await page.locator('.discover-match-uncertainty').innerText(),/Confidence is low because/);
 assert.equal(await page.locator('.discover-match-explanation img').count(),0);
 const payload=await page.evaluate(()=>window.__messages.find(x=>x.type==='match'));
 assert.equal(payload.history.length,6);assert(!JSON.stringify(payload).includes('Private passage'));assert(!JSON.stringify(payload).includes('private-cover'));
 assert.equal(await page.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive())),before);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  assert(await page.locator('#discoveryDialog').evaluate(n=>n.scrollWidth<=n.clientWidth));
  const box=await page.locator('#discoveryDialog').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(process.env.PATHOS_UI_SCREENSHOTS||os.tmpdir(),'pathos-discovery-mobile.png')});
 await page.locator('#matchResult').screenshot({path:path.join(process.env.PATHOS_UI_SCREENSHOTS||os.tmpdir(),'pathos-match-explanation-mobile.png')});
 // One rated record, an unrated review and an empty archive all explain their limits.
 await page.evaluate(()=>{window.__beforeSparse=window.pathosBridge.getArchive();window.pathosBridge.setArchive({...window.__beforeSparse,works:window.__beforeSparse.works.slice(0,1),experiences:window.__beforeSparse.experiences.slice(0,1)});});
 await page.locator('#calculateMatch').click();
 await page.waitForFunction(()=>document.querySelector('.discover-match-title').textContent==='Not enough evidence');
 assert.match(await page.locator('.discover-match-explanation').innerText(),/5\/5/);
 assert.match(await page.locator('.discover-match-uncertainty').innerText(),/one distinct close rated comparison/);
 await page.evaluate(()=>{const value=window.pathosBridge.getArchive();value.experiences[0].rating='';window.pathosBridge.setArchive(value);window.__forceRelated=true;});
 await page.locator('#calculateMatch').click();
 await page.waitForFunction(()=>document.querySelector('.discover-evidence .meta')?.textContent.includes('unrated'));
 assert.match(await page.locator('.discover-match-explanation').innerText(),/without being treated as a like or dislike/);
 const matchesBefore=await page.evaluate(()=>window.__messages.filter(m=>m.type==='match').length);
 await page.evaluate(()=>window.pathosBridge.setArchive({schemaVersion:6,works:[],experiences:[]}));
 await page.locator('#calculateMatch').click();
 assert.match(await page.locator('.discover-match-uncertainty').innerText(),/no close rated comparison/);
 assert.equal(await page.evaluate(()=>window.__messages.filter(m=>m.type==='match').length),matchesBefore,'Empty history needs no model request');
 await page.evaluate(()=>{window.pathosBridge.setArchive(window.__beforeSparse);window.__forceRelated=false;});
 assert.equal(await page.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive())),before);
 await page.getByRole('button',{name:'Add to Planned',exact:true}).click();
 assert.equal(await page.locator('#entryForm [name="status"]').inputValue(),'planned');
 assert.equal(await page.locator('#entryForm [name="cover"]').inputValue(),'','A generic work cover must not become an exact edition cover');
 assert.equal(await page.locator('#entryForm [name="editionIsbn"]').inputValue(),'');
 assert.equal(await page.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive())),before,'Opening the plan form does not save');
 await page.locator('#entryForm button[type="submit"]').click();await page.waitForFunction(()=>window.__cloud.experiences.length===7);
 const saved=await page.evaluate(()=>window.__cloud);assert.deepEqual(saved.experiences.slice(0,6),JSON.parse(before).experiences);assert.equal(saved.experiences[6].status,'planned');assert.equal(saved.works[6].external.openlibraryKey,item.id);
 await page.locator('#discoverBtn').click();await page.locator('#discoveryType').selectOption('Film');await page.locator('#discoveryQuery').fill('A film');await page.locator('#discoveryForm button').click();await page.locator('.discover-result').click();
 await page.locator('#calculateMatch').waitFor();assert(await page.locator('.discover-credits').innerText().then(t=>t.includes('Catalogue')));
 await page.locator('#closeDiscovery').click();
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Owner header fits the phone');
  const find=await page.locator('#discoverBtn').boundingBox(),add=await page.locator('#addBtn').boundingBox();assert(find.x+find.width<=add.x,'Find and Add do not overlap');
 }
 await page.locator('.pathos-auth-control').click();await page.waitForFunction(()=>!window.pathosCanEdit);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('.tabs>.tab[data-view="metadata"]').isVisible(),false);assert.equal(await page.locator('.tabs>.tab[data-view="import"]').isVisible(),false);
 assert.equal(await page.locator('#moreMenu').isVisible(),false,'Signing out leaves only pages that fit in the phone row');
 assert.equal(await page.locator('#discoverBtn').isVisible(),false);assert.equal(await page.locator('#discoveryPreview').textContent(),'');
 assert.equal(await page.evaluate(()=>window.__workers.every(w=>w.terminated)),true);
 if(process.env.PATHOS_REAL_MODEL==='1'){
  const real=await context.newPage();real.on('pageerror',e=>errors.push(e.message));
  const external=[];real.on('request',r=>{if(!r.url().startsWith(origin))external.push({url:r.url(),method:r.method(),body:r.postData()});});
  await real.goto(origin+'/pathos/app.html');await real.waitForFunction(()=>window.pathosCanEdit);
  await real.evaluate(()=>{window.Worker=window.__NativeWorker;});
  const initial=await real.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive()));
  await real.locator('#discoverBtn').click();await real.locator('#discoveryQuery').fill('An unfamiliar book');await real.locator('#discoveryForm button').click();await real.locator('.discover-result').click();
  await real.locator('#calculateMatch').click();await real.locator('.discover-match-title').waitFor({timeout:240000});
  assert.equal(await real.locator('.discover-match-title').textContent(),'Strong match');
  assert.equal(await real.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive())),initial);
  assert(external.some(r=>r.url.includes('model_quantized.onnx')),'Real model weights were requested');
  assert(external.every(r=>['GET','HEAD'].includes(r.method)&&!r.body),'Only model assets leave the browser');
  console.log('PASS full owner preview → real multilingual local inference → grounded match, with no uploads or archive changes.');
  await real.locator('#matchResult').scrollIntoViewIfNeeded();
  await real.screenshot({path:path.join(process.env.PATHOS_UI_SCREENSHOTS||os.tmpdir(),'pathos-real-match.png')});
  await real.close();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS owner-only discovery: public gate, search/preview, local matching, XSS-safe evidence, no uploads, mobile fit, explicit planned save, exact-edition protection and logout cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await context?.close();await browser?.close();if(server.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}});
