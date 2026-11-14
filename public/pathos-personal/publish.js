import{projectArchive,buildPublication}from'./publish-core.mjs';
import{netlifyClient,publishTimeoutMessage}from'./publish-netlify.mjs';
// Publishing preferences are deliberately outside the diary and its backups.
const KEY='pathos-personal.publication-v1',$=id=>document.getElementById(id);
let prefs={publisherId:crypto.randomUUID(),selected:[],title:'',username:'',reviews:true,passages:true,covers:true,sites:{},lastSiteUser:''};
try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null');
  if(saved&&/^[A-Za-z0-9_-]{10,100}$/.test(saved.publisherId)){
    prefs={...prefs,publisherId:saved.publisherId,title:typeof saved.title==='string'?saved.title.slice(0,120):'',username:typeof saved.username==='string'?saved.username.slice(0,40):'',selected:Array.isArray(saved.selected)?saved.selected.filter(id=>typeof id==='string'&&id.length<200).slice(0,10000):[],reviews:saved.reviews!==false,passages:saved.passages!==false,covers:saved.covers!==false,sites:saved.sites&&typeof saved.sites==='object'&&!Array.isArray(saved.sites)?saved.sites:{}};
    if(typeof saved.lastSiteUser==='string')prefs.lastSiteUser=saved.lastSiteUser;
  }
}catch{/* A failed preference read never changes the archive. */}
let selected=new Set(prefs.selected),prepared=null,assetsPromise=null,client=null,user=null,accounts=[],pendingAuth=null,busy=false,publishing=false;
const menu=document.createElement('button');menu.type='button';menu.className='menu-view';menu.dataset.view='publishing';menu.textContent='Publish online';
menu.addEventListener('click',()=>showView('publishing'));$('settingsMenu').querySelector('.more-menu-panel').append(menu);
$('publishTitle').value=prefs.title;$('publishUsername').value=prefs.username;for(const option of ['reviews','passages','covers'])$('publish'+option[0].toUpperCase()+option.slice(1)).checked=prefs[option];
function status(message,state=''){
  const progress=$('publishProgress');progress.hidden=!message;progress.textContent=message;progress.dataset.state=state;
  $('publishProjectHelp').hidden=true;
}
function savePrefs(){
  prefs.selected=[...selected];prefs.title=$('publishTitle').value;prefs.username=$('publishUsername').value;for(const option of ['reviews','passages','covers'])prefs[option]=$('publish'+option[0].toUpperCase()+option.slice(1)).checked;
  try{localStorage.setItem(KEY,JSON.stringify(prefs));return true;}catch{status('Could not save publishing preferences on this device. Publication is paused until browser storage works.','error');return false;}
}
function snapshot(){return projectArchive(db,[...selected],{title:$('publishTitle').value,username:$('publishUsername').value,reviews:$('publishReviews').checked,passages:$('publishPassages').checked,covers:$('publishCovers').checked});}
function invalidate(){prepared=null;$('publishPreviewWrap').hidden=true;$('publishApproved').checked=false;$('publishPreview').removeAttribute('srcdoc');refreshButtons();}
function refreshButtons(){
  $('publishPreviewBtn').disabled=busy||!selected.size||!window.pathosPersonalReady;
  $('publishConnectBtn').disabled=busy||Boolean(pendingAuth);
  $('publishNowBtn').disabled=busy||!client||!prepared||!$('publishApproved').checked||!$('publishAccount').value;
  const ref=currentSite(),published=Boolean(ref?.deployId);
  $('publishNowBtn').textContent=publishing?'Publishing…':published?'Update published version':'Publish website';
  $('publishWaiting').hidden=!publishing;
  $('publishNextStep').textContent=publishing?'':!client?'Connect Netlify to publish.':!selected.size?'Select the entries you want to share.':!prepared?'Preview your selected entries.':!$('publishApproved').checked?'Approve the public preview to continue.':'';
  $('publishNextStep').hidden=!$('publishNextStep').textContent;
  $('publishDisconnectBtn').hidden=!client&&!pendingAuth;
  $('publishAccountField').hidden=!client;
  for(const id of ['publishTitle','publishUsername','publishReviews','publishPassages','publishCovers','publishSearch','publishSelectShown','publishClear','publishAccount','publishApproved'])$(id).disabled=busy;
  $('publishEntries').querySelectorAll('input').forEach(input=>input.disabled=busy);
  showResult(ref);
}
function validSite(ref){return Boolean(ref&&/^[A-Za-z0-9_-]{1,100}$/.test(ref.id)&&/^[a-z0-9-]+$/.test(ref.name));}
function currentSite(){
  if(user)return prefs.sites[user.id];
  const last=prefs.sites[prefs.lastSiteUser];
  return validSite(last)?last:Object.values(prefs.sites).filter(validSite).sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')))[0];
}
function rememberSite(ref){
  prefs.sites[user.id]=ref;prefs.lastSiteUser=user.id;
  const saved=savePrefs();showResult(ref);return saved;
}
function showResult(ref){
  const valid=validSite(ref);
  $('publishResult').hidden=!valid;$('publishCheckBtn').hidden=!client||!valid;$('publishCheckBtn').disabled=busy;if(!valid)return;
  const published=typeof ref.deployId==='string'&&Boolean(ref.deployId);
  const url='https://'+ref.name+'.netlify.app';
  $('publishAddressLabel').textContent=published?'Published website':'Website address (publication unconfirmed)';
  $('publishWebsiteLink').href=url;$('publishWebsiteLink').textContent=url;
  $('publishVisibility').hidden=!published;
  $('publishManageLink').href='https://app.netlify.com/projects/'+ref.name+'/overview';
}
function refresh(){
  if(!window.pathosPersonalReady)return;
  const validIds=new Set(db.experiences.map(entry=>entry.id));selected=new Set([...selected].filter(id=>validIds.has(id)));
  if(prepared){try{if(JSON.stringify(snapshot())!==prepared.signature)invalidate();}catch{invalidate();}}
  const query=$('publishSearch').value.trim().toLocaleLowerCase(),works=new Map(db.works.map(work=>[work.id,work]));
  const rows=db.experiences.filter(entry=>{const work=works.get(entry.workId);return work&&(work.title+' '+work.creator).toLocaleLowerCase().includes(query);}).sort((a,b)=>(b.endDate||b.startDate||'').localeCompare(a.endDate||a.startDate||''));
  $('publishEntries').replaceChildren();
  for(const entry of rows){
    const work=works.get(entry.workId),label=document.createElement('label');label.className='publish-entry';
    const input=document.createElement('input');input.type='checkbox';input.checked=selected.has(entry.id);input.dataset.publishEntry=entry.id;
    const body=document.createElement('span'),title=document.createElement('strong'),meta=document.createElement('small');title.textContent=work.title;
    meta.textContent=[work.creator,work.type,entry.endDate||entry.startDate||'Undated',STATUS_LABELS[entry.status]||''].filter(Boolean).join(' · ');body.append(title,meta);label.append(input,body);$('publishEntries').append(label);
    input.addEventListener('change',()=>{if(input.checked)selected.add(entry.id);else selected.delete(entry.id);invalidate();savePrefs();$('publishSelectedCount').textContent=selected.size+' selected';});
  }
  if(!rows.length){const empty=document.createElement('p');empty.className='empty';empty.textContent=db.experiences.length?'No matching entries.':'Log an experience before creating your public website.';$('publishEntries').append(empty);}
  $('publishSelectedCount').textContent=selected.size+' selected';refreshButtons();
}
async function loadAssets(){
  if(!assetsPromise)assetsPromise=(async()=>{
    const names={html:'published-reader.txt',css:'published-reader.css',reader:'published-reader.js',parser:'markdown-it.min.js',parserLicense:'markdown-it.LICENSE.txt',fontLicense:'fonts/LICENSE.txt',format:'review-format.js',serif:'fonts/newsreader-latin.woff2',sans:'fonts/instrument-sans-latin.woff2'};
    const assets={};
    for(const[key,name]of Object.entries(names)){
      const response=await fetch('/pathos-personal/'+name,{credentials:'omit',redirect:'error'});if(!response.ok)throw new Error('The website preview could not load. Update Πathos or reconnect and try again.');
      if(key==='serif'||key==='sans'){const bytes=new Uint8Array(await response.arrayBuffer());let raw='';for(let offset=0;offset<bytes.length;offset+=8192)raw+=String.fromCharCode(...bytes.subarray(offset,offset+8192));assets[key]=btoa(raw);}else assets[key]=await response.text();
    }
    return assets;
  })().catch(error=>{assetsPromise=null;throw error;});
  return assetsPromise;
}
async function preview(){
  if(busy||archiveBusy||!window.pathosPersonalReady)return;
  busy=true;backgroundTasks++;refreshButtons();status('Preparing your public preview…');
  try{
    const value=snapshot(),signature=JSON.stringify(value),files=await buildPublication(value,await loadAssets());
    if(JSON.stringify(snapshot())!==signature)throw new Error('The selection changed. Preview it again.');
    prepared={files,signature};$('publishPreview').srcdoc=files.get('/index.html');$('publishPreviewWrap').hidden=false;$('publishApproved').checked=false;status(value.experiences.length===1?'1 selected experience is in this preview.':value.experiences.length+' selected experiences are in this preview.');
  }catch(error){invalidate();status(error.message,'error');}
  finally{busy=false;backgroundTasks--;refreshButtons();}
}
function endAuth(){if(!pendingAuth)return;clearInterval(pendingAuth.timer);try{pendingAuth.popup?.close();}catch{}pendingAuth=null;backgroundTasks--;refreshButtons();}
function disconnect(){if(busy)return;endAuth();client=null;user=null;accounts=[];$('publishConnectionStatus').textContent='Disconnected from Netlify.';$('publishAccount').replaceChildren();refreshButtons();}
function connect(){
  if(busy||archiveBusy||pendingAuth)return;
  if(!navigator.onLine){status('Connect to the internet to sign in to Netlify. Your local diary is unchanged.','error');return;}
  if($('entryDialog').open||$('catalogueGuide').open){status('Save or close your open entry or catalogue setup first.','error');return;}
  const clientId=window.PATHOS_PUBLISH_CONFIG?.netlifyClientId;
  if(!/^[A-Za-z0-9_-]{10,100}$/.test(clientId||'')){status('The Netlify connection is not available in this prototype yet. You can still preview your public website.','error');return;}
  const state=crypto.randomUUID()+crypto.randomUUID(),redirect=location.origin+'/pathos-personal/netlify-auth.html';
  if(window.PATHOS_PUBLISH_CONFIG.redirectUri&&window.PATHOS_PUBLISH_CONFIG.redirectUri!==redirect){status('Netlify publishing is not available at this address yet. You can still preview your public website.','error');return;}
  const popup=window.open('https://app.netlify.com/authorize?'+new URLSearchParams({client_id:clientId,response_type:'token',redirect_uri:redirect,state}),'pathos-netlify-connect','popup,width=600,height=760');
  if(!popup){status('Allow the Netlify sign-in window, then choose Connect Netlify again.','error');return;}
  backgroundTasks++;pendingAuth={state,popup,started:Date.now(),timer:null};
  pendingAuth.timer=setInterval(()=>{if(!pendingAuth)return;if(pendingAuth.popup.closed||Date.now()-pendingAuth.started>5*60*1000){endAuth();$('publishConnectionStatus').textContent='Netlify sign-in ended. Connect again when you are ready.';}},700);
  $('publishConnectionStatus').textContent='Finish signing in and approving the connection in Netlify.';refreshButtons();
}
window.addEventListener('message',async event=>{
  if(!pendingAuth||event.origin!==location.origin||event.source!==pendingAuth.popup||event.data?.type!=='pathos-netlify-auth'||event.data.state!==pendingAuth.state)return;
  const token=event.data.token;endAuth();
  if(typeof token!=='string'||!/^[A-Za-z0-9._~+\/=-]{10,8192}$/.test(token)){status('Netlify connection was cancelled or refused.','error');return;}
  busy=true;backgroundTasks++;refreshButtons();
  try{
    const candidate=netlifyClient(token),who=await candidate.user(),teams=await candidate.accounts();
    if(typeof who?.id!=='string'||!Array.isArray(teams))throw new Error('Netlify did not confirm the account.');
    const allowed=teams.filter(team=>typeof team.id==='string'&&/^[A-Za-z0-9_-]+$/.test(team.slug||''));
    if(!allowed.length)throw new Error('No Netlify team is available. Finish account setup in Netlify, then connect again.');
    client=candidate;user=who;accounts=allowed;$('publishAccount').replaceChildren();
    for(const team of accounts){const option=document.createElement('option');option.value=team.id;option.textContent=team.name||team.slug;$('publishAccount').append(option);}
    const previous=prefs.sites[user.id];if(previous&&accounts.some(account=>account.id===previous.accountId))$('publishAccount').value=previous.accountId;
    $('publishConnectionStatus').textContent='Connected as '+(who.full_name||who.email||'your Netlify account')+'.';status('');
  }catch(error){client=null;user=null;status(error.message,'error');}
  finally{busy=false;backgroundTasks--;refreshButtons();}
});
async function checkPublication(){
  const ref=currentSite(),account=accounts.find(team=>team.id===ref?.accountId);
  if(busy||!client||!ref||!account)return;
  busy=true;backgroundTasks++;status('Checking the current website in Netlify…');refreshButtons();
  try{
    const result=await client.publication(ref,account);
    if(result){
      const saved=rememberSite(result);
      status(saved?'Netlify is serving a published version at the address below.':'Netlify confirmed the website. Keep the links below because this device could not save them.',saved?'success':'error');
    }else{
      status('Netlify hasn’t confirmed a published version. Open the project to check its deploys.','error');
    }
  }catch(error){status(error.message,'error');}
  finally{busy=false;backgroundTasks--;refreshButtons();}
}
async function publish(){
  if(busy||archiveBusy||!client||!prepared||!$('publishApproved').checked)return;
  if(!navigator.onLine){status('Connect to the internet to publish.','error');return;}
  if($('entryDialog').open||$('catalogueGuide').open||pendingWrites||lastSaveFailed){status('Finish saving your diary and close the open entry or setup before publishing.','error');return;}
  if(JSON.stringify(snapshot())!==prepared.signature){invalidate();status('The selected entries changed. Preview them again before publishing.','error');return;}
  const account=accounts.find(account=>account.id===$('publishAccount').value);if(!account)return;
  const previous=prefs.sites[user.id];if(previous&&previous.accountId!==account.id){status('Choose the team containing your existing Πathos publication.','error');return;}
  if(!savePrefs())return;
  busy=true;publishing=true;archiveBusy=true;backgroundTasks++;refreshButtons();
  status('Starting publication…','working');$('publishProgress').focus();
  const controller=new AbortController(),deadline=setTimeout(()=>controller.abort(),3*60*1000);
  const signal=controller.signal;
  try{
    let ref=previous;
    if(!ref){
      status('Creating your website in Netlify…','working');
      ref=await client.create(account,prefs.publisherId,signal);
      if(!rememberSite(ref))throw new Error('Netlify created the website. Keep the links below because this device could not save them.');
    }
    const result=await client.deploy(ref,account,prepared.files,{signal,onProgress:message=>status(message,'working')});
    const remembered=rememberSite(result);
    status(remembered?'Published to Netlify. Open your website below.':'Published to Netlify. Keep the links below because this device could not save them.',remembered?'success':'error');
  }catch(error){
    status(signal.aborted?publishTimeoutMessage:error.message,'error');
    $('publishProjectHelp').hidden=validSite(currentSite());
  }
  finally{clearTimeout(deadline);busy=false;publishing=false;archiveBusy=false;backgroundTasks--;refreshButtons();}
}
$('publishPreviewBtn').addEventListener('click',()=>void preview());$('publishNowBtn').addEventListener('click',()=>void publish());
$('publishConnectBtn').addEventListener('click',connect);$('publishDisconnectBtn').addEventListener('click',disconnect);
$('publishCheckBtn').addEventListener('click',()=>void checkPublication());
$('publishSearch').addEventListener('input',refresh);
$('publishSelectShown').addEventListener('click',()=>{document.querySelectorAll('[data-publish-entry]').forEach(input=>selected.add(input.dataset.publishEntry));invalidate();savePrefs();refresh();});
$('publishClear').addEventListener('click',()=>{selected.clear();invalidate();savePrefs();refresh();});
for(const id of ['publishTitle','publishUsername','publishReviews','publishPassages','publishCovers'])$(id).addEventListener('input',()=>{invalidate();savePrefs();});
$('publishApproved').addEventListener('change',refreshButtons);$('publishAccount').addEventListener('change',()=>{ $('publishApproved').checked=false;refreshButtons(); });
window.addEventListener('pagehide',()=>{client=null;endAuth();});
window.PathosPublishing={refresh};refresh();
