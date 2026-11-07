/* Personal-only catalogue help. Never reads or writes the diary archive. */
(()=>{
  'use strict';
  const guide=document.getElementById('catalogueGuide');
  const intro=document.getElementById('catalogueIntro');
  const introKey='pathos-personal.catalogue-intro-v1';
  const sources={
    openlibrary:{name:'Open Library'},
    googlebooks:{name:'Google Books',input:'googleBooksKeyInput',key:GOOGLE_BOOKS_KEY,status:'googleBooksKeyStatus',overview:'googleBooksOverviewStatus'},
    tmdb:{name:'TMDB',input:'tmdbTokenInput',key:TMDB_TOKEN_KEY,status:'tmdbTokenStatus',overview:'tmdbOverviewStatus'}
  };
  const tests=new Map();
  let introDismissed=false;
  try{introDismissed=localStorage.getItem(introKey)==='dismissed';}catch{/* Help remains usable without preferences. */}
  const node=id=>document.getElementById(id);
  const stored=source=>{try{return localStorage.getItem(source.key)||'';}catch{return '';}};
  function feedback(id,message,state=''){
    const element=node(id);element.textContent=message;element.dataset.state=state;
  }
  function dismissIntro(){
    introDismissed=true;intro.hidden=true;
    try{localStorage.setItem(introKey,'dismissed');}catch{/* Dismiss for this window. */}
  }
  function refreshHint(){
    const type=node('entryForm').elements.type.value;
    const button=node('entryCatalogueSetup');
    button.hidden=!['Book','Film','TV'].includes(type);
    button.textContent=(type==='Film'||type==='TV')&&!stored(sources.tmdb)?'Enable '+(type==='Film'?'film':'TV')+' search':'Catalogue setup';
    button.dataset.source=type==='Book'?'googlebooks':'tmdb';
  }
  function refresh(){
    intro.hidden=!window.pathosPersonalReady||introDismissed;
    for(const source of [sources.googlebooks,sources.tmdb]){
      const saved=Boolean(stored(source));
      node(source.overview).textContent=saved?'Credential saved':'Optional · set up';
      feedback(source.status,saved?'Saved in this browser. Test the connection to check access.':'Optional · no credential saved.');
    }
    refreshHint();
  }
  function cancelTest(provider){
    const current=tests.get(provider);
    if(current){tests.delete(provider);current.controller.abort();}
    guide.querySelector('[data-test-catalogue="'+provider+'"]').disabled=false;
    feedback(provider+'TestStatus','');
  }
  function open(provider='openlibrary'){
    if(archiveBusy)return;
    if(!Object.hasOwn(sources,provider))provider='openlibrary';
    dismissIntro();
    if(node('entryDialog').open){cancelCatalogue();renderCatalogResults([]);}
    for(const [name,source] of Object.entries(sources)){
      cancelTest(name);
      if(source.input)node(source.input).value=stored(source);
      node('catalogue-'+name).open=name===provider;
    }
    refresh();
    node('catalogueSiteAddress').textContent=location.origin+'/*';
    node('catalogueGuideDone').textContent=node('entryDialog').open?'Back to entry':'Done';
    guide.showModal();
    node('catalogueGuideTitle').focus();
    node('catalogue-'+provider).scrollIntoView({block:'nearest'});
  }
  function validation(provider,value){
    if(provider==='googlebooks'&&value&&!/^[A-Za-z0-9_-]{20,200}$/.test(value))return 'Check the Google Books API key and paste its value alone.';
    if(provider==='tmdb'&&/^[a-f0-9]{32}$/i.test(value))return 'Use the long API Read Access Token from TMDB Settings → API.';
    if(provider==='tmdb'&&value&&(/\s/.test(value)||value.length>4096))return 'Paste the API Read Access Token alone, without a Bearer prefix.';
    return '';
  }
  function save(provider){
    if(archiveBusy)return;
    const source=sources[provider],value=node(source.input).value.trim();
    cancelTest(provider);
    const invalid=validation(provider,value);
    if(invalid){feedback(source.status,invalid,'error');return;}
    try{
      if(value)localStorage.setItem(source.key,value);else localStorage.removeItem(source.key);
      node(source.input).value=value;
      refresh();setCatalogHint();
      feedback(source.status,value?'Saved in this browser. Test the connection to check access.':'Connection removed.','success');
      toast(source.name+(value?' credential saved':' credential removed'));
    }catch{
      feedback(source.status,'Could not save this credential in your browser. Try again with browser storage enabled.','error');
    }
  }
  function failure(provider,status){
    if(status===429)return 'The catalogue request limit was reached. Try again later.';
    if(status>=500)return 'The catalogue is temporarily unavailable. Try again later.';
    if(provider==='googlebooks'&&[400,401,403].includes(status))return 'Access was refused. Check the key, enable Books API and check the website and API restrictions in Google Cloud.';
    if(provider==='tmdb'&&[401,403].includes(status))return 'TMDB refused this token. Copy the API Read Access Token from Settings → API and try again.';
    return 'The catalogue could not be reached. Try again later.';
  }
  async function test(provider){
    if(archiveBusy)return;
    cancelTest(provider);
    const source=sources[provider],value=source.input?node(source.input).value.trim():'';
    const status=provider+'TestStatus';
    if(source.input&&!value){feedback(status,'Paste your '+(provider==='tmdb'?'API Read Access Token':'API key')+' first.','error');return;}
    const invalid=validation(provider,value);
    if(invalid){feedback(status,invalid,'error');return;}
    if(!navigator.onLine){feedback(status,'Connect to the internet to test this catalogue. You can keep logging manually offline.','error');return;}
    const current={controller:new AbortController(),timedOut:false};
    tests.set(provider,current);
    const button=guide.querySelector('[data-test-catalogue="'+provider+'"]');
    button.disabled=true;feedback(status,'Testing connection…');backgroundTasks++;
    const timeout=setTimeout(()=>{current.timedOut=true;current.controller.abort();},8000);
    try{
      // Fixed, public sample requests: no diary titles, reviews or identifiers.
      const url=provider==='openlibrary'?'https://openlibrary.org/search.json?q=isbn%3A9780140328721&limit=1&fields=key':provider==='googlebooks'?'https://www.googleapis.com/books/v1/volumes?'+new URLSearchParams({q:'isbn:9780140328721',maxResults:'1',key:value}):'https://api.themoviedb.org/3/configuration';
      const response=await fetch(url,{signal:current.controller.signal,credentials:'omit',redirect:'error',referrerPolicy:provider==='googlebooks'?'strict-origin-when-cross-origin':'no-referrer',headers:provider==='tmdb'?{Authorization:'Bearer '+value,accept:'application/json'}:undefined});
      const ok=response.ok,httpStatus=response.status;
      await response.body?.cancel();
      if(tests.get(provider)!==current)return;
      if(!ok){feedback(status,failure(provider,httpStatus),'error');return;}
      const unsaved=source.input&&stored(source)!==value;
      feedback(status,'Connection works.'+(unsaved?' Save this credential to enable it in Πathos.':''),'success');
    }catch{
      if(tests.get(provider)===current)feedback(status,current.timedOut?'The connection timed out. Try again when the catalogue is available.':'Could not connect. Check your internet connection and try again.','error');
    }finally{
      clearTimeout(timeout);backgroundTasks--;
      if(tests.get(provider)===current){tests.delete(provider);button.disabled=false;}
    }
  }
  document.querySelectorAll('[data-catalogue-guide]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.catalogueGuide)));
  node('introCatalogueSetup').addEventListener('click',()=>open());
  node('catalogueIntroLater').addEventListener('click',dismissIntro);
  node('entryCatalogueSetup').addEventListener('click',event=>open(event.currentTarget.dataset.source));
  node('catalogueImportLink').addEventListener('click',()=>showView('import'));
  for(const id of ['closeCatalogueGuide','catalogueGuideDone'])node(id).addEventListener('click',()=>guide.close());
  guide.addEventListener('close',()=>{for(const provider of Object.keys(sources))cancelTest(provider);});
  for(const [provider,source] of Object.entries(sources)){
    guide.querySelector('[data-test-catalogue="'+provider+'"]').addEventListener('click',()=>void test(provider));
    if(source.input)node(source.input).addEventListener('input',()=>cancelTest(provider));
  }
  node('saveGoogleBooksBtn').addEventListener('click',()=>save('googlebooks'));
  node('saveTmdbBtn').addEventListener('click',()=>save('tmdb'));
  window.addEventListener('storage',event=>{if([introKey,GOOGLE_BOOKS_KEY,TMDB_TOKEN_KEY].includes(event.key)){if(event.key===introKey)introDismissed=event.newValue==='dismissed';refresh();setCatalogHint();}});
  window.PathosCatalogues={open,refresh,refreshHint};
  refresh();
})();
