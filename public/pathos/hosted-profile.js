import{hostedProfilePath,profilePhoto}from'/pathos-personal/public-profile.mjs';

const $=id=>document.getElementById(id);
const dialog=$('profilePhotoDialog'),file=$('profilePhotoFile'),save=$('profilePhotoSave'),remove=$('profilePhotoRemove');
const feedback=$('profilePhotoStatus');
let published='',draft='',busy=false;

function renderPicture(image,photo){
  image.hidden=!photo;
  if(photo)image.src=photo;else image.removeAttribute('src');
}
function render(){
  renderPicture($('profilePhotoPreview'),draft);
  file.disabled=busy;
  remove.hidden=!draft;
  remove.disabled=busy;
  save.disabled=busy||draft===published;
  $('closeProfilePhoto').disabled=busy;
}
function showPublished(photo){
  published=profilePhoto(photo);
  renderPicture($('hostedProfileAvatar'),published);
}
async function loadProfile(){
  const response=await fetch(hostedProfilePath,{credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Could not load the public profile.');
  showPublished((await response.json()).photo);
}
const initialLoad=loadProfile().catch(()=>{});
$('openProfilePhoto').addEventListener('click',async()=>{
  if(!window.pathosCanEdit||busy||dialog.open)return;
  $('settingsMenu').open=false;
  await initialLoad;
  if(!window.pathosCanEdit||dialog.open)return;
  draft=published;file.value='';feedback.textContent='';
  render();dialog.showModal();
});
file.addEventListener('change',async()=>{
  const image=file.files[0];file.value='';
  if(!image||!window.pathosCanEdit||busy)return;
  if(image.size>10*1024*1024||image.type&&!['image/jpeg','image/png','image/webp'].includes(image.type)){
    feedback.textContent='Choose a JPEG, PNG or WebP image up to 10 MB.';return;
  }
  busy=true;feedback.textContent='Preparing photo…';render();
  try{
    const photo=profilePhoto(await compressCover(image,192,192));
    if(!photo)throw new Error('Invalid photo');
    if(dialog.open){draft=photo;feedback.textContent='';}
  }catch{feedback.textContent='Could not read that image. Choose another photo.';}
  finally{busy=false;render();}
});
remove.addEventListener('click',()=>{draft='';feedback.textContent='';render();});
$('profilePhotoForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!window.pathosCanEdit||busy||draft===published)return;
  busy=true;backgroundTasks++;feedback.textContent='Saving…';render();
  try{
    const result=await window.pathosSaveProfilePhoto(draft);
    showPublished(result.photo);
    dialog.close();
    toast(published?'Public profile photo saved':'Public profile photo removed');
  }catch(error){
    if(dialog.open)feedback.textContent=error.message;
    else toast(error.message);
  }finally{busy=false;backgroundTasks--;render();}
});
$('closeProfilePhoto').addEventListener('click',()=>dialog.close());
dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
dialog.addEventListener('close',()=>{if(window.pathosCanEdit)$('settingsMenu').querySelector('summary').focus();});
window.addEventListener('pathos-owner-change',()=>{
  if(!window.pathosCanEdit&&dialog.open)dialog.close();
});
