import{friendAddress,fetchFriendProfile,profilePhoto}from'./public-profile.mjs';

const $=id=>document.getElementById(id);
const dialog=$('friendDialog'),form=$('friendForm'),address=$('friendAddress'),nickname=$('friendNickname');
const save=$('friendSave'),details=$('friendDetails'),feedback=$('friendFeedback');
let saved=[],editing=null,draft=null,lookup=null,writing=false;
let renderRevision=0;
const friendName=friend=>friend.nickname||friend.name;

function identity(friend){
  const avatar=document.createElement('span'),name=document.createElement('strong');
  avatar.className='friend-avatar';
  avatar.setAttribute('aria-hidden','true');
  const words=friendName(friend).trim().split(/\s+/);
  avatar.textContent=words.slice(0,2).map(word=>Array.from(word)[0]).join('').toLocaleUpperCase()||'Π';
  const photo=profilePhoto(friend.photo);
  if(photo){
    const image=document.createElement('img');
    image.alt='';
    image.addEventListener('error',()=>image.remove(),{once:true});
    image.src=photo;avatar.append(image);
  }
  name.textContent=friendName(friend);
  return [avatar,name];
}

async function refresh(){
  if(!window.pathosPersonalReady)return;
  const revision=++renderRevision;
  const list=$('friendsList');
  try{
    const records=await readLocalArchive('friends');
    if(revision!==renderRevision)return;
    saved=Array.isArray(records)?records:[];
    const rows=saved.map(friend=>{
      const row=document.createElement('li'),link=document.createElement('a'),edit=document.createElement('button');
      link.className='friend-identity';
      link.href=friendAddress(friend.url);link.target='_blank';link.rel='noopener noreferrer';
      link.append(...identity(friend));
      edit.type='button';edit.className='btn subtle';edit.textContent='Edit';
      edit.setAttribute('aria-label','Edit '+friendName(friend));
      edit.addEventListener('click',()=>openDialog(friend));
      row.append(link,edit);
      return row;
    });
    list.replaceChildren(...rows);
    $('friendsEmpty').hidden=rows.length>0;
    $('friendsStatus').textContent='';
  }catch{
    if(revision===renderRevision)$('friendsStatus').textContent='Could not load your friends from this device.';
  }
}

// Changes to different friends can be saved from multiple windows without replacing the whole list from stale UI state.
function writeFriend(friend){
  return new Promise((resolve,reject)=>{
    const tx=localDatabase.transaction('archives','readwrite');
    const store=tx.objectStore('archives'),request=store.get('friends');
    let failure;
    request.onsuccess=()=>{
      const records=request.result||[];
      const url=editing?.url||friend.url;
      const previous=records.find(item=>item.url===url);
      if(editing&&JSON.stringify(previous)!==JSON.stringify(editing))failure='This friend changed in another window. Reopen the list and try again.';
      else if(!editing&&previous)failure='This friend is already on your list.';
      if(failure){tx.abort();return;}
      const next=editing?records.flatMap(item=>item.url===url?(friend?[friend]:[]):[item]):[...records,friend];
      store.put(next,'friends');
    };
    tx.oncomplete=resolve;
    tx.onabort=()=>reject(new Error(failure||'Could not save your friends on this device.'));
  });
}

function showDraft(){
  details.hidden=!draft;
  nickname.disabled=!draft;
  save.textContent=draft?'Save friend':'Find profile';
  if(draft){
    const preview=$('friendPreview');
    preview.hidden=!draft.name;
    preview.replaceChildren(...(draft.name?identity(draft):[]));
    nickname.required=!draft.name;
    $('friendNicknameLabel').textContent=draft.name?'Nickname (optional)':'Nickname';
  }
}

function openDialog(friend=null){
  if(!window.pathosPersonalReady||dialog.open||writing)return;
  editing=friend;
  draft=friend?{...friend,nickname:''}:null;
  $('friendDialogTitle').textContent=friend?'Edit friend':'Add friend';
  $('friendRemove').hidden=!friend;
  $('friendRefresh').hidden=!friend;
  address.readOnly=Boolean(friend);
  address.value=friend?.url||'';
  nickname.value=friend?.nickname||'';
  feedback.textContent='';
  showDraft();
  dialog.showModal();
  (friend?nickname:address).focus();
}

async function findProfile(){
  const url=friendAddress(address.value);
  if(!url){feedback.textContent='Paste the public Πathos website link your friend shared.';return;}
  if(!editing&&saved.some(friend=>friend.url===url)){feedback.textContent='This friend is already on your list.';return;}
  const attempt=new AbortController();
  lookup=attempt;
  const timer=setTimeout(()=>attempt.abort(),6500);
  save.disabled=$('friendRefresh').disabled=true;
  feedback.textContent='Looking up the public profile…';
  let profile=null;
  try{profile=await fetchFriendProfile(url,attempt.signal);}catch{/* An older, private or offline site can still be saved with a nickname. */}
  finally{clearTimeout(timer);}
  if(lookup!==attempt||!dialog.open)return;
  lookup=null;save.disabled=$('friendRefresh').disabled=false;
  if(!profile&&editing){
    feedback.textContent='The published profile is unavailable. Your saved profile is still here.';
    return;
  }
  draft={url,name:profile?.name||'',photo:profile?.photo||''};
  address.value=url;
  feedback.textContent=profile?'':'Profile unavailable. You can save the link with a nickname.';
  showDraft();
  nickname.focus();
}

async function saveFriend(remove=false){
  if(writing||lookup)return;
  const label=nickname.value.trim().slice(0,60);
  if(!remove&&!draft.name&&!label){feedback.textContent='Enter a nickname for this friend.';return;}
  writing=true;backgroundTasks++;
  save.disabled=$('friendRemove').disabled=$('friendRefresh').disabled=$('closeFriendDialog').disabled=true;
  try{
    await writeFriend(remove?null:{...draft,nickname:label});
    dialog.close();
    await refresh();
    $('friendAdd').focus();
  }catch(error){feedback.textContent=error.message;}
  finally{
    writing=false;backgroundTasks--;
    save.disabled=$('friendRemove').disabled=$('friendRefresh').disabled=$('closeFriendDialog').disabled=false;
  }
}

$('openFriendsBtn').addEventListener('click',()=>{
  showView('friends');
  $('friendsHeading').focus({preventScroll:true});
});
$('openFriendsBtn').hidden=false;
$('friendAdd').addEventListener('click',()=>openDialog());
$('closeFriendDialog').addEventListener('click',()=>dialog.close());
$('friendRefresh').addEventListener('click',()=>void findProfile());
$('friendRemove').addEventListener('click',()=>void saveFriend(true));
address.addEventListener('input',()=>{
  lookup?.abort();lookup=null;
  save.disabled=false;
  draft=null;
  feedback.textContent='';
  showDraft();
});
form.addEventListener('submit',event=>{
  event.preventDefault();
  if(!writing&&!lookup)void(draft?saveFriend():findProfile());
});
dialog.addEventListener('cancel',event=>{if(writing)event.preventDefault();});
dialog.addEventListener('close',()=>{
  lookup?.abort();lookup=null;
  save.disabled=$('friendRefresh').disabled=false;
});
window.addEventListener('focus',()=>{if($('friends').classList.contains('active'))void refresh();});
window.PathosFriends={refresh};
