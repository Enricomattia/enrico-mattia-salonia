import{projectArchive,buildPublication}from'./publish-core.mjs';
import{profilePhoto}from'./public-profile.mjs';
import{netlifyClient,publishTimeoutMessage,checkPublicWebsite}from'./publish-netlify.mjs';
import{hostedPublication,readPublishingKey}from'./publish-hosted.mjs';
// Publishing preferences are deliberately outside the diary and its backups.
const KEY='pathos-personal.publication-v1',$=id=>document.getElementById(id);
let prefs={publisherId:crypto.randomUUID(),entryMode:'all',excluded:[],selected:[],title:'',username:'',photo:'',reviews:true,passages:true,covers:true,sites:{},lastSiteUser:''};
const entryIds=value=>Array.isArray(value)?value.filter(id=>typeof id==='string'&&id.length<200):[];
try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null');
  if(saved&&/^[A-Za-z0-9_-]{10,100}$/.test(saved.publisherId)){
    const sites=saved.sites&&typeof saved.sites==='object'&&!Array.isArray(saved.sites)?saved.sites:{};
    const selected=entryIds(saved.selected);
    const previousSelection=Array.isArray(saved.selected)||Object.values(sites).some(validSite);
    const entryMode=saved.entryMode==='all'||saved.entryMode==='selected'?saved.entryMode:previousSelection?'selected':'all';
    prefs={...prefs,publisherId:saved.publisherId,entryMode,excluded:entryIds(saved.excluded),selected,title:typeof saved.title==='string'?saved.title.slice(0,120):'',username:typeof saved.username==='string'?saved.username.slice(0,40):'',photo:profilePhoto(saved.photo),reviews:saved.reviews!==false,passages:saved.passages!==false,covers:saved.covers!==false,sites};
    if(typeof saved.lastSiteUser==='string')prefs.lastSiteUser=saved.lastSiteUser;
  }
}catch{/* A failed preference read never changes the archive. */}
const selected=new Set(prefs.selected),excluded=new Set(prefs.excluded);
const visibilityChecks=new Map();
let includedCount=0,previewSignature=null,assetsPromise=null,client=null,user=null,accounts=[],pendingAuth=null,busy=false,publishing=false,checkingConnection=false,readingPhoto=false;
const menu=document.createElement('button');menu.type='button';menu.className='menu-view';menu.dataset.view='publishing';menu.textContent='Publish online';
function openPublishing(){
  showView('publishing');
  $('publishHeading').focus({preventScroll:true});
}
menu.addEventListener('click',openPublishing);$('settingsMenu').querySelector('.more-menu-panel').append(menu);
$('openPublishingBtn').addEventListener('click',openPublishing);$('openPublishingBtn').hidden=false;
$('publishTitle').value=prefs.title;$('publishUsername').value=prefs.username;for(const option of ['reviews','passages','covers'])$('publish'+option[0].toUpperCase()+option.slice(1)).checked=prefs[option];
function renderPhoto(){
  const image=$('publishPhoto');
  image.hidden=$('publishRemovePhoto').hidden=!prefs.photo;
  if(prefs.photo)image.src=prefs.photo;else image.removeAttribute('src');
}
function photoFeedback(message,state=''){
  const feedback=$('publishPhotoFeedback');
  feedback.hidden=!message;feedback.textContent=message;feedback.dataset.state=state;
}
function usePhoto(photo){
  prefs.photo=photo;renderPhoto();invalidate();
  if(!savePrefs())photoFeedback('The change could not be saved on this device.','error');
}
async function choosePhoto(event){
  const file=event.target.files[0];event.target.value='';
  if(!file||busy||readingPhoto)return;
  if(file.size>10*1024*1024||file.type&&!['image/jpeg','image/png','image/webp'].includes(file.type)){
    photoFeedback('Choose a JPEG, PNG or WebP image up to 10 MB.','error');return;
  }
  readingPhoto=true;backgroundTasks++;refreshButtons();photoFeedback('Preparing photo…');
  try{
    const photo=profilePhoto(await compressCover(file,192,192));
    if(!photo)throw new Error('Invalid photo');
    photoFeedback('');usePhoto(photo);
  }catch{photoFeedback('Could not read that image. Choose another photo.','error');}
  finally{readingPhoto=false;backgroundTasks--;refreshButtons();}
}
function status(message,state=''){
  const progress=$('publishProgress');progress.hidden=!message;progress.textContent=message;progress.dataset.state=state;
  $('publishProjectHelp').hidden=true;
}
function connectionStatus(message,state=''){
  const feedback=$('publishConnectionStatus');feedback.textContent=message;feedback.dataset.state=state;
}
function manageOldCopy(){
  const panel=$('publishOldCopy'),link=$('publishOldLink'),feedback=$('publishOldStatus');
  const recovery=$('publishOldRecovery'),keyInput=$('publishOldKey');
  const check=$('publishOldCheck'),remove=$('publishOldRemove');
  let oldSite;
  try{
    const key=readPublishingKey();
    if(key)oldSite=hostedPublication(key);
  }catch{/* Browser storage can be unavailable. */}
  let previous;
  function showControls(){
    recovery.hidden=Boolean(oldSite);
    check.hidden=!oldSite;
  }
  showControls();
  async function update(takeOffline=false){
    if(!oldSite||check.disabled)return;
    if(takeOffline&&(!previous?.published||!confirm('Take the previous Πathos-hosted copy offline?')))return;
    check.disabled=remove.disabled=true;
    backgroundTasks++;
    feedback.dataset.state='working';
    feedback.textContent=takeOffline?'Taking the old copy offline…':'Checking the old copy…';
    try{
      previous=takeOffline?await oldSite.unpublish(previous.revision):await oldSite.status();
      link.href=link.textContent=new URL(await oldSite.website,location.origin).href;
      link.hidden=remove.hidden=!previous.published;
      feedback.dataset.state='success';
      feedback.textContent=previous.published?'The old copy is still online.':takeOffline?'The old copy is offline.':'There is no live copy at the old address.';
    }catch(error){
      remove.hidden=true;
      feedback.dataset.state='error';
      feedback.textContent=error.message;
    }finally{
      check.disabled=remove.disabled=false;
      backgroundTasks--;
    }
  }
  panel.addEventListener('toggle',()=>{if(panel.open)void update();});
  $('publishOldRestore').addEventListener('click',()=>{
    try{oldSite=hostedPublication(keyInput.value.trim());}
    catch(error){
      feedback.dataset.state='error';
      feedback.textContent=error.message;
      return;
    }
    keyInput.value='';
    showControls();
    void update();
  });
  check.addEventListener('click',()=>void update());
  remove.addEventListener('click',()=>void update(true));
}
function savePrefs(){
  prefs.selected=[...selected];prefs.excluded=[...excluded];prefs.title=$('publishTitle').value;prefs.username=$('publishUsername').value;for(const option of ['reviews','passages','covers'])prefs[option]=$('publish'+option[0].toUpperCase()+option.slice(1)).checked;
  try{localStorage.setItem(KEY,JSON.stringify(prefs));return true;}catch{status('Could not save publishing preferences on this device. Publication is paused until browser storage works.','error');return false;}
}
function isIncluded(id){return prefs.entryMode==='all'?!excluded.has(id):selected.has(id);}
function includedEntryIds(){return db.experiences.filter(entry=>isIncluded(entry.id)).map(entry=>entry.id);}
function updateIncludedEntries(){
  includedCount=includedEntryIds().length;
  $('publishSelectedCount').textContent=includedCount+' of '+db.experiences.length+' included';
}
function snapshot(){return projectArchive(db,includedEntryIds(),{title:$('publishTitle').value,username:$('publishUsername').value,photo:prefs.photo,reviews:$('publishReviews').checked,passages:$('publishPassages').checked,covers:$('publishCovers').checked,allowEmpty:Boolean(currentSite()?.deployId)});}
function invalidate(){previewSignature=null;$('publishPreviewWrap').hidden=true;$('publishPreview').removeAttribute('srcdoc');refreshButtons();}
function refreshButtons(){
  const ref=currentSite(),published=Boolean(ref?.deployId);
  const canBuild=includedCount>0||published;
  const unavailable=busy||readingPhoto||!canBuild||!window.pathosPersonalReady;
  $('publishPreviewBtn').disabled=unavailable||Boolean(pendingAuth);
  $('publishConnectBtn').disabled=busy||readingPhoto||Boolean(pendingAuth);
  $('publishPhotoInput').disabled=$('publishRemovePhoto').disabled=busy||readingPhoto;
  $('publishConnectBtn').hidden=Boolean(client);
  $('publishConnectBtn').textContent=checkingConnection?'Checking your account…':pendingAuth?'Waiting for sign-in…':published?'Reconnect to update':'Start publishing';
  $('publishSetup').hidden=Boolean(client);
  $('publishSetup').textContent=published?'Netlify hosts your website. Sign in with the account you used to publish it, then return here to update it.':'Netlify hosts your website. Sign in or create an account there, then return here to publish.';
  $('publishConnectBtn').setAttribute('aria-busy',String(checkingConnection||Boolean(pendingAuth)));
  $('publishNowBtn').hidden=!client;
  $('publishNowBtn').setAttribute('aria-busy',String(publishing));
  $('publishNowBtn').disabled=unavailable||!client||!$('publishAccount').value;
  $('publishNowBtn').textContent=publishing?'Publishing…':published?'Update published version':'Publish website';
  $('publishWaiting').hidden=!publishing;
  let nextStep='';
  if(client){
    if(!canBuild)nextStep='Include at least one experience to create a website.';
    else if(!includedCount)nextStep='This update removes all experiences from the live website.';
    else nextStep='Your website will include '+includedCount+(includedCount===1?' experience.':' experiences.');
  }
  $('publishNextStep').textContent=nextStep;
  $('publishNextStep').hidden=!$('publishNextStep').textContent;
  $('publishDisconnectBtn').hidden=!client&&!pendingAuth;
  $('publishDisconnectBtn').disabled=busy;
  $('publishDisconnectBtn').textContent=pendingAuth?'Cancel sign-in':'Disconnect';
  $('publishSignInHelp').hidden=!pendingAuth?.channel;
  $('publishAccountField').hidden=!client;
  for(const id of ['publishTitle','publishUsername','publishReviews','publishPassages','publishCovers','publishSearch','publishIncludeAll','publishExcludeShown','publishAccount'])$(id).disabled=busy;
  $('publishEntries').querySelectorAll('input').forEach(input=>input.disabled=busy);
  showResult(ref);
}
function validSite(ref){return Boolean(ref&&/^[A-Za-z0-9_-]{1,100}$/.test(ref.id)&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(ref.name));}
function currentSite(){
  if(user)return prefs.sites[user.id];
  const last=prefs.sites[prefs.lastSiteUser];
  return validSite(last)?last:Object.values(prefs.sites).filter(validSite).sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')))[0];
}
function rememberSite(ref){
  prefs.sites[user.id]=ref;prefs.lastSiteUser=user.id;
  const saved=savePrefs();showResult(ref);return saved;
}
function visibilityKey(ref){return ref.name+'/'+ref.deployId;}
function showResult(ref){
  const valid=validSite(ref);
  $('publishResult').hidden=!valid;if(!valid)return;
  const published=typeof ref.deployId==='string'&&Boolean(ref.deployId);
  $('publishCheckBtn').hidden=!published&&!client;$('publishCheckBtn').disabled=busy;
  $('publishCheckBtn').textContent=published?'Check public link':'Check deployment';
  const verified=published&&visibilityChecks.get(visibilityKey(ref));
  const url='https://'+ref.name+'.netlify.app';
  $('publishAddressLabel').textContent=verified?'Public website':published?'Website address':'Website address (deployment unconfirmed)';
  if($('publishWebsiteLink').getAttribute('href')!==url)$('publishCopyStatus').hidden=true;
  $('publishWebsiteLink').href=url;$('publishWebsiteLink').textContent=url;
  $('publishCopyLink').hidden=!published;
  $('publishVisibility').hidden=!published;
  $('publishVisibility').dataset.state=verified?'success':'';
  $('publishVisibility').textContent=verified?'Public link verified. Anyone with this address can open it.':visibilityChecks.has(visibilityKey(ref))?'Public access couldn’t be verified. Netlify may still have this project set to private.':'Check public access before sharing this link.';
  $('publishVisibilityHelp').hidden=!published||verified;
  $('publishManageLink').href='https://app.netlify.com/projects/'+ref.name+'/overview';
}
async function copyPublicLink(){
  const link=$('publishWebsiteLink'),feedback=$('publishCopyStatus');
  const url=link.href;
  let message='Public link copied.';
  try{await navigator.clipboard.writeText(url);}
  catch{message='Could not copy the link. You can select and copy the website address.';}
  if(link.href!==url)return;
  feedback.hidden=false;feedback.textContent=message;
}
async function verifyPublicLink(ref){
  status('Checking the link without a Netlify account…','working');
  const verified=await checkPublicWebsite(ref.name);
  visibilityChecks.set(visibilityKey(ref),verified);
  showResult(ref);
  return verified;
}
function refresh(){
  if(!window.pathosPersonalReady)return;
  updateIncludedEntries();
  if(previewSignature){try{if(JSON.stringify(snapshot())!==previewSignature)invalidate();}catch{invalidate();}}
  const query=$('publishSearch').value.trim().toLocaleLowerCase(),works=new Map(db.works.map(work=>[work.id,work]));
  const rows=db.experiences.filter(entry=>{const work=works.get(entry.workId);return work&&(work.title+' '+work.creator).toLocaleLowerCase().includes(query);}).sort((a,b)=>(b.endDate||b.startDate||'').localeCompare(a.endDate||a.startDate||''));
  $('publishEntries').replaceChildren();
  for(const entry of rows){
    const work=works.get(entry.workId),label=document.createElement('label');label.className='publish-entry';
    const input=document.createElement('input');input.type='checkbox';input.checked=isIncluded(entry.id);input.dataset.publishEntry=entry.id;
    const body=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small');title.textContent=work.title;
    meta.textContent=[work.creator,work.type,entry.endDate||entry.startDate||'Undated',STATUS_LABELS[entry.status]||''].filter(Boolean).join(' · ');body.append(title,meta);label.append(input,body);$('publishEntries').append(label);
    input.addEventListener('change',()=>{
      if(prefs.entryMode==='all'){if(input.checked)excluded.delete(entry.id);else excluded.add(entry.id);}
      else if(input.checked)selected.add(entry.id);else selected.delete(entry.id);
      updateIncludedEntries();invalidate();savePrefs();
    });
  }
  if(!rows.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=db.experiences.length?'No matching entries.':'Log an experience before creating your public website.';$('publishEntries').append(empty);}
  $('publishSelectionHint').textContent=prefs.entryMode==='all'?'All experiences are included by default. Uncheck anything you want to keep private.':'Your previous selection is still in use. Choose Include all entries to switch to the new default.';
  refreshButtons();
}
async function loadAssets(signal){
  if(!assetsPromise)assetsPromise=(async()=>{
    const names={html:'published-reader.txt',css:'published-reader.css',reader:'published-reader.js',parser:'markdown-it.min.js',parserLicense:'markdown-it.LICENSE.txt',fontLicense:'fonts/LICENSE.txt',format:'review-format.js',serif:'fonts/newsreader-latin.woff2',sans:'fonts/instrument-sans-latin.woff2'};
    const assets={};
    for(const[key,name]of Object.entries(names)){
      const response=await fetch('/pathos-personal/'+name,{credentials:'omit',redirect:'error',signal});if(!response.ok)throw new Error('Could not load the website files. Update Πathos or reconnect and try again.');
      if(key==='serif'||key==='sans'){const bytes=new Uint8Array(await response.arrayBuffer());let raw='';for(let offset=0;offset<bytes.length;offset+=8192)raw+=String.fromCharCode(...bytes.subarray(offset,offset+8192));assets[key]=btoa(raw);}else assets[key]=await response.text();
    }
    return assets;
  })().catch(error=>{assetsPromise=null;throw error;});
  return assetsPromise;
}
async function preview(){
  if(busy||readingPhoto||pendingAuth||archiveBusy||!window.pathosPersonalReady)return;
  busy=true;backgroundTasks++;refreshButtons();status('Preparing your public preview…');
  try{
    const value=snapshot(),signature=JSON.stringify(value),files=await buildPublication(value,await loadAssets());
    if(JSON.stringify(snapshot())!==signature)throw new Error('The selection changed. Preview it again.');
    previewSignature=signature;$('publishPreview').srcdoc=files.get('/index.html');$('publishPreviewWrap').hidden=false;
    const count=value.experiences.length;
    status(count===0?'This update will remove all experiences from the live site.':count===1?'This preview includes 1 experience.':'This preview includes '+count+' experiences.');
  }catch(error){invalidate();status(error.message,'error');}
  finally{busy=false;backgroundTasks--;refreshButtons();}
}
function endAuth(){
  if(!pendingAuth)return;
  const {timer,channel,popup}=pendingAuth;
  pendingAuth=null;clearTimeout(timer);channel?.close();
  try{popup?.close();}catch{}
  $('publishSignInLink').removeAttribute('href');
  backgroundTasks--;refreshButtons();
}
function disconnect(){
  if(busy)return;
  const wasSigningIn=Boolean(pendingAuth);
  endAuth();client=null;user=null;accounts=[];$('publishAccount').replaceChildren();
  connectionStatus(wasSigningIn?'Sign-in cancelled. You can connect again.':'Disconnected from Netlify.');
  refreshButtons();
}
function connect(){
  if(busy||readingPhoto||archiveBusy||pendingAuth)return;
  if(!navigator.onLine){connectionStatus('Connect to the internet to sign in to Netlify.','error');return;}
  if($('entryDialog').open||$('catalogueGuide').open){connectionStatus('Save or close your open entry or catalogue setup first.','error');return;}
  const clientId=window.PATHOS_PUBLISH_CONFIG?.netlifyClientId;
  if(!/^[A-Za-z0-9_-]{10,100}$/.test(clientId||'')){connectionStatus('Netlify sign-in is unavailable here. You can still preview your website.','error');return;}
  const state=crypto.randomUUID()+crypto.randomUUID(),redirect=location.origin+'/pathos-personal/netlify-auth.html';
  if(window.PATHOS_PUBLISH_CONFIG.redirectUri&&window.PATHOS_PUBLISH_CONFIG.redirectUri!==redirect){connectionStatus('Netlify sign-in is unavailable at this address. Open the original Πathos Personal page to connect.','error');return;}
  const url='https://app.netlify.com/authorize?'+new URLSearchParams({client_id:clientId,response_type:'token',redirect_uri:redirect,state});
  let channel;
  try{channel=new BroadcastChannel('pathos-netlify-auth:'+state);}catch{}
  // A browser can report popup.closed when it separates the two windows.
  let popup;
  try{popup=window.open(url,'pathos-netlify-connect','popup,width=600,height=760');}catch{}
  if(!popup&&!channel){connectionStatus('Allow the Netlify sign-in window in your browser and try again.','error');return;}
  backgroundTasks++;
  const attempt={state,popup,channel,timer:setTimeout(()=>{
    endAuth();connectionStatus('Netlify didn’t finish connecting. Try again and approve access in the Netlify window.','error');
  },5*60*1000)};
  pendingAuth=attempt;
  if(channel)channel.onmessage=event=>{if(pendingAuth===attempt)void finishAuth(event.data);};
  $('publishSignInLink').href=url;
  const signIn='Sign in or create an account in the Netlify window, then approve access.';
  connectionStatus(popup?(channel?signIn+' If it didn’t open, use the link below.':signIn):'The sign-in window didn’t open. Use the link below to continue.','working');
  refreshButtons();
}
window.addEventListener('message',event=>{
  if(pendingAuth?.popup&&event.origin===location.origin&&event.source===pendingAuth.popup)void finishAuth(event.data);
});
async function finishAuth(data){
  const attempt=pendingAuth;
  if(!attempt||data?.type!=='pathos-netlify-auth'||data.state!==attempt.state)return;
  attempt.channel?.postMessage({type:'pathos-netlify-received',state:attempt.state});
  endAuth();
  const token=data.token;
  if(typeof token!=='string'||!/^[A-Za-z0-9._~+\/=-]{10,8192}$/.test(token)){connectionStatus('Netlify sign-in was cancelled or refused. Connect again to retry.','error');return;}
  busy=true;checkingConnection=true;backgroundTasks++;
  connectionStatus('Checking your Netlify account and teams…','working');refreshButtons();
  try{
    const candidate=netlifyClient(token);
    const [who,teams]=await Promise.all([candidate.user(),candidate.accounts()]);
    if(typeof who?.id!=='string'||!Array.isArray(teams))throw new Error('Netlify did not confirm the account.');
    const allowed=teams.filter(team=>typeof team.id==='string'&&/^[A-Za-z0-9_-]+$/.test(team.slug||''));
    if(!allowed.length)throw new Error('No Netlify team is available. Finish account setup in Netlify, then connect again.');
    client=candidate;user=who;accounts=allowed;$('publishAccount').replaceChildren();
    for(const team of accounts){const option=document.createElement('option');option.value=team.id;option.textContent=team.name||team.slug;$('publishAccount').append(option);}
    const previous=prefs.sites[user.id];if(previous&&accounts.some(account=>account.id===previous.accountId))$('publishAccount').value=previous.accountId;
    connectionStatus('Connected as '+(who.full_name||who.email||'your Netlify account')+'.','success');status('');
  }catch(error){client=null;user=null;connectionStatus(error.message,'error');}
  finally{busy=false;checkingConnection=false;backgroundTasks--;refreshButtons();}
}
async function checkPublication(){
  const ref=currentSite(),account=accounts.find(team=>team.id===ref?.accountId);
  if(busy||pendingAuth||!validSite(ref)||(!ref.deployId&&(!client||!account)))return;
  busy=true;backgroundTasks++;refreshButtons();
  try{
    // A known website can be checked even after the Netlify session is closed.
    let result=ref;
    if(client&&account){
      status('Checking the current deployment in Netlify…','working');
      result=await client.publication(ref,account);
    }
    if(!result){
      status('Netlify hasn’t confirmed a published version. Open the project to check its deploys.','error');
      return;
    }
    const saved=result===ref||rememberSite(result);
    await verifyPublicLink(result);
    status(saved?'':'Keep the links below because this device could not save them.',saved?'':'error');
  }catch(error){status(error.message,'error');}
  finally{busy=false;backgroundTasks--;refreshButtons();}
}
async function publish(){
  if(busy||readingPhoto||archiveBusy||!client||!window.pathosPersonalReady)return;
  if(!navigator.onLine){status('Connect to the internet to publish.','error');return;}
  if($('entryDialog').open||$('catalogueGuide').open||pendingWrites||lastSaveFailed){status('Finish saving your diary and close the open entry or setup before publishing.','error');return;}
  const account=accounts.find(account=>account.id===$('publishAccount').value);if(!account)return;
  const previous=prefs.sites[user.id];if(previous&&previous.accountId!==account.id){status('Choose the team containing your existing Πathos publication.','error');return;}
  if(!savePrefs())return;
  busy=true;publishing=true;archiveBusy=true;backgroundTasks++;refreshButtons();
  status('Preparing your website…','working');$('publishProgress').focus();
  const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),3*60*1000);
  const signal=controller.signal;
  let preparing=true;
  try{
    const files=await buildPublication(snapshot(),await loadAssets(signal));
    signal.throwIfAborted();
    preparing=false;
    let ref=previous;
    if(!ref){
      status('Creating your website in Netlify…','working');
      ref=await client.create(account,prefs.publisherId,signal);
      if(!rememberSite(ref))throw new Error('Netlify created the website. Keep the links below because this device could not save them.');
    }
    const result=await client.deploy(ref,account,files,{signal,onProgress:message=>status(message,'working')});
    const remembered=rememberSite(result);
    publishing=false;refreshButtons();
    const verified=await verifyPublicLink(result);
    status(remembered?(verified?'Published to Netlify. Your link is ready to share.':'Published to Netlify. Check public access below before sharing.'):'Published to Netlify. Keep the links below because this device could not save them.',remembered?'success':'error');
  }catch(error){
    const timeout=preparing?'Preparing the website took too long. Try again.':publishTimeoutMessage;
    status(signal.aborted?timeout:error.message,'error');
    $('publishProjectHelp').hidden=validSite(currentSite());
  }
  finally{clearTimeout(deadline);busy=false;publishing=false;archiveBusy=false;backgroundTasks--;refreshButtons();}
}
$('publishPreviewBtn').addEventListener('click',()=>void preview());$('publishNowBtn').addEventListener('click',()=>void publish());
$('publishConnectBtn').addEventListener('click',connect);$('publishDisconnectBtn').addEventListener('click',disconnect);
$('publishCheckBtn').addEventListener('click',()=>void checkPublication());
$('publishCopyLink').addEventListener('click',()=>void copyPublicLink());
$('publishPhotoInput').addEventListener('change',event=>void choosePhoto(event));
$('publishRemovePhoto').addEventListener('click',()=>{photoFeedback('');usePhoto('');});
renderPhoto();
$('publishSearch').addEventListener('input',refresh);
$('publishIncludeAll').addEventListener('click',()=>{prefs.entryMode='all';selected.clear();excluded.clear();invalidate();savePrefs();refresh();});
$('publishExcludeShown').addEventListener('click',()=>{
  document.querySelectorAll('[data-publish-entry]').forEach(input=>{
    if(prefs.entryMode==='all')excluded.add(input.dataset.publishEntry);else selected.delete(input.dataset.publishEntry);
  });
  invalidate();savePrefs();refresh();
});
for(const id of ['publishTitle','publishUsername','publishReviews','publishPassages','publishCovers'])$(id).addEventListener('input',()=>{invalidate();savePrefs();});
$('publishAccount').addEventListener('change',refreshButtons);
window.addEventListener('pagehide',()=>{client=null;endAuth();});
window.PathosPublishing={refresh};refresh();manageOldCopy();
