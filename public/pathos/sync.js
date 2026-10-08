const config=window.PATHOS_CONFIG||{};
const bridge=window.pathosBridge;
const controls=document.createElement('div');controls.style.cssText='display:flex;align-items:center;gap:9px;flex-wrap:wrap';
const status=document.createElement('span');status.className='pathos-sync-status';status.textContent='Connecting…';
const toggle=document.createElement('button');toggle.type='button';toggle.className='pathos-auth-control';toggle.textContent='Sign in';
controls.append(status,toggle);document.querySelector('.top-actions')?.prepend(controls);
const modal=document.createElement('dialog');modal.className='pathos-signin-dialog';
modal.innerHTML=`<form id="pathos-login-form"><h2 style="font-size:22px">Private editor</h2><label>Email <input name="email" type="email" autocomplete="username" required></label><label>Password <input name="password" type="password" autocomplete="current-password" required></label><div class="pathos-sync-status" id="pathos-login-message"></div><menu><button type="button" id="pathos-login-cancel" class="btn">Cancel</button><button type="submit" class="btn primary">Sign in</button></menu></form>`;
document.body.append(modal);modal.querySelector('#pathos-login-cancel').onclick=()=>modal.close();
const show=message=>status.textContent=message;
const valid=/^https:\/\/[-a-z0-9.]+\.supabase\.co\/?$/.test(config.supabaseUrl||'')
  && /^[a-zA-Z0-9._-]{20,}$/.test(config.supabasePublishableKey||'')
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.ownerUserId||'');
if(!valid){show('Πathos is not yet connected to Supabase');toggle.disabled=true;}
else {
 try{
  const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const supabase=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let isOwner=false,queue=Promise.resolve(),revision=0,savePending=false,saveFailed=false;
  function ownerMode(active){
    isOwner=active;window.pathosCanEdit=active;document.body.classList.toggle('pathos-owner',active);
    toggle.textContent=active?'Sign out':'Sign in';
    if(!active)document.querySelectorAll('#metadata.active,#import.active').forEach(()=>document.querySelector('[data-view="home"]')?.click());
  }
  async function loadArchive(){
    show('Loading…');
    const {data:userData,error:userError}=await supabase.auth.getUser();
    if(userError&&userError.message!=='Auth session missing!')console.warn('Authentication:',userError.message);
    const owner=!!(userData?.user&&userData.user.id===config.ownerUserId);
    ownerMode(owner);
    const {data,error}=await supabase.rpc(owner?'pathos_get_my_archive':'pathos_get_public_archive',owner?{}:{p_owner_id:config.ownerUserId});
    if(error){show('Load failed — '+error.message);return;}
    bridge.setArchive(data||{schemaVersion:6,works:[],experiences:[]});
    show(owner?'Private archive · Saved online':'Public archive');
  }
  window.pathosHostedSave=archive=>{
    if(!isOwner){show('Sign in to save');return;}
    const number=++revision;savePending=true;saveFailed=false;show('Saving…');
    queue=queue.catch(()=>{}).then(async()=>{
      const {error}=await supabase.rpc('pathos_replace_my_archive',{p_archive:archive});
      if(error){
        saveFailed=true;
        show('Save failed — export a backup · '+error.message);
        console.error('Πathos remote save failed:',error);
        alert('Πathos could not save to Supabase. Your changes are still visible in this tab, but NOT backed up online. Export a JSON backup now before closing or reloading.');
        return;
      }
      if(number===revision){savePending=false;show('Saved online');}
    });
  };
  toggle.onclick=async()=>{
    if(isOwner){
      if(!confirm('Sign out of the private editor?'))return;
      if(savePending){await queue.catch(()=>{});if(saveFailed){alert('The latest save failed. Export a backup before signing out.');return;}}
      const {error}=await supabase.auth.signOut();
      if(error){show('Sign-out failed');return;}
      await loadArchive();
    }else modal.showModal();
  };
  modal.querySelector('form').addEventListener('submit',async event=>{
    event.preventDefault();const form=new FormData(event.target);
    const info=modal.querySelector('#pathos-login-message');
    info.textContent='Signing in…';
    const {data,error}=await supabase.auth.signInWithPassword({email:String(form.get('email')||'').trim(),password:String(form.get('password')||'')});
    if(error){info.textContent=error.message;return;}
    if(data.user?.id!==config.ownerUserId){await supabase.auth.signOut();info.textContent='This account is not the Πathos editor.';return;}
    event.target.reset();modal.close();await loadArchive();
  });
  window.addEventListener('beforeunload',event=>{if(savePending||saveFailed){event.preventDefault();event.returnValue='';}});
  await loadArchive();
 }catch(error){console.error('Πathos initialization',error);show('Connection error — '+String(error.message||error));}
}
