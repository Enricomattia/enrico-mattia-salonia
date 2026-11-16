// Isolated archives, a real OAuth popup/callback, and a synthetic Netlify API.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {createHash,randomBytes,randomUUID}=require('node:crypto');
const{chromium}=require('playwright');
const root=path.resolve(__dirname,'../public'),output=process.env.PATHOS_UI_SCREENSHOTS||path.resolve(__dirname,'../output/pathos-publishing');
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;if(!/^\/pathos-personal\/(fonts\/)?[a-z0-9.-]+$/i.test(p)){res.writeHead(404).end();return;}const body=await fs.readFile(path.join(root,p));res.writeHead(200,{'Cache-Control':'no-store','Content-Type':p.endsWith('.html')?'text/html':/\.m?js$/.test(p)?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.woff2')?'font/woff2':p.endsWith('.png')?'image/png':'application/manifest+json'}).end(body);}catch{res.writeHead(404).end();}});
let browser,origin;
(async()=>{
  if(process.env.PATHOS_PUBLISH_PREVIEW){const target=new URL(process.env.PATHOS_PUBLISH_PREVIEW);if(target.origin!=='https://enricomattiasalonia.com')assert.match(target.hostname,/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/);origin=target.origin;}else{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;}
  const appUrl=new URL('/pathos-personal/index.html',origin);
  // The Netlify feedback drawer can cover the app's bottom navigation on phones.
  if(appUrl.hostname.endsWith('.netlify.app'))appUrl.searchParams.set('ntl-drawer-state','hidden');
  await fs.mkdir(output,{recursive:true});browser=await chromium.launch({channel:process.env.PATHOS_BROWSER||'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true}),calls=[],errors=[];
  let site,metadata={},deployNumber=0,uploaded={},failUpload=false,mismatch=false,authConfigured=true,pendingUpload,deployState='ready',authOutcome='approved',publicAccess=false;
  const token='synthetic-publishing-access-token';
  const oldKey=randomBytes(32).toString('hex'),oldId=createHash('sha256').update('pathos-publication-v1:'+oldKey).digest('hex').slice(0,32);
  let oldRevision=randomUUID(),oldPublished=true;
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===origin){
      if(url.pathname.endsWith('/publish-config.js'))return route.fulfill({contentType:'text/javascript',body:'window.PATHOS_PUBLISH_CONFIG={netlifyClientId:'+(authConfigured?'"synthetic-client-id"':'""')+'};'});
      if(url.pathname==='/api/pathos-personal/publication/'+oldId){
        assert.equal(request.headers().authorization,'Bearer '+oldKey);
        if(request.method()==='DELETE'){
          assert.equal(request.headers()['x-pathos-revision'],oldRevision);
          oldPublished=false;oldRevision=randomUUID();
        }else assert.equal(request.method(),'GET');
        return route.fulfill({json:{published:oldPublished,revision:oldRevision}});
      }
      return route.continue();
    }
    if(url.hostname==='app.netlify.com'&&url.pathname==='/authorize'){
      assert.equal(url.searchParams.get('response_type'),'token');
      const callback=new URL(url.searchParams.get('redirect_uri'));assert.equal(callback.origin,origin);
      callback.hash=new URLSearchParams({state:url.searchParams.get('state'),...(authOutcome==='refused'?{error:'access_denied'}:{access_token:token})}).toString();
      return route.fulfill({contentType:'text/html',body:'<script>location.href='+JSON.stringify(callback.href)+'</script>'});
    }
    if(url.hostname==='pathos-legacy.netlify.app'&&url.pathname==='/pathos-profile.json')return route.fulfill({status:404,headers:{'Access-Control-Allow-Origin':'*'}});
    if(site&&url.hostname===site.name+'.netlify.app'){
      assert.equal(request.headers().authorization,undefined);assert.equal(request.headers().cookie,undefined);
      if(request.method()==='GET'&&url.pathname==='/pathos-profile.json'){
        assert.equal(request.headers().referer,undefined);
        return route.fulfill({body:uploaded[url.pathname],contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'}});
      }
      if(request.method()==='GET'&&url.pathname==='/')return route.fulfill({body:uploaded['/index.html'],contentType:'text/html'});
      assert.equal(request.method(),'HEAD');
      return publicAccess?route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'X-Pathos-Publication','X-Pathos-Publication':'v1'}}):route.fulfill({status:302,headers:{Location:'https://app.netlify.com/edge/'}});
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
      else if(p.includes('/files/')){if(pendingUpload)await pendingUpload;if(failUpload)return route.fulfill({status:500,json:{}});uploaded[p.slice(p.indexOf('/files/')+6)]=body;}
      else if(p.endsWith('/restore')){site.published_deploy={id:'deploy-'+deployNumber,site_id:site.id,state:'ready'};value=site.published_deploy;}
      else if(p.startsWith('/sites/site-123/deploys/'))value={id:'deploy-'+deployNumber,site_id:site.id,state:deployState};
      else throw new Error('Unexpected Netlify operation '+p);
      return route.fulfill({json:value});
    }
    return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error: '+error.message);});page.on('dialog',dialog=>dialog.accept());
  await page.goto(appUrl.href);await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosPublishing);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const fixture={schemaVersion:6,works:[{id:'book-1',type:'Book',title:'A selected book',creator:'Test author',owned:true,cover:'https://example.com/PRIVATE_COVER.jpg',sourceMetadata:{secret:'PRIVATE_METADATA'}}],experiences:[{id:'reading-1',workId:'book-1',status:'completed',endDate:'2026-11-07',rating:4.25,review:'Selected **formatted** review $& <script>window.attack=1</script>',tags:['PRIVATE_TAG'],details:{secret:'RECORD_SECRET'},quotes:[{id:'q-1',text:'A selected passage',note:'p. 2'}],edition:{publisher:'Selected publisher',sourceId:'PRIVATE_UID',isbn:'9780140328721'}},{id:'reading-2',workId:'book-1',status:'completed',endDate:'2026-11-06',rating:2,review:'UNSELECTED_REVIEW',quotes:[{id:'q-2',text:'UNSELECTED_PASSAGE'}]}]};
  await page.locator('#restoreInput').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.waitForFunction(()=>!document.getElementById('restoreInput').value&&pendingWrites===0&&!archiveBusy);
  const before=await page.evaluate(()=>JSON.stringify(db)),disk=await page.evaluate(()=>readLocalArchive());
  const publishingEntry=page.getByRole('button',{name:'Publish online',exact:true});
  const startPublishing=page.getByRole('button',{name:'Start publishing',exact:true});
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:800});
    await page.getByRole('button',{name:'Home',exact:true}).click();
    assert(await publishingEntry.isVisible(),'Publishing is discoverable with Settings closed');
    await publishingEntry.click();
    assert(await page.locator('#publishHeading').evaluate(heading=>document.activeElement===heading));
    assert.match(await page.locator('#publishSetup').innerText(),/Netlify hosts your website.*sign in or create an account/i);
    const bounds=await startPublishing.boundingBox();
    assert(bounds&&bounds.y+bounds.height<page.viewportSize().height-68,'The first action is visible without scrolling');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(output,'start-publishing-'+width+'.png')});
  }
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#publishOldCopy summary').click();
  assert(!await page.locator('#publishOldRemove').isVisible(),'Old-copy takedown requires the key');
  await page.locator('#publishOldKey').fill(oldKey);
  await page.locator('#publishOldRestore').click();
  await page.locator('#publishOldRemove').waitFor();
  assert.equal(await page.evaluate(()=>localStorage.getItem('pathos-personal.hosted-publication-v1')),null,'A recovered key stays in memory');
  await page.locator('#publishOldCopy summary').click();
  const previousCopy=await context.newPage();
  await previousCopy.addInitScript(key=>localStorage.setItem('pathos-personal.hosted-publication-v1',key),oldKey);
  previousCopy.on('dialog',dialog=>dialog.accept());
  await previousCopy.goto(appUrl.href);
  await previousCopy.waitForFunction(()=>window.pathosPersonalReady&&window.PathosPublishing);
  await previousCopy.locator('#settingsMenu>summary').click();await previousCopy.locator('#settingsMenu [data-view="publishing"]').click();
  await previousCopy.locator('#publishOldCopy summary').click();
  await previousCopy.locator('#publishOldRemove').waitFor();
  assert.equal(await previousCopy.locator('#publishOldLink').getAttribute('href'),origin+'/pathos-share/'+oldId);
  await previousCopy.locator('#publishOldRemove').click();
  await previousCopy.locator('#publishOldStatus').getByText('The old copy is offline.').waitFor();
  assert(!await previousCopy.locator('#publishOldLink').isVisible());
  await previousCopy.evaluate(()=>localStorage.removeItem('pathos-personal.hosted-publication-v1'));
  await previousCopy.close();
  assert(await startPublishing.isVisible());
  assert(!await page.locator('#publishNowBtn').isVisible(),'Upload requires a connected hosting account');
  assert.equal(await page.locator('#publishEntries input:checked').count(),2,'All experiences start included for a new publisher');
  assert.equal(calls.length,0,'Default inclusion does not upload anything');
  await page.locator('#publishPreviewBtn').click();
  await page.locator('#publishPreviewWrap').waitFor();
  await page.frameLocator('#publishPreview').locator('#diary [data-work]').nth(1).waitFor();
  await page.locator('[data-publish-entry="reading-2"]').uncheck();
  assert(!await page.locator('#publishPreviewWrap').isVisible(),'Excluding an entry invalidates the old preview');
  assert.equal(await page.locator('#publishUsername').inputValue(),'');
  await page.locator('#publishUsername').fill('<img src=x onerror=alert(1)>');
  await page.locator('#publishTitle').fill('Synthetic public diary');await page.locator('[data-publish-entry="reading-1"]').check();
  await page.locator('#publishPreviewBtn').click();await page.locator('#publishPreviewWrap').waitFor();
  const frame=page.frameLocator('#publishPreview');await frame.locator('#profileTitle').getByText('Synthetic public diary').waitFor();
  assert.equal(await frame.locator('#profileUsername').innerText(),'<img src=x onerror=alert(1)>');assert.equal(await frame.locator('#profileUsername img').count(),0,'A username is literal text');
  await page.locator('#publishUsername').fill('maria');assert.equal(await page.locator('#publishPreviewWrap').isVisible(),false,'Changing a username invalidates the preview');
  const photoFile=await fs.readFile(path.join(root,'pathos-personal/icon-192.png'));
  await page.locator('#publishPhotoInput').setInputFiles({name:'profile.png',mimeType:'image/png',buffer:photoFile});
  const photoInput=page.locator('#publishPhoto');await photoInput.waitFor();
  const photo=await photoInput.getAttribute('src');assert.match(photo,/^data:image\/jpeg;base64,/);
  assert(await photoInput.evaluate(image=>image.decode().then(()=>image.naturalWidth<=192)));
  await page.locator('#publishPreviewBtn').click();await page.locator('#publishPreviewWrap').waitFor();await frame.locator('#profileUsername').getByText('maria',{exact:true}).waitFor();
  assert.equal(await frame.locator('#profilePhoto').getAttribute('src'),photo);
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
  // Start the first publish in a fresh app session where no preview has been opened.
  await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosPublishing);
  await page.locator('#settingsMenu>summary').click();await page.locator('#settingsMenu [data-view="publishing"]').click();
  assert(!await page.locator('#publishPreviewWrap').isVisible());
  // An unrelated postMessage cannot manufacture an authenticated connection.
  await page.evaluate(()=>postMessage({type:'pathos-netlify-auth',state:'fake',token:'fake-token'},location.origin));assert.equal(calls.length,0);
  await page.evaluate(()=>{
    const open=window.open,timer=window.setTimeout;
    window.open=()=>null;
    window.setTimeout=(fn,delay,...args)=>{
      if(delay!==300000)return timer(fn,delay,...args);
      window.setTimeout=timer;
      return timer(fn,300,...args);
    };
    window.addEventListener('restore-test-window-open',()=>{window.open=open;},{once:true});
  });
  await page.locator('#publishConnectBtn').click();
  await page.locator('#publishConnectionStatus').getByText(/didn’t finish connecting/).waitFor();
  assert(await page.locator('#publishConnectBtn').isEnabled());
  assert(!await page.locator('#publishSignInHelp').isVisible());
  await page.locator('#publishConnectBtn').click();
  await page.getByRole('button',{name:'Cancel sign-in'}).click();
  await page.locator('#publishConnectionStatus').getByText(/Sign-in cancelled/).waitFor();
  assert(await page.locator('#publishConnectBtn').isEnabled());
  await page.evaluate(()=>window.dispatchEvent(new Event('restore-test-window-open')));
  authOutcome='refused';
  await page.locator('#publishConnectBtn').click();
  await page.locator('#publishConnectionStatus').getByText(/cancelled or refused/).waitFor();
  assert(await page.locator('#publishConnectBtn').isEnabled());
  assert(!await page.locator('#publishNowBtn').isVisible());
  assert.equal(calls.length,0,'A refused authorization cannot reach the Netlify API');
  authOutcome='approved';
  await page.evaluate(()=>{
    const open=window.open;window.open=()=>null;
    window.addEventListener('restore-test-window-open',()=>{window.open=open;},{once:true});
  });
  await startPublishing.click();
  await page.locator('#publishConnectionStatus').getByText(/sign-in window didn’t open/).waitFor();
  const manualSignIn=page.locator('#publishSignInLink');
  const callbackTab=context.waitForEvent('page');
  await manualSignIn.click();
  const detached=await callbackTab;
  await detached.waitForURL(origin+'/pathos-personal/netlify-auth.html');
  assert.equal(await detached.evaluate(()=>window.opener),null);
  assert.equal(new URL(detached.url()).hash,'','The callback removes the token from the address');
  await page.locator('#publishConnectionStatus').getByText('Connected as Synthetic publisher.').waitFor();
  await detached.close();
  await page.evaluate(()=>window.dispatchEvent(new Event('restore-test-window-open')));
  assert.equal(await page.locator('#publishUsername').inputValue(),'maria','Netlify identity never replaces the chosen public username');
  await page.getByRole('button',{name:'Exclude shown'}).click();
  assert(await page.locator('#publishNowBtn').isDisabled(),'Creating a new site still requires an included experience');
  await page.locator('[data-publish-entry="reading-1"]').check();
  assert(await page.getByRole('button',{name:'Publish website',exact:true}).isEnabled(),'Publish is available without requesting a preview');
  assert.equal(await page.locator('#publishNextStep').innerText(),'Your website will include 1 experience.');
  assert(!calls.some(call=>['POST','PUT'].includes(call.method)),'Signing in never creates a site or uploads entries');
  assert.equal(await page.getByRole('checkbox',{name:/I approve/}).count(),0);
  assert.equal(await page.locator('#publishDisconnectBtn').isVisible(),true);
  let finishUpload;pendingUpload=new Promise(resolve=>{finishUpload=resolve;});
  await page.locator('#publishNowBtn').click();
  await page.locator('#publishProgress').getByText(/Uploading your website files/).waitFor();
  assert.equal(await page.locator('#publishNowBtn').innerText(),'Publishing…');
  assert(await page.getByRole('progressbar',{name:'Publishing in progress'}).isVisible());
  assert(await page.getByText(/This may take a few minutes/).isVisible());
  assert.match(await page.locator('#publishAddressLabel').innerText(),/unconfirmed/);
  finishUpload();pendingUpload=null;
  await page.locator('#publishProgress[data-state="success"]').waitFor();
  assert.equal(await page.locator('#publishWebsiteLink').innerText(),'https://'+site.name+'.netlify.app');
  assert.equal(await page.locator('#publishAddressLabel').innerText(),'Website address');
  assert.match(await page.locator('#publishVisibility').innerText(),/couldn’t be verified/);
  assert(await page.getByText('Make public',{exact:true}).isVisible());
  assert.equal(await page.locator('#publishManageLink').getAttribute('href'),'https://app.netlify.com/projects/'+site.name+'/overview');
  publicAccess=true;
  await page.getByRole('button',{name:'Check public link'}).click();
  await page.locator('#publishVisibility').getByText(/Public link verified/).waitFor();
  assert.equal(await page.locator('#publishAddressLabel').innerText(),'Public website');
  assert(!await page.locator('#publishWaiting').isVisible());
  assert.equal(uploaded['/index.html'],html,'Publishing without a preview uses the same public projection');assert.equal(calls.filter(call=>call.p==='/test-team/sites').length,1);
  assert.equal(await page.locator('#publishNowBtn').innerText(),'Update published version');
  const publicUrl='https://'+site.name+'.netlify.app';
  assert.deepEqual(JSON.parse(uploaded['/pathos-profile.json']),{format:'pathos-profile-v1',name:'maria',photo});
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{window.copiedLink=value;}}}));
  await page.getByRole('button',{name:'Copy public link',exact:true}).click();
  await page.getByText('Public link copied.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.copiedLink),publicUrl+'/');
  const friendPage=await context.newPage();
  friendPage.on('pageerror',error=>errors.push(error.message));
  await friendPage.setViewportSize({width:320,height:800});
  await friendPage.goto(appUrl.href);
  const openFriends=friendPage.getByRole('button',{name:'Friends',exact:true});
  const addFriend=friendPage.getByRole('button',{name:'Add friend',exact:true});
  const address=friendPage.getByLabel('Public Πathos link',{exact:true});
  const lookup=friendPage.getByRole('button',{name:'Find profile',exact:true});
  const saveFriend=friendPage.getByRole('button',{name:'Save friend',exact:true});
  await openFriends.click();await addFriend.click();
  await address.fill('https://example.com');await lookup.click();
  await friendPage.locator('#friendFeedback').getByText(/Paste the public/).waitFor();
  await address.fill(publicUrl+'/index.html?source=chat#recent');await lookup.click();
  await friendPage.locator('#friendPreview').getByText('maria',{exact:true}).waitFor();
  assert.equal(await friendPage.locator('#friendPreview img').getAttribute('src'),photo);
  assert(await friendPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await friendPage.screenshot({path:path.join(output,'friend-profile-320.png')});
  await friendPage.getByLabel('Nickname (optional)',{exact:true}).fill('Maria from book club');await saveFriend.click();
  const friendLink=friendPage.getByRole('link',{name:'Maria from book club',exact:true});
  await friendLink.waitFor();
  assert.equal(await friendLink.getAttribute('href'),publicUrl+'/');
  const opened=context.waitForEvent('page');await friendLink.click();
  const publicPage=await opened;await publicPage.locator('#profileUsername').getByText('maria',{exact:true}).waitFor();
  await publicPage.close();
  await addFriend.click();await address.fill(publicUrl);await lookup.click();
  await friendPage.locator('#friendFeedback').getByText(/already on your list/).waitFor();
  await address.fill('https://pathos-legacy.netlify.app');await lookup.click();
  await friendPage.locator('#friendFeedback').getByText(/save the link with a nickname/).waitFor();
  await friendPage.getByLabel('Nickname',{exact:true}).fill('Luigi');await saveFriend.click();
  await friendPage.getByRole('link',{name:'Luigi',exact:true}).waitFor();
  await context.setOffline(true);await friendPage.reload();await openFriends.click();
  await friendLink.waitFor();
  assert.equal(await friendLink.locator('img').getAttribute('src'),photo,'Saved friend photos are available offline');
  await friendPage.getByRole('button',{name:'Edit Maria from book club',exact:true}).click();
  await friendPage.getByLabel('Nickname (optional)',{exact:true}).fill('Maria');await saveFriend.click();
  await friendPage.getByRole('link',{name:'Maria',exact:true}).waitFor();
  await friendPage.getByRole('button',{name:'Edit Luigi',exact:true}).click();
  await friendPage.getByRole('button',{name:'Remove friend',exact:true}).click();
  await friendPage.getByRole('link',{name:'Luigi',exact:true}).waitFor({state:'detached'});
  await friendPage.screenshot({path:path.join(output,'friends-320.png')});
  await context.setOffline(false);await friendPage.close();
  assert.deepEqual(await page.evaluate(()=>readLocalArchive()),disk,'Friends never modify the diary');
  for(const width of [1280,390,320]){await page.setViewportSize({width,height:850});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(output,'publishing-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1280,height:900});
  await page.locator('#publishPreviewBtn').click();await page.locator('#publishPreviewWrap').waitFor();
  await page.locator('#publishReviews').uncheck();
  assert.equal(await page.locator('#publishPreviewWrap').isVisible(),false);
  assert(await page.locator('#publishNowBtn').isEnabled(),'Editing options keeps direct publishing available');
  // Exercise keyboard activation after responsive scrolling, as well as the initial pointer activation.
  mismatch=true;const priorPromotions=calls.filter(call=>call.p.endsWith('/restore')).length;await page.locator('#publishNowBtn').press('Enter');await page.locator('#publishProgress[data-state="error"]').waitFor();assert.match(await page.locator('#publishProgress').innerText(),/not the dedicated/);assert.equal(calls.filter(call=>call.p.endsWith('/restore')).length,priorPromotions);
  mismatch=false;failUpload=true;await page.locator('#publishNowBtn').press('Enter');await page.waitForFunction(()=>!archiveBusy);assert.match(await page.locator('#publishProgress').innerText(),/could not complete/);assert.equal(calls.filter(call=>call.p.endsWith('/restore')).length,priorPromotions);
  failUpload=false;deployState='canceled';await page.locator('#publishNowBtn').press('Enter');await page.locator('#publishProgress[data-state="error"]').waitFor();
  assert.match(await page.locator('#publishProgress').innerText(),/could not prepare/);assert(!await page.locator('#publishWaiting').isVisible());
  await page.locator('#publishCheckBtn').click();await page.waitForFunction(()=>!document.getElementById('publishCheckBtn').disabled);
  await page.locator('#publishVisibility').getByText(/Public link verified/).waitFor();
  assert.equal(calls.filter(call=>call.p.endsWith('/restore')).length,priorPromotions,'The status check is read-only');
  await page.evaluate(()=>{
    const schedule=window.setTimeout;
    window.setTimeout=(fn,delay,...args)=>{
      if(delay!==180000)return schedule(fn,delay,...args);
      window.setTimeout=schedule;
      return schedule(fn,500,...args);
    };
  });
  pendingUpload=new Promise(resolve=>{finishUpload=resolve;});
  await page.locator('#publishNowBtn').press('Enter');
  await page.locator('#publishProgress').getByText(/stopped waiting for Netlify/).waitFor();
  assert(!await page.locator('#publishWaiting').isVisible());
  assert(!await page.locator('#publishNowBtn').isDisabled());
  assert.equal(calls.filter(call=>call.p.endsWith('/restore')).length,priorPromotions);
  finishUpload();pendingUpload=null;
  await page.getByRole('button',{name:'Remove photo',exact:true}).click();
  deployState='ready';await page.locator('#publishNowBtn').press('Enter');await page.locator('#publishProgress[data-state="success"]').waitFor();assert(!uploaded['/index.html'].includes('Selected **formatted** review'));assert.equal(calls.filter(call=>call.p==='/test-team/sites').length,1,'Updates reuse the verified dedicated site');
  assert.equal(JSON.parse(uploaded['/pathos-profile.json']).photo,'','Publishing an update removes the previous profile photo');
  await page.getByRole('button',{name:'Exclude shown'}).click();
  assert(!await page.locator('#publishPreviewWrap').isVisible());
  await page.locator('#publishNowBtn').press('Enter');
  await page.locator('#publishProgress').getByText(/ready to share/).waitFor().catch(async error=>{
    console.error('Empty update status:',await page.locator('#publishProgress').textContent());
    throw error;
  });
  assert(!uploaded['/index.html'].includes('A selected book'),'A direct empty update removes previously published entries');
  assert.equal(calls.filter(call=>call.p==='/test-team/sites').length,1,'An empty update uses the same share address');
  await page.locator('[data-publish-entry="reading-1"]').check();
  const storage=await page.evaluate(()=>({local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage)}));assert(!storage.local.includes(token)&&!storage.session.includes(token));
  assert.equal(await page.evaluate(()=>JSON.stringify(db)),before);assert.deepEqual(await page.evaluate(()=>readLocalArchive()),disk,'Publication never writes the local archive');
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosPublishing);
  await page.locator('#settingsMenu>summary').click();await page.locator('#settingsMenu [data-view="publishing"]').click();assert.equal(await page.locator('#publishEntries input:checked').count(),1);
  assert.equal(await page.locator('#publishUsername').inputValue(),'maria','The display name persists separately from the archive');
  assert(await page.locator('#publishNowBtn').isDisabled(),'Reload forgets the account credential');
  assert(await page.getByRole('button',{name:'Reconnect to update',exact:true}).isVisible());
  assert.equal(await page.locator('#publishWebsiteLink').innerText(),'https://'+site.name+'.netlify.app','The website address is available before reconnecting');
  assert(await page.getByRole('button',{name:'Check public link'}).isVisible(),'The public check is available without a Netlify connection');
  await page.evaluate(()=>{
    db.experiences.push({id:'new-reading',workId:'book-1',status:'completed',endDate:'2026-11-08'});
    window.PathosPublishing.refresh();
  });
  assert(await page.locator('[data-publish-entry="new-reading"]').isChecked(),'New experiences are included in the next draft');
  assert(!await page.locator('[data-publish-entry="reading-2"]').isChecked(),'Exclusions survive reload');
  await page.evaluate(()=>{db.experiences.pop();window.PathosPublishing.refresh();});
  await page.locator('#publishPreviewBtn').click();await page.locator('#publishPreviewWrap').waitFor();await frame.locator('#profileTitle').getByText('Synthetic public diary').waitFor();
  await page.getByRole('button',{name:'Exclude shown'}).click();
  await page.locator('#publishPreviewBtn').click();
  await frame.getByText('No diary entries published.',{exact:true}).waitFor();
  const download=page.waitForEvent('download');await page.evaluate(()=>document.getElementById('backupBtn').click());const chunks=[];for await(const chunk of await(await download).createReadStream())chunks.push(chunk);const backup=Buffer.concat(chunks).toString();assert(!backup.includes('publisherId')&&!backup.includes(token));assert.deepEqual(JSON.parse(backup).experiences,disk.experiences);
  await page.evaluate(()=>{
    const key='pathos-personal.publication-v1',prev=JSON.parse(localStorage.getItem(key));
    delete prev.entryMode;delete prev.excluded;prev.selected=['reading-1'];localStorage.setItem(key,JSON.stringify(prev));
  });
  await page.reload();await page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosPublishing);
  await page.locator('#settingsMenu>summary').click();await page.locator('#settingsMenu [data-view="publishing"]').click();
  assert(await page.locator('[data-publish-entry="reading-1"]').isChecked());
  assert(!await page.locator('[data-publish-entry="reading-2"]').isChecked(),'Older private choices stay excluded on upgrade');
  await page.getByRole('button',{name:'Include all entries'}).click();
  assert.equal(await page.locator('#publishEntries input:checked').count(),2);
  assert.deepEqual(errors,[]);console.log('PASS publishing, public photos, copying a link, Friends, offline persistence, updates and unchanged backups');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
