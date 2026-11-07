const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const core=import('../public/pathos-personal/publish-core.mjs');
const provider=import('../public/pathos-personal/publish-netlify.mjs');
test('OAuth callback is reproducible and blocks hosting overlays',()=>{
  require('node:child_process').execFileSync(process.execPath,[path.resolve(__dirname,'../scripts/pathos-publish-auth.cjs'),'--check']);
  const html=require('node:fs').readFileSync(path.resolve(__dirname,'../public/pathos-personal/netlify-auth.html'),'utf8');
  assert(!html.includes('script-src \'self\''));assert(!/<script[^>]*src=/.test(html));assert.match(html,/script-src 'sha256-/);
});
const fixture={schemaVersion:6,secret:'ARCHIVE_SECRET',works:[{id:'private-work-id',title:'Selected work',type:'Book',creator:'Author',cover:'https://images.example/PRIVATE_COVER.jpg',owned:true,sourceMetadata:{notes:'PRIVATE_NOTES'},external:{isbn:'PRIVATE_ISBN'}}],experiences:[{id:'selected',workId:'private-work-id',rating:4.25,startDate:'2026-10-01',endDate:'2026-10-02',review:'Selected **review** $& $\' </script><script>alert(1)</script>',quotes:[{text:'Selected passage',note:'p. 4',private:'PRIVATE_EXTRA'}],edition:{publisher:'Publisher',isbn:'PRIVATE_ISBN',sourceId:'PRIVATE_UID',contributors:'PRIVATE_CONTRIBUTOR'},tags:['PRIVATE_TAG'],details:{secret:'PRIVATE_DETAILS'},venue:'PRIVATE_VENUE',isPublic:false},{id:'not-selected',workId:'private-work-id',review:'UNSELECTED_REVIEW',cover:'https://example.com/UNSELECTED_COVER.jpg',quotes:[{text:'UNSELECTED_PASSAGE'}]}]};
test('public projection includes only selected visible fields and never mutates the archive',async()=>{
  const{projectArchive}=await core,before=JSON.stringify(fixture),snapshot=projectArchive(fixture,['selected'],{title:'A public diary',username:'  maria  '}),raw=JSON.stringify(snapshot);
  for(const marker of ['PRIVATE_','ARCHIVE_SECRET','UNSELECTED_','private-work-id','isPublic','sourceMetadata','details','owned','tags','venue'])assert(!raw.includes(marker),marker);
  assert.equal(snapshot.experiences[0].rating,4.25);assert.equal(snapshot.experiences[0].cover,'');assert.equal(snapshot.experiences[0].edition.publisher,'Publisher');assert.equal(snapshot.experiences[0].quotes[0].text,'Selected passage');
  assert.equal(JSON.stringify(fixture),before);assert.throws(()=>projectArchive(fixture,[]),/Select/);
  assert.equal(snapshot.username,'maria');assert.equal(projectArchive(fixture,['selected']).username,'');assert.equal(projectArchive(fixture,['selected'],{username:'x'.repeat(80)}).username.length,40);
  const minimal=projectArchive(fixture,['selected'],{reviews:false,passages:false,covers:false});assert.equal(minimal.experiences[0].review,'');assert.deepEqual(minimal.experiences[0].quotes,[]);
});
test('image credentials and executable data types cannot enter the public copy',async()=>{
  const{publicImage}=await core;for(const value of ['javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','https://u:p@example.com/a.png','https://example.com/a.png?access%5ftoken=secret','https://example.com/a.png?apiKey=secret'])assert.equal(publicImage(value),'');
  assert.equal(publicImage('data:image/png;base64,YWJj'),'data:image/png;base64,YWJj');
});
test('self-contained reader safely embeds literal text and hashes the executable scripts',async()=>{
  const{projectArchive,buildPublication}=await core;
  const base=path.resolve(__dirname,'../public/pathos-personal'),read=name=>fs.readFile(path.join(base,name),'utf8');
  const assets={html:await read('published-reader.txt'),css:await read('published-reader.css'),reader:await read('published-reader.js'),format:await read('review-format.js'),parser:await read('markdown-it.min.js'),parserLicense:await read('markdown-it.LICENSE.txt'),fontLicense:await read('fonts/LICENSE.txt'),serif:'test',sans:'test'};
  const files=await buildPublication(projectArchive(fixture,['selected']),assets),html=files.get('/index.html');
  assert(!html.includes('PUBLICATION_'));assert(!html.includes('PRIVATE_'));assert(!html.includes('UNSELECTED_'));
  assert(html.includes('\\u003c/script\\u003e'));assert(html.includes('$&'));assert.equal((html.match(/<script>/g)||[]).length,3);
  assert.match(html,/connect-src 'none'/);assert.match(files.get('/_headers'),/frame-ancestors 'none'/);assert.match(files.get('/robots.txt'),/Disallow: \//);
  assert(html.includes('Copyright (c) 2014 Vitaly Puzrin'));assert.match(html,/SIL Open Font License/i);
  await assert.rejects(()=>buildPublication(projectArchive(fixture,['selected']),{...assets,html:assets.html+'<script src="https://example.com/preview-toolbar.js"></script>'}),/unexpected script/);
  assert(!html.includes('indexedDB')&&!html.includes('supabase')&&!html.includes('PATHOS_CONFIG'));
});
function apiMock({mismatch=false,failUpload=false}={}){
  const calls=[],metadata={pathos_kind:'personal-publication-v1',pathos_id:'publisher-test-12345'},site={id:'site-123',name:'pathos-publishertest12345',account_id:'team-123',build_settings:{}};
  let ready=false,required=[];
  const fetcher=async(url,options)=>{
    const target=new URL(url),p=target.pathname.replace('/api/v1','');calls.push({p,options});
    assert.equal(target.origin,'https://api.netlify.com');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer synthetic-token');
    let value;
    if(p==='/sites/site-123'&&options.method==='GET')value=site;
    else if(p.endsWith('/metadata')&&options.method==='GET')value=mismatch?{...metadata,pathos_id:'someone-else'}:metadata;
    else if(p==='/sites/site-123/deploys'&&options.method==='POST'){const body=JSON.parse(options.body);assert.equal(target.searchParams.get('draft'),'true');assert.equal(body.draft,true);required=Object.values(body.files);value={id:'deploy-123',site_id:site.id,required};}
    else if(p.startsWith('/deploys/deploy-123/files/')){if(failUpload)return new Response('{}',{status:500});value={};}
    else if(p==='/sites/site-123/deploys/deploy-123'){ready=true;value={id:'deploy-123',site_id:site.id,state:'ready'};}
    else if(p.endsWith('/restore')){assert(ready);value={id:'deploy-123',site_id:site.id};}
    else throw new Error('Unexpected API request: '+p);
    return new Response(JSON.stringify(value),{status:200});
  };
  return{calls,fetcher,ref:{id:site.id,name:site.name,publisherId:metadata.pathos_id},account:{id:'team-123',slug:'my-team'}};
}
test('publication stages files and promotes only a ready deploy on the verified dedicated site',async()=>{
  const{netlifyClient}=await provider,mock=apiMock(),files=new Map([['/index.html','a public page'],['/robots.txt','Disallow: /'],['/_headers','headers']]);
  const result=await netlifyClient('synthetic-token',{fetcher:mock.fetcher}).deploy(mock.ref,mock.account,files);
  assert.equal(result.url,'https://pathos-publishertest12345.netlify.app');assert.equal(mock.calls.filter(call=>call.p.endsWith('/restore')).length,1);
});
test('ownership mismatch and failed upload never promote a deployment',async()=>{
  const{netlifyClient}=await provider;
  for(const options of [{mismatch:true},{failUpload:true}]){const mock=apiMock(options);await assert.rejects(()=>netlifyClient('synthetic-token',{fetcher:mock.fetcher}).deploy(mock.ref,mock.account,new Map([['/index.html','safe page']])));assert(!mock.calls.some(call=>call.p.endsWith('/restore')));}
});
