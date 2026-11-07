import{digest}from'./publish-core.mjs';
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
export function netlifyClient(token,{fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  if(typeof token!=='string'||!token||/\s/.test(token)||token.length>8192)throw new Error('Reconnect your Netlify account.');
  async function request(path,{method='GET',json,body,signal}={}){
    // All credentials and publication bytes go directly to this fixed API host.
    if(!/^\/[A-Za-z0-9_/?=.&%-]+$/.test(path))throw new Error('Invalid Netlify operation.');
    const controller=new AbortController(),abort=()=>controller.abort();
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    const timer=setTimeout(abort,30000);
    try{
      const response=await fetcher('https://api.netlify.com/api/v1'+path,{method,body:json===undefined?body:JSON.stringify(json),signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+token,'Content-Type':json===undefined?'application/octet-stream':'application/json'}});
      if(!response.ok){await response.body?.cancel();throw new Error(response.status===401?'Netlify sign-in expired. Reconnect your account.':response.status===403?'Netlify refused this action. Check the account’s permissions.':response.status===429?'Netlify’s request limit was reached. Wait before trying again.':'Netlify could not complete the request. Check your project in Netlify before retrying.');}
      if(response.status===204)return null;
      const raw=await response.text();if(raw.length>2*1024*1024)throw new Error('Netlify returned an unexpected response.');
      try{return raw?JSON.parse(raw):null;}catch{throw new Error('Netlify returned an unexpected response.');}
    }catch(error){
      if(error.name==='AbortError')throw new Error('The Netlify operation stopped or timed out. Check your project before retrying.');
      if(error instanceof TypeError)throw new Error('Could not connect to Netlify. Check your internet connection.');
      throw error;
    }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async function verify(ref,account,signal){
    if(!id(ref?.id)||!id(ref?.publisherId)||!id(account?.id))throw new Error('The publication connection is invalid.');
    const site=await request('/sites/'+ref.id,{signal});
    const metadata=await request('/sites/'+ref.id+'/metadata',{signal});
    if(site.account_id!==account.id||site.name!==ref.name||metadata?.pathos_kind!=='personal-publication-v1'||metadata.pathos_id!==ref.publisherId||site.build_settings?.repo_url||site.repo?.repo_url||site.custom_domain||(site.domain_aliases||[]).length)throw new Error('This project is not the dedicated Πathos publication. Nothing was uploaded.');
    return site;
  }
  return{
    user:signal=>request('/user',{signal}),
    accounts:signal=>request('/accounts',{signal}),
    async create(account,publisherId,signal){
      if(!id(account?.slug)||!id(account?.id)||!id(publisherId))throw new Error('Choose a valid Netlify team.');
      const name='pathos-'+publisherId.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,24);
      const site=await request('/'+account.slug+'/sites',{method:'POST',json:{name,force_ssl:true},signal});
      if(!id(site?.id)||site.name!==name||site.account_id!==account.id)throw new Error('Netlify did not confirm the destination account. Nothing was uploaded.');
      const ref={id:site.id,name:site.name,accountId:account.id,publisherId};
      try{await request('/sites/'+site.id+'/metadata',{method:'PUT',json:{pathos_kind:'personal-publication-v1',pathos_id:publisherId},signal});}
      catch{throw new Error('An empty Πathos project was created, but its setup failed. Open Netlify to review it before reconnecting.');}
      return ref;
    },
    async deploy(ref,account,files,{signal,onProgress=()=>{}}={}){
      await verify(ref,account,signal);
      if(!(files instanceof Map)||!files.has('/index.html')||[...files.keys()].some(path=>!['/index.html','/robots.txt','/_headers'].includes(path)))throw new Error('The public website is invalid. Preview it again.');
      const hashes={},byHash=new Map();
      for(const[path,content]of files){const hash=await digest(content,'SHA-1');hashes[path]=hash;byHash.set(hash,{path,content});}
      onProgress('Uploading the approved public copy…');
      const deploy=await request('/sites/'+ref.id+'/deploys?draft=true',{method:'POST',json:{files:hashes,draft:true},signal});
      if(!id(deploy?.id)||deploy.site_id!==ref.id||!Array.isArray(deploy.required))throw new Error('Netlify did not confirm the upload destination.');
      for(const hash of deploy.required){
        const file=byHash.get(hash);if(!file)throw new Error('Netlify requested an unexpected file. Upload stopped.');
        await request('/deploys/'+deploy.id+'/files'+file.path,{method:'PUT',body:file.content,signal});
      }
      onProgress('Netlify is preparing the website…');
      let ready=false;
      for(let attempt=0;attempt<60;attempt++){
        const state=await request('/sites/'+ref.id+'/deploys/'+deploy.id,{signal});
        if(state?.site_id!==ref.id)throw new Error('Netlify returned a different project. Publication stopped.');
        if(state.state==='ready'){ready=true;break;}
        if(['error','failed'].includes(state.state))throw new Error('Netlify could not prepare this version. Your previous published version is unchanged.');
        if(signal?.aborted)throw new Error('Publication stopped.');
        await pause(1500);
      }
      if(!ready)throw new Error('Netlify is still preparing this version. Open Netlify before trying another upload.');
      await verify(ref,account,signal);
      onProgress('Setting the current website version…');
      const promoted=await request('/sites/'+ref.id+'/deploys/'+deploy.id+'/restore',{method:'POST',signal});
      if(promoted?.id!==deploy.id||promoted.site_id!==ref.id)throw new Error('Netlify did not confirm the current version. Check the project before retrying.');
      return{...ref,deployId:deploy.id,url:'https://'+ref.name+'.netlify.app',publishedAt:new Date().toISOString()};
    }
  };
}
