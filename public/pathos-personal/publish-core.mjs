// Explicit public projection and a self-contained reader. No storage or accounts.
const text=(value,max=500)=>typeof value==='string'?value.slice(0,max):'';
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value:'';
export function publicImage(value){
  if(typeof value!=='string')return '';
  if(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(value)&&value.length<6*1024*1024)return value;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&![...url.searchParams.keys()].some(key=>/key|token|signature|credential|^sig$/i.test(key))?url.href:'';}catch{return '';}
}
export function projectArchive(archive,ids,options={}){
  if(!Array.isArray(archive?.works)||!Array.isArray(archive?.experiences))throw new Error('The archive is not ready.');
  const selected=new Set(ids),works=[],experiences=[],workIds=new Map();
  const sourceWorks=new Map(archive.works.map(work=>[work.id,work]));
  for(const entry of archive.experiences){
    if(!selected.has(entry.id))continue;
    const work=sourceWorks.get(entry.workId);if(!work)throw new Error('A selected entry has no work.');
    if(!workIds.has(work.id)){
      const id='w'+(works.length+1);workIds.set(work.id,id);
      works.push({id,title:text(work.title),creator:text(work.creator),type:text(work.type,30),year:text(String(work.year||''),10)});
    }
    const edition=entry.edition;
    experiences.push({id:'e'+(experiences.length+1),workId:workIds.get(work.id),startDate:date(entry.startDate),endDate:date(entry.endDate),
      status:['completed','in-progress','planned','dnf'].includes(entry.status)?entry.status:'completed',
      rating:typeof entry.rating==='number'&&Number.isFinite(entry.rating)&&entry.rating>=0&&entry.rating<=5?entry.rating:'',
      review:options.reviews===false?'':text(entry.review,100000),
      quotes:options.passages===false?[]:(entry.quotes||[]).filter(q=>q&&typeof q.text==='string').map(q=>({text:text(q.text,20000),note:text(q.note,500),featured:q.featured===true})),
      // Artwork comes only from this selected experience / exact edition.
      cover:options.covers===false?'':publicImage(entry.cover||edition?.cover||''),
      edition:edition?{title:text(edition.title),publisher:text(edition.publisher),publishYear:text(edition.publishYear,10),language:text(edition.language,100),format:text(edition.format,100),series:text(edition.series),seriesNumber:text(edition.seriesNumber,30)}:null});
  }
  if(!experiences.length)throw new Error('Select at least one experience to publish.');
  if(experiences.length>10000)throw new Error('Publish up to 10,000 experiences at a time.');
  return{format:'pathos-publication-v1',title:text(options.title,120).trim()||'My Πathos',username:text(options.username,40).trim(),works,experiences};
}
export function jsonForHtml(value){return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0'));}
export async function digest(value,algorithm='SHA-256'){
  const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
  return [...new Uint8Array(await crypto.subtle.digest(algorithm,bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
}
const base64=bytes=>{let value='';for(let offset=0;offset<bytes.length;offset+=8192)value+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(value);};
export async function buildPublication(snapshot,assets){
  const tags=assets.html.match(/<script\b[^>]*>/gi)||[];
  if(tags.length!==2||tags.some(tag=>!/^<script id="publication(Data|Licenses)" type="application\/json">$/.test(tag)))throw new Error('The website template contains an unexpected script. Update Πathos before publishing.');
  // HTML parsing normalizes line endings before CSP checks inline script hashes.
  const scripts=[assets.parser,assets.format,assets.reader].map(script=>script.replace(/\r\n?/g,'\n').replace(/<\/script/gi,'<\\/script'));
  const hashes=await Promise.all(scripts.map(async script=>"'sha256-"+base64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(script))))+"'"));
  const css=assets.css.replaceAll('NEWSREADER_DATA',assets.serif).replaceAll('INSTRUMENT_DATA',assets.sans);
  const csp="default-src 'none'; script-src "+hashes.join(' ')+"; style-src 'unsafe-inline'; img-src https: data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'";
  const html=assets.html.replace('PUBLICATION_CSP',()=>csp).replace('PUBLICATION_STYLE',()=>css).replace('PUBLICATION_DATA',()=>jsonForHtml(snapshot)).replace('PUBLICATION_NOTICES',()=>jsonForHtml({parser:assets.parserLicense||'',fonts:assets.fontLicense||''}))
    .replace('PUBLICATION_SCRIPTS',()=>scripts.map(script=>'<script>'+script+'</script>').join('\n'));
  if(new TextEncoder().encode(html).length>20*1024*1024)throw new Error('The public website exceeds 20 MB. Select fewer covers or entries.');
  return new Map([['/index.html',html],['/robots.txt','User-agent: *\nDisallow: /\n'],['/_headers','/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n  Content-Security-Policy: '+csp+"; frame-ancestors 'none'\n"]]);
}
