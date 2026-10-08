/* Πathos Personal offline application shell. No access to /pathos or Supabase. */
const CACHE='pathos-personal-shell-v1';
const COVERS='pathos-personal-covers-v1';
const SHELL=[
 '/pathos-personal/index.html',
 '/pathos-personal/manifest.webmanifest',
 '/pathos-personal/icon-192.png',
 '/pathos-personal/icon-512.png'
];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pathos-personal-')&&!([CACHE,COVERS].includes(key))).map(key=>caches.delete(key)))),
  self.clients.claim()
 ]));
});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin===self.location.origin){
   if(!url.pathname.startsWith('/pathos-personal/'))return;
   if(req.mode==='navigate'||SHELL.includes(url.pathname)){
     event.respondWith(caches.match(req,{ignoreSearch:true}).then(hit=>hit||fetch(req).then(response=>{
        if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));}
        return response;
     }).catch(()=>caches.match('/pathos-personal/index.html'))));
   }
   return;
 }
 if(req.destination==='image'&&['covers.openlibrary.org','image.tmdb.org'].includes(url.hostname)){
   event.respondWith(caches.open(COVERS).then(async cache=>{
     const cached=await cache.match(req);
     if(cached)return cached;
     try{
       const response=await fetch(req);
       if(response.ok||response.type==='opaque'){
         const copy=response.clone();
         event.waitUntil((async()=>{
           await cache.put(req,copy);
           const keys=await cache.keys();
           if(keys.length>130)await Promise.all(keys.slice(0,keys.length-130).map(key=>cache.delete(key)));
         })());
       }
       return response;
     }catch(error){return cached||Response.error();}
   }));
 }
});
