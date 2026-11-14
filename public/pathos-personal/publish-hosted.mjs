import {digest} from './publish-core.mjs';

const SITE_KEY='pathos-personal.hosted-publication-v1';
const validKey=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

export function hostedPublication(editorKey,fetcher=fetch){
  if(!validKey(editorKey))throw new Error('The private publishing key is invalid.');
  const id=digest('pathos-publication-v1:'+editorKey).then(hash=>hash.slice(0,32));
  const website=id.then(value=>'/pathos-share/'+value);
  async function request(method,revision,body){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    const headers={Authorization:'Bearer '+editorKey};
    if(method==='PUT'){
      headers['Content-Type']='application/json';
      if(!revision)headers['If-None-Match']='*';
    }
    if(revision)headers['If-Match']=revision;
    try{
      const response=await fetcher('/api/pathos-personal/publication/'+await id,{
        method,headers,body,signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'
      });
      if(response.status===429)throw new Error('Too many publication requests. Wait a minute and try again.');
      if(response.status===413)throw new Error('The public copy is too large. Exclude some covers or experiences and try again.');
      const result=await response.json().catch(()=>null);
      if(!response.ok)throw new Error(result?.error||'Πathos could not reach the publishing service. Try again shortly.');
      const hasRevision=typeof result?.revision==='string'&&/^[a-f0-9-]{36}$/.test(result.revision);
      if(typeof result?.published!=='boolean'||(!hasRevision&&(result.revision!==null||result.published||method!=='GET')))
        throw new Error('Πathos could not confirm the public copy. Check the website status.');
      return result;
    }catch(error){
      if(controller.signal.aborted||error instanceof TypeError)throw new Error('The connection was interrupted. Check the website status before trying again.');
      throw error;
    }finally{clearTimeout(timer);}
  }
  return{
    website,
    status:()=>request('GET'),
    publish:(revision,body)=>request('PUT',revision,body),
    unpublish:revision=>request('DELETE',revision)
  };
}

export function readPublishingKey(){return localStorage.getItem(SITE_KEY);}
export function savePublishingKey(key){
  if(!validKey(key))throw new Error('Use the 64-character publishing key from the original browser.');
  localStorage.setItem(SITE_KEY,key);
}
export function newPublishingKey(){
  return [...crypto.getRandomValues(new Uint8Array(32))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
