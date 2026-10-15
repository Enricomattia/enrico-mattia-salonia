// Read-only guest visual check. No login and no production writes.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
let target=new URL(process.env.PATHOS_ACCENT_PREVIEW||'http://127.0.0.1');
assert(target.hostname==='127.0.0.1'||/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/.test(target.hostname));
const server=http.createServer(async(req,res)=>{
 try{
  const name=new URL(req.url,'http://local').pathname;
  if(!/^\/pathos\/[a-z0-9.-]+$/.test(name))throw new Error();
  const bytes=await fs.readFile(path.join(__dirname,'../public',name));
  res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript'}).end(bytes);
 }catch{res.writeHead(404).end();}
});
let browser;
(async()=>{
 if(!process.env.PATHOS_ACCENT_PREVIEW){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));target=new URL('http://127.0.0.1:'+server.address().port);}
 browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({viewport:{width:1280,height:950}});
 await context.route('**/*.supabase.co/**',route=>{
  const request=route.request();
  assert(request.method()==='GET'||(request.method()==='POST'&&request.url().endsWith('/rpc/pathos_get_public_archive')),'Only guest read requests are allowed');
  return route.continue();
 });
 const page=await context.newPage(),errors=[];
 await page.emulateMedia({reducedMotion:'reduce'});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(target.origin+'/pathos/app.html');
 await page.waitForFunction(()=>document.querySelector('.pathos-sync-status')?.textContent==='Public archive');
 assert.equal(await page.evaluate(()=>window.pathosCanEdit),false);
 try {await page.waitForFunction(()=>document.querySelector('#homeTimelineTrack .has-cover-accent'),{},{timeout:25000});}
 catch(error){console.log(await page.evaluate(()=>({targets:document.querySelectorAll('#homeTimelineTrack [data-cover-accent]').length,images:[...document.querySelectorAll('#homeTimelineTrack img')].map(img=>({host:new URL(img.src).hostname,loaded:img.complete&&img.naturalWidth>0})),errors:[]})));throw error;}
 await page.waitForLoadState('networkidle',{timeout:15000}).catch(()=>{});
 const archive=await page.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive()));
 const output=process.env.PATHOS_UI_SCREENSHOTS||await fs.mkdtemp(path.join(os.tmpdir(),'pathos-accent-'));
 await fs.mkdir(output,{recursive:true});
 const accents=await page.locator('#homeTimelineTrack .has-cover-accent').count();
 await page.screenshot({path:path.join(output,'artwork-accent-desktop.png')});
 await page.evaluate(()=>document.querySelectorAll('.has-cover-accent').forEach(n=>n.classList.remove('has-cover-accent')));
 await page.screenshot({path:path.join(output,'artwork-neutral-desktop.png')});
 await page.evaluate(()=>document.querySelectorAll('[data-cover-accent]').forEach(n=>{if(n.style.getPropertyValue('--cover-accent'))n.classList.add('has-cover-accent');}));
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:path.join(output,'artwork-accent-mobile.png')});
 await page.evaluate(()=>showView('library'));
 await page.waitForFunction(()=>document.querySelector('#libraryGrid .has-cover-accent'));
 await page.setViewportSize({width:1280,height:950});
 await page.screenshot({path:path.join(output,'artwork-accent-library.png')});
 assert.equal(await page.evaluate(()=>JSON.stringify(window.pathosBridge.getArchive())),archive);
 assert.deepEqual(errors,[]);
 console.log(`PASS real guest artwork: ${accents} visible/recent cards accented, cover fallback intact, archive unchanged. Screenshots: ${output}`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}});
