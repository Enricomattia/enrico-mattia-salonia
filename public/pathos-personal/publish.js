import {projectArchive,buildPublication,digest} from './publish-core.mjs';
import {hostedPublication,newPublishingKey,readPublishingKey,savePublishingKey} from './publish-hosted.mjs';
// Publishing preferences are deliberately outside the diary and its backups.
const KEY='pathos-personal.publication-v1',$=id=>document.getElementById(id);
let prefs={publisherId:crypto.randomUUID(),entryMode:'all',excluded:[],selected:[],title:'',username:'',reviews:true,passages:true,covers:true,sites:{},lastSiteUser:''};
const entryIds=value=>Array.isArray(value)?value.filter(id=>typeof id==='string'&&id.length<200):[];
try{
  const saved=JSON.parse(localStorage.getItem(KEY)||'null');
  if(saved&&/^[A-Za-z0-9_-]{10,100}$/.test(saved.publisherId)){
    const sites=saved.sites&&typeof saved.sites==='object'&&!Array.isArray(saved.sites)?saved.sites:{};
    const selected=entryIds(saved.selected);
    const previousSelection=Array.isArray(saved.selected)||Object.values(sites).some(validSite);
    const entryMode=saved.entryMode==='all'||saved.entryMode==='selected'?saved.entryMode:previousSelection?'selected':'all';
    prefs={...prefs,publisherId:saved.publisherId,entryMode,excluded:entryIds(saved.excluded),selected,title:typeof saved.title==='string'?saved.title.slice(0,120):'',username:typeof saved.username==='string'?saved.username.slice(0,40):'',reviews:saved.reviews!==false,passages:saved.passages!==false,covers:saved.covers!==false,sites};
    if(typeof saved.lastSiteUser==='string')prefs.lastSiteUser=saved.lastSiteUser;
  }
}catch{/* A failed preference read never changes the archive. */}
const selected=new Set(prefs.selected),excluded=new Set(prefs.excluded);
let includedIds=[],prepared=null,assetsPromise=null,busy=false,publishing=false;
let editingKey=null,website=null,siteStatus=null;
const menu=document.createElement('button');menu.type='button';menu.className='menu-view';menu.dataset.view='publishing';menu.textContent='Publish online';
menu.addEventListener('click',()=>showView('publishing'));$('settingsMenu').querySelector('.more-menu-panel').append(menu);
$('publishTitle').value=prefs.title;$('publishUsername').value=prefs.username;for(const option of ['reviews','passages','covers'])$('publish'+option[0].toUpperCase()+option.slice(1)).checked=prefs[option];
function status(message,state=''){
  const progress=$('publishProgress');progress.hidden=!message;progress.textContent=message;progress.dataset.state=state;
}
function savePrefs(){
  prefs.selected=[...selected];prefs.excluded=[...excluded];prefs.title=$('publishTitle').value;prefs.username=$('publishUsername').value;for(const option of ['reviews','passages','covers'])prefs[option]=$('publish'+option[0].toUpperCase()+option.slice(1)).checked;
  try{localStorage.setItem(KEY,JSON.stringify(prefs));return true;}catch{status('Could not save publishing preferences on this device. Publication is paused until browser storage works.','error');return false;}
}
function isIncluded(id){return prefs.entryMode==='all'?!excluded.has(id):selected.has(id);}
function updateIncludedEntries(){
  includedIds=db.experiences.filter(entry=>isIncluded(entry.id)).map(entry=>entry.id);
  $('publishSelectedCount').textContent=includedIds.length+' of '+db.experiences.length+' included';
}
function snapshot(){return projectArchive(db,includedIds,{title:$('publishTitle').value,username:$('publishUsername').value,reviews:$('publishReviews').checked,passages:$('publishPassages').checked,covers:$('publishCovers').checked,allowEmpty:siteStatus?.published===true});}
function invalidate(){prepared=null;$('publishPreviewWrap').hidden=true;$('publishApproved').checked=false;$('publishPreview').removeAttribute('srcdoc');refreshButtons();}
function refreshButtons(){
  const published=siteStatus?.published===true;
  $('publishPreviewBtn').disabled=busy||(!includedIds.length&&!published)||!window.pathosPersonalReady;
  $('publishNowBtn').setAttribute('aria-busy',String(publishing));
  $('publishNowBtn').disabled=busy||!prepared||!$('publishApproved').checked||Boolean(website&&!siteStatus);
  $('publishNowBtn').textContent=publishing?'Publishing…':published?'Update website':'Publish website';
  $('publishResult').hidden=!website;
  $('publishAddress').hidden=!published;
  $('unpublishBtn').hidden=!published;
  $('publishRecover').hidden=Boolean(website);
  for(const id of ['publishTitle','publishUsername','publishReviews','publishPassages','publishCovers','publishSearch','publishIncludeAll','publishExcludeShown','publishApproved','publishCheckBtn','unpublishBtn','publishKeyCopy','publishRecoverKey','publishRecoverBtn'])$(id).disabled=busy;
  $('publishEntries').querySelectorAll('input').forEach(input=>input.disabled=busy);
}
function validSite(ref){return Boolean(ref&&/^[A-Za-z0-9_-]{1,100}$/.test(ref.id)&&/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(ref.name));}
function showLegacySites(){
  const sites=new Map(Object.values(prefs.sites).filter(validSite).map(site=>[site.name,site]));
  const list=$('publishLegacyLinks');
  for(const name of sites.keys()){
    const row=document.createElement('p'),link=document.createElement('a'),manage=document.createElement('a');
    link.href='https://'+name+'.netlify.app';
    link.textContent=name+'.netlify.app';
    manage.href='https://app.netlify.com/projects/'+name+'/overview';
    manage.textContent='Manage in Netlify ↗';
    for(const item of [link,manage]){item.target='_blank';item.rel='noopener noreferrer';}
    row.append(link,' · ',manage);list.append(row);
  }
  $('publishLegacy').hidden=!sites.size;
}
async function useKey(key,client=hostedPublication(key)){
  const address=new URL(await client.website,location.origin).href;
  editingKey=key;website=client;
  $('publishKeyValue').value=key;
  $('publishWebsiteLink').href=address;$('publishWebsiteLink').textContent=address;
}
function setSiteStatus(result){
  const changed=siteStatus&&siteStatus.revision!==result.revision;
  siteStatus=result;
  if(changed&&prepared)invalidate();
}
async function runOnline(message,action,{upload=false}={}){
  if(busy||archiveBusy)return;
  if(!navigator.onLine){status('Connect to the internet to manage your website.','error');return;}
  busy=true;publishing=upload;backgroundTasks++;
  if(upload)archiveBusy=true;
  refreshButtons();status(message,'working');
  try{await action();}
  catch(error){status(error.message,'error');}
  finally{
    if(upload)archiveBusy=false;
    busy=false;publishing=false;backgroundTasks--;refreshButtons();
  }
}
function checkWebsite(){
  if(!website)return;
  return runOnline('Checking your website…',async()=>{
    const result=await website.status();
    setSiteStatus(result);
    status(result.published?'Your public website is online.':'This website is offline.',result.published?'success':'');
  });
}
function recoverWebsite(){
  if(website||busy)return;
  const key=$('publishRecoverKey').value.trim();
  return runOnline('Checking your publishing key…',async()=>{
    const client=hostedPublication(key),result=await client.status();
    if(!result.revision)throw new Error('No website was found for this publishing key.');
    savePublishingKey(key);
    await useKey(key,client);
    $('publishRecoverKey').value='';$('publishRecover').open=false;
    invalidate();setSiteStatus(result);
    status(result.published?'You can now manage this public website.':'Website connected. It is currently offline.','success');
  });
}
function refresh(){
  if(!window.pathosPersonalReady)return;
  updateIncludedEntries();
  if(prepared){try{if(JSON.stringify(snapshot())!==prepared.signature)invalidate();}catch{invalidate();}}
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
    const html=files.get('/index.html');
    const body=JSON.stringify({snapshot:value,digest:await digest(html)});
    if(new TextEncoder().encode(body).length>4*1024*1024||new TextEncoder().encode(html).length>4*1024*1024)
      throw new Error('The public copy is too large. Exclude some covers or experiences and try again.');
    prepared={signature,body,revision:siteStatus?.revision??null};
    $('publishPreview').srcdoc=html;$('publishPreviewWrap').hidden=false;$('publishApproved').checked=false;
    const count=value.experiences.length;
    status(count===0?'This update will remove all experiences from the live site.':count===1?'This preview includes 1 experience.':'This preview includes '+count+' experiences.');
  }catch(error){invalidate();status(error.message,'error');}
  finally{busy=false;backgroundTasks--;refreshButtons();}
}
async function publish(){
  if(busy||archiveBusy||!prepared||!$('publishApproved').checked||website&&!siteStatus)return;
  if($('entryDialog').open||$('catalogueGuide').open||pendingWrites||lastSaveFailed){status('Finish saving your diary and close the open entry or setup before publishing.','error');return;}
  let signature;
  try{signature=JSON.stringify(snapshot());}catch(error){invalidate();status(error.message,'error');return;}
  if(signature!==prepared.signature){invalidate();status('The included entries changed. Preview the website again before publishing.','error');return;}
  if(!savePrefs())return;
  const {body,revision}=prepared;
  return runOnline('Publishing your website…',async()=>{
    if(!website){
      // Reuse a key saved by another open app window before starting a new site.
      const previousKey=readPublishingKey();
      const key=previousKey||newPublishingKey();
      if(!previousKey)savePublishingKey(key);
      await useKey(key);
      if(previousKey){
        setSiteStatus(await website.status());
        invalidate();
        throw new Error('A publishing key already exists on this device. Preview your website again before publishing.');
      }
    }
    const result=await website.publish(revision,body);
    siteStatus=result;invalidate();
    status('Published. Anyone with the link can open your website.','success');
  },{upload:true});
}
function unpublish(){
  if(busy||archiveBusy||!siteStatus?.published)return;
  if(!navigator.onLine){status('Connect to the internet to take your website offline.','error');return;}
  if(!confirm('Take your public website offline? The private diary on this device will still be available.'))return;
  const revision=siteStatus.revision;
  return runOnline('Taking your website offline…',async()=>{
    const result=await website.unpublish(revision);
    setSiteStatus(result);
    status('Your public website is offline.','success');
  },{upload:true});
}
$('publishPreviewBtn').addEventListener('click',()=>void preview());
$('publishNowBtn').addEventListener('click',()=>void publish());
$('publishCheckBtn').addEventListener('click',()=>void checkWebsite());
$('unpublishBtn').addEventListener('click',()=>void unpublish());
$('publishRecoverBtn').addEventListener('click',()=>void recoverWebsite());
$('publishKeyCopy').addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(editingKey);status('Publishing key copied. Keep it private.','success');}
  catch{$('publishKeyValue').type='text';$('publishKeyValue').select();status('Copy the selected key and keep it private.');}
});
$('publishKeyDetails').addEventListener('toggle',()=>{if(!$('publishKeyDetails').open)$('publishKeyValue').type='password';});
$('publishSearch').addEventListener('input',refresh);
$('publishIncludeAll').addEventListener('click',()=>{prefs.entryMode='all';selected.clear();excluded.clear();invalidate();savePrefs();refresh();});
$('publishExcludeShown').addEventListener('click',()=>{
  document.querySelectorAll('[data-publish-entry]').forEach(input=>{
    if(prefs.entryMode==='all')excluded.add(input.dataset.publishEntry);else selected.delete(input.dataset.publishEntry);
  });
  invalidate();savePrefs();refresh();
});
for(const id of ['publishTitle','publishUsername','publishReviews','publishPassages','publishCovers'])$(id).addEventListener('input',()=>{invalidate();savePrefs();});
$('publishApproved').addEventListener('change',refreshButtons);
async function openPublishing(){
  refresh();
  if(website&&!siteStatus&&navigator.onLine)await checkWebsite();
}
async function initialize(){
  showLegacySites();
  try{
    const key=readPublishingKey();
    if(key)await useKey(key);
  }catch{status('Could not load the private publishing key on this device.','error');}
  window.PathosPublishing={refresh,open:openPublishing};
  refresh();
  if($('publishing').classList.contains('active')&&website&&navigator.onLine)void checkWebsite();
}
void initialize();
