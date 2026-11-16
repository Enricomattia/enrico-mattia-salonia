export const profilePath='/pathos-profile.json';
export const hostedProfilePath='/api/pathos/profile';
const profileFormat='pathos-profile-v1';
const maxProfileBytes=72*1024;

export function profilePhoto(value){
  return typeof value==='string'&&value.length<=64*1024&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value)?value:'';
}

export function publicProfile({username,title,photo}){
  const name=[username,title].find(value=>typeof value==='string'&&value.trim());
  return {format:profileFormat,name:name?.trim().slice(0,120)||'Pathos',photo:profilePhoto(photo)};
}

export function friendAddress(value){
  let url;
  try{url=new URL(value.trim());}catch{return '';}
  if(url.protocol!=='https:'||url.username||url.password||url.port)return '';
  // Use the stable site address, rather than a numbered or temporary deploy.
  if(/^pathos-[a-z0-9]+\.netlify\.app$/.test(url.hostname)&&['/','/index.html'].includes(url.pathname))return url.origin+'/';
  if(url.hostname==='enricomattiasalonia.com'&&['/pathos','/pathos/','/pathos/app.html'].includes(url.pathname))return url.origin+'/pathos';
  if(url.hostname==='enricomattiasalonia.com'&&/^\/pathos-share\/[a-f0-9]{32}\/?$/.test(url.pathname))return url.origin+url.pathname.replace(/\/$/,'');
  return '';
}

export async function fetchFriendProfile(address,signal){
  const url=friendAddress(address);
  if(!url)return null;
  const target=new URL(url);
  const path=target.pathname==='/pathos'?hostedProfilePath:target.pathname==='/'?profilePath:'';
  if(!path)return null;
  const response=await fetch(new URL(path,target),{
    credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',cache:'no-store',signal
  });
  if(!response.ok||!/^application\/json\b/i.test(response.headers.get('Content-Type')||'')){
    await response.body?.cancel();
    return null;
  }
  const reader=response.body?.getReader();
  if(!reader)return null;
  const decoder=new TextDecoder();
  let size=0,raw='';
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.length;
      if(size>maxProfileBytes)return null;
      raw+=decoder.decode(value,{stream:true});
    }
    const value=JSON.parse(raw+decoder.decode());
    if(value?.format!==profileFormat||typeof value.name!=='string'||!value.name.trim())return null;
    return {name:value.name.trim().slice(0,120),photo:profilePhoto(value.photo)};
  }finally{await reader.cancel().catch(()=>{});}
}
