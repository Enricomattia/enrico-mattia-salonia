// Isolated archives, a real OAuth popup/callback, and a synthetic Netlify API.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const{chromium}=require('playwright');
const root=path.resolve(__dirname,'../public'),output=process.env.PATHOS_UI_SCREENSHOTS||path.resolve(__dirname,'../output/pathos-publishing');
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;if(!/^\/pathos-personal\/(fonts\/)?[a-z0-9.-]+$/i.test(p)){res.writeHead(404).end();return;}const body=await fs.readFile(path.join(root,p));res.writeHead(200,{'Cache-Control':'no-store','Content-Type':p.endsWith('.html')?'text/html':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.woff2')?'font/woff2':p.endsWith('.png')?'image/png':'application/manifest+json'}).end(body);}catch{res.writeHead(404).end();}});
let browser,origin;
(async()=>{
  if(process.env.PATHOS_PUBLISH_PREVIEW){const target=new URL(process.env.PATHOS_PUBLISH_PREVIEW);if(target.origin!=='https://enricomattiasalonia.com')assert.match(target.hostname,/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/);origin=target.origin;}else{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;}
  await fs.mkdir(output,{recursive:true});browser=await chromium.launch({channel:process.env.PATHOS_BROWSER||'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true}),calls=[],errors=[];
  let site,metadata={},deployNumber=0,uploaded={},failUpload=false,mismatch=false,authConfigured=true;
  const token='synthetic-publishing-access-token';
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin){if(url.pathname.endsWith('/publish-config.js'))return route.fulfill({contentType:'text/javascript',body:'window.PATHOS_PUBLISH_CONFIG={netlifyClientId:'+(authConfigured?'"synthetic-client-id"':'""')+'};'});return route.continue();}
    if(url.hostname==='app.netlify.com'&&url.pathname==='/authorize'){
      assert.equal(url.searchParams.get('response_type'),'token');
      const callback=new URL(url.searchParams.get('redirect_uri'));assert.equal(callback.origin,origin);callback.hash=new URLSearchParams({access_token:token,state:url.searchParams.get('state')}).toString();
      return route.fulfill({contentType:'text/html',body:'<script>location.href='+JSON.stringify(callback.href)+'</script>'});
    }
    if(url.hostname==='api.netlify.com'){
      const p=url.pathname.replace('/api/v1',''),method=request.method(),body=request.postData()||'';
      calls.push({p,method,body});assert.equal(request.headers().authorization,'Bearer '+token);
      for(const marker of ['UNSELECTED_','PRIVATE_','RECORD_SECRET'])assert(!body.includes(marker),'Publication leak: '+marker);
      let value={};
      if(p==='/user')value={id:'user-123',full_name:'Synthetic publisher'};
      else if(p==='/accounts')value=[{id:'team-123',slug:'test-team',name:'My test team'}];
      else if(p==='/test-team/sites'){const json=request.postDataJSON();site={id:'site-123',account_id:'team-123',name:json.name,build_settings:{}};value=site;}
      else if(p==='/sites/site-123/metadata'&&method==='PUT'){metadata=request.postDataJSON();return route.fulfill({status:204});}
      else if(p==='/sites/site-123/metadata')value=mismatch?{...metadata,pathos_id:'another-publisher'}:metadata;
      else if(p==='/sites/site-123')value=site;
      else if(p==='/sites/site-123/deploys'&&method==='POST'){const json=request.postDataJSON();assert.equal(json.draft,true);deployNumber++;value={id:'deploy-'+deployNumber,site_id:site.id,required:Object.values(json.files)};}
      else if(p.includes('/files/')){if(failUpload)return route.fulfill({status:500,json:{}});uploaded[p.slice(p.indexOf('/files/')+6)]=body;}
      else if(p.endsWith('/restore'))value={id:'deploy-'+deployNumber,site_id:site.id};
      else if(p.startsWith('/sites/site-123/deploys/'))value={id:'deploy-'+deployNumber,site_id:site.id,state:'ready'};
      else throw new Error('Unexpected Netlify operation '+p);
      return route.fulfill({json:value});
    }
    return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error: '+error.message);});page.on('dialog',dialog=>dialog.accept());
  await page.goto(origin+'/pathos-personal/index.html');await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosPublishing);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const fixture={schemaVersion:6,works:[{id:'book-1',type:'Book',title:'A selected book',creator:'Test author',owned:true,cover:'https://example.com/PRIVATE_COVER.jpg',sourceMetadata:{secret:'PRIVATE_METADATA'}}],experiences:[{id:'reading-1',workId:'book-1',status:'completed',endDate:'2026-11-07',rating:4.25,review:'Selected **formatted** review $& <script>window.attack=1</script>',tags:['PRIVATE_TAG'],details:{secret:'RECORD_SECRET'},quotes:[{id:'q-1',text:'A selected passage',note:'p. 2'}],edition:{publisher:'Selected publisher',sourceId:'PRIVATE_UID',isbn:'9780140328721'}},{id:'reading-2',workId:'book-1',status:'completed',endDate:'2026-11-06',rating:2,review:'UNSELECTED_REVIEW',quotes:[{id:'q-2',text:'UNSELECTED_PASSAGE'}]}]};
  await page.locator('#restoreInput').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.waitForFunction(()=>!document.getElementById('restoreInput').value&&pendingWrites===0&&!archiveBusy);
  const before=await page.evaluate(()=>JSON.stringify(db)),disk=await page.evaluate(()=>readLocalArchive());
  await page.locator('#settingsMenu>summary').click();await page.locator('#settingsMenu [data-view="publishing"]').click();
  assert.equal(await page.locator('#publishEntries input:checked').count(),0,'No existing entry becomes public automatically');
  assert.equal(await page.locator('#publishUsername').inputValue(),'');
  await page.locator('#publishUsername').fill('<img src=x onerror=alert(1)>');
  await page.locator('#publishTitle').fill('Synthetic public diary');await page.locator('[data-publish-entry="reading-1"]').check();
  await page.locator('#publishPreviewBtn').click();await page.locator('#publishPreviewWrap').waitFor();
  const frame=page.frameLocator('#publishPreview');await frame.locator('#profileTitle').getByText('Synthetic public diary').waitFor();
  assert.equal(await frame.locator('#profileUsername').innerText(),'<img src=x onerror=alert(1)>');assert.equal(await frame.locator('#profileUsername img').count(),0,'A username is literal text');
  await page.locator('#publishUsername').fill('maria');assert.equal(await page.locator('#publishPreviewWrap').isVisible(),false,'Changing a username invalidates the approved copy');
  await page.locator('#publishPreviewBtn').click();await page.locator('#publishPreviewWrap').waitFor();await frame.locator('#profileUsername').getByText('maria',{exact:true}).waitFor();
  await frame.locator('#diary [data-work]').waitFor();assert.equal(await frame.locator('#diary [data-work]').count(),1);
  await frame.locator('#diary [data-work]').click();assert.equal(await frame.locator('.review strong').innerText(),'formatted');assert.equal(await frame.locator('script[src],input,textarea').count(),1,'Only the reader search input exists');
  assert.equal(await frame.locator('#workBody').getByText('UNSELECTED_REVIEW').count(),0);
  assert.equal(await frame.locator('.review script').count(),0);
  await frame.locator('#closeWork').click();
  const html=await page.locator('#publishPreview').getAttribute('srcdoc');for(const marker of ['PRIVATE_','UNSELECTED_','RECORD_SECRET',token,'publish-config','indexedDB'])assert(!html.includes(marker),marker);
  const reader=await context.newPage();await reader.setContent(html);await reader.locator('#profileUsername').getByText('maria',{exact:true}).waitFor();
  for(const width of [1280,390,320]){await reader.setViewportSize({width,height:800});assert(await reader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const logo=await reader.locator('h1').boundingBox(),name=await reader.locator('#profileUsername').boundingBox();assert(Math.abs(name.y-logo.y)<45,'Username is next to the Πathos wordmark');await reader.screenshot({path:path.join(output,'public-username-'+width+'.png'),fullPage:true});}await reader.close();
  await frame.getByRole('button',{name:'Library',exact:true}).click();assert.equal(await frame.locator('.book').count(),1);
  await frame.getByRole('button',{name:'Passages',exact:true}).click();assert.equal(await frame.locator('#quotes .passage').count(),1);
  await frame.getByRole('button',{name:'Insights',exact:true}).click();assert.match(await frame.locator('#stats').innerText(),/4.25/);
  // An unrelated postMessage cannot manufacture an authenticated connection.
  await page.evaluate(()=>postMessage({type:'pathos-netlify-auth',state:'fake',token:'fake-token'},location.origin));assert.equal(calls.length,0);
  await page.locator('#publishConnectBtn').click();await page.locator('#publishConnectionStatus').getByText('Connected as Synthetic publisher.').waitFor();
  assert.equal(await page.locator('#publishUsername').inputValue(),'maria','Netlify identity never replaces the chosen public username');
  assert(await page.locator('#publishNowBtn').isDisabled());await page.locator('#publishApproved').check();
  await page.locator('#publishNowBtn').click();await page.locator('#publishProgress[data-state="success"]').waitFor();
  assert.equal(uploaded['/index.html'],html,'The upload exactly matches the approved preview');assert.equal(calls.filter(call=>call.p==='/test-team/sites').length,1);
  assert.equal(await page.locator('#publishNowBtn').innerText(),'Update published version');
  for(const width of [1280,390,320]){await page.setViewportSize({width,height:850});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,'publishing-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#publishReviews').uncheck();assert.equal(await page.locator('#publishPreviewWrap').isVisible(),false);assert(await page.locator('#publishNowBtn').isDisabled());
  await page.locator('#publishPreviewBtn').click();await page.locator('#publishPreviewWrap').waitFor();await page.locator('#publishApproved').check();
  // Exercise keyboard activation after responsive scrolling, as well as the initial pointer activation.
  mismatch=true;const priorPromotions=calls.filter(call=>call.p.endsWith('/restore')).length;await page.locator('#publishNowBtn').press('Enter');await page.locator('#publishProgress[data-state="error"]').waitFor();assert.match(await page.locator('#publishProgress').innerText(),/not the dedicated/);assert.equal(calls.filter(call=>call.p.endsWith('/restore')).length,priorPromotions);
  mismatch=false;failUpload=true;await page.locator('#publishNowBtn').press('Enter');await page.waitForFunction(()=>!archiveBusy);assert.match(await page.locator('#publishProgress').innerText(),/could not complete/);assert.equal(calls.filter(call=>call.p.endsWith('/restore')).length,priorPromotions);
  failUpload=false;await page.locator('#publishNowBtn').press('Enter');await page.locator('#publishProgress[data-state="success"]').waitFor();assert(!uploaded['/index.html'].includes('Selected **formatted** review'));assert.equal(calls.filter(call=>call.p==='/test-team/sites').length,1,'Updates reuse the verified dedicated site');
  const storage=await page.evaluate(()=>({local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage)}));assert(!storage.local.includes(token)&&!storage.session.includes(token));
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),before);assert.deepEqual(await page.evaluate(()=>readLocalArchive()),disk,'Publication never writes the local archive');
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosPublishing);
  await page.locator('#settingsMenu>summary').click();await page.locator('#settingsMenu [data-view="publishing"]').click();assert.equal(await page.locator('#publishEntries input:checked').count(),1);
  assert.equal(await page.locator('#publishUsername').inputValue(),'maria','The display name persists separately from the archive');
  assert(await page.locator('#publishNowBtn').isDisabled(),'Reload forgets the account credential');
  await page.locator('#publishPreviewBtn').click();await page.locator('#publishPreviewWrap').waitFor();await frame.locator('#profileTitle').getByText('Synthetic public diary').waitFor();
  const download=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('backupBtn').click());const chunks=[];for await(const chunk of await(await download).createReadStream())chunks.push(chunk);const backup=Buffer.concat(chunks).toString();assert(!backup.includes('publisherId')&&!backup.includes(token));assert.deepEqual(JSON.parse(backup).experiences,disk.experiences);
  assert.deepEqual(errors,[]);console.log('PASS public projection, interactive isolated preview, OAuth callback, dedicated-site publish/update, failures, mobile fit, offline preview, persistence and unchanged backups');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
