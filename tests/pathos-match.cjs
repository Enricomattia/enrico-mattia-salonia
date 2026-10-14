const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const filename=path.resolve(__dirname,'../src/lib/pathos-catalogue.ts');
const compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {catalogue,requireOwner,boundedJson}=compiled.exports;
const configContext={window:{}};require('node:vm').runInNewContext(fs.readFileSync(path.resolve(__dirname,'../public/pathos/config.js'),'utf8'),configContext);
const config=configContext.window.PATHOS_CONFIG,owner=config.ownerUserId;
const jwt='a'.repeat(24)+'.'+'b'.repeat(24)+'.'+'c'.repeat(24);
const request=(headers={})=>new Request('https://pathos.example/api/pathos/catalogue',{method:'POST',headers:{host:'pathos.example',...headers}});
const reply=data=>Response.json(data);
test('rejects signed-out, malformed, cross-site and non-owner callers before any metadata lookup',async()=>{
 let calls=0;const network=async()=>{calls++;return reply({id:owner});};
 await assert.rejects(requireOwner(request(),network),e=>e.status===401);
 await assert.rejects(requireOwner(request({authorization:'Bearer invalid'}),network),e=>e.status===401);
 await assert.rejects(requireOwner(request({authorization:'Bearer '+jwt,origin:'https://elsewhere.example'}),network),e=>e.status===403);
 await assert.rejects(requireOwner(request({authorization:'Bearer '+jwt,'sec-fetch-site':'cross-site'}),network),e=>e.status===403);
 assert.equal(calls,0);
 await assert.rejects(requireOwner(request({authorization:'Bearer '+jwt}),async()=>reply({id:'someone-else'})),e=>e.status===403);
 await assert.rejects(requireOwner(request({authorization:'Bearer '+jwt}),async()=>new Response('',{status:401})),e=>e.status===401);
 await assert.rejects(requireOwner(request({authorization:'Bearer '+jwt}),async()=>new Response('',{status:503})),e=>e.status===503);
 await assert.rejects(requireOwner(request({authorization:'Bearer '+jwt}),async()=>{throw new Error('network');}),e=>e.status===503);
});
test('validates a token through Supabase Auth and compares the verified owner ID',async()=>{
 await requireOwner(request({authorization:'Bearer '+jwt}),async(url,options)=>{
  assert.equal(url,config.supabaseUrl+'/auth/v1/user');
  assert.equal(options.headers.Authorization,'Bearer '+jwt);assert.equal(options.headers.apikey,config.supabasePublishableKey);
  assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');return reply({id:owner});
 });
});
test('bounds JSON bodies and rejects invalid catalogue commands/paths',async()=>{
 await assert.rejects(boundedJson(new Response('x'.repeat(5000)).body),e=>e.status===413);
 for(const body of [null,[],{action:'unknown'},{action:'search',type:'Book',query:'a'},{action:'search',type:'Book',query:'a'.repeat(121)},{action:'detail',type:'Book',id:'http://127.0.0.1'},{action:'detail',type:'Book',id:'/works/../../secret'}])await assert.rejects(catalogue(body));
 for(const id of ['../1','0','1?append_to_response=private'])await assert.rejects(catalogue({action:'detail',type:'Film',id},'t'.repeat(32)));
 assert.deepEqual(await catalogue({action:'check'}),{ok:true});
});
test('search and detail fetch only fixed public Open Library endpoints, preserving work/edition distinction',async()=>{
 const calls=[];
 const search=await catalogue({action:'search',type:'Book',query:'A book & author'},'',async(url,options)=>{
  calls.push(url);assert.equal(options.headers.Authorization,undefined);
  assert.equal(new URL(url).searchParams.get('q'),'A book & author');
  return reply({docs:[{key:'/works/OL123W',title:'A book',author_name:['An author'],cover_i:45,subject:['Fiction']},{key:'https://evil.example',title:'Wrong'}]});
 });
 assert.equal(search.items.length,1);assert.equal(search.items[0].id,'/works/OL123W');assert.equal(search.items[0].type,'Book');
 assert.equal('edition' in search.items[0],false);
 const detail=await catalogue({action:'detail',type:'Book',id:'/works/OL123W'},'',async url=>{
  calls.push(url);
  return reply(url.includes('/authors/')?{name:'An author'}:{title:'A book',description:{value:'A reliable description.'},covers:[-1,45],authors:[{author:{key:'/authors/OL1A'}},{author:{key:'http://127.0.0.1'}}]});
 });
 assert.equal(detail.item.creator,'An author');assert.equal(detail.item.description,'A reliable description.');
 assert(calls.every(url=>url.startsWith('https://openlibrary.org/')));
});
test('film search requires a free TMDB token, forwards it only to TMDB, and handles provider failures',async()=>{
 await assert.rejects(catalogue({action:'search',type:'Film',query:'A film'}),e=>e.status===428);
 const response=await catalogue({action:'search',type:'Film',query:'A film'},'t'.repeat(32),async(url,options)=>{
  assert.equal(new URL(url).host,'api.themoviedb.org');assert.equal(options.headers.Authorization,'Bearer '+'t'.repeat(32));
  return reply({results:[{id:11,title:'A film',release_date:'2021-01-01',overview:'Description',poster_path:'/poster.jpg'}]});
 });
 assert.equal(response.items[0].sourceUrl,'https://www.themoviedb.org/movie/11');
 await assert.rejects(catalogue({action:'search',type:'Book',query:'A book'},'',async()=>new Response('',{status:429})),e=>e.status===502);
});
test('local history excludes planned works, the target itself, passages and identifying/storage fields',async()=>{
 const {buildHistory}=await import('../public/pathos/match-engine.mjs');
 const archive={works:[{id:'one',title:'History',type:'Book',cover:'private-data-image',external:{isbn:'private-isbn'},sourceMetadata:{genres:['Fiction']}},{id:'target',title:'Target',type:'Book'}],experiences:[
  {id:'zero',workId:'one',status:'completed',rating:0,review:'My review',quotes:[{text:'Private passage'}],sourceUrl:'private-url'},
  {id:'repeat',workId:'one',status:'completed',rating:5,review:'Another reading'},
  {id:'plan',workId:'one',status:'planned',rating:5},
  {id:'self',workId:'target',status:'completed',rating:1,review:'Do not leak target outcome'},
 ]};
 const before=JSON.stringify(archive);const records=buildHistory(archive,{provider:'openlibrary',id:'/works/OL2W',title:'Target',type:'Book'});
 assert.equal(records.length,2);assert.equal(records[0].rating,0);assert.notEqual(records[0].id,records[1].id);
 const serialized=JSON.stringify(records);for(const privateValue of ['Private passage','private-url','private-data-image','private-isbn','target outcome'])assert(!serialized.includes(privateValue));
 assert.equal(JSON.stringify(archive),before);
});
test('matching handles positive/negative preferences, sparse metadata, repeats and honest confidence',async()=>{
 const {evaluateMatch}=await import('../public/pathos/match-engine.mjs');
 const history=Array.from({length:8},(_,i)=>({id:String(i),workId:String(i),title:'Work '+i,type:i%2?'Book':'Film',rating:i<4?5:1,creator:'Author',genres:['Fiction'],review:'Actual review'}));
 const positive=history.map((_,i)=>i<4?[1,0]:[0,1]);const candidate={type:'Book',creator:'Other',genres:['Fiction'],description:'A long descriptive synopsis. '.repeat(8)};
 const strong=evaluateMatch(candidate,history,[1,0],positive);assert.equal(strong.label,'Strong match');assert.equal(strong.confidence,'Low');assert(strong.evidence.every(e=>e.review==='Actual review'));
 const mixed=evaluateMatch(candidate,history,[1,0],history.map(()=>[1,0]));assert(mixed.evidence.some(e=>e.direction==='caution'));assert(mixed.evidence.some(e=>e.direction==='positive'));
 assert.equal(evaluateMatch(candidate,history,[0,1],positive).label,'Weaker match');
 assert.equal(evaluateMatch({...candidate,genres:[],description:''},history,[1,0],positive).label,'Not enough evidence');
 assert.equal(evaluateMatch(candidate,history.slice(0,1),[1,0],positive).label,'Not enough evidence');
 const repeats=history.map(e=>({...e,workId:'same'}));assert.equal(evaluateMatch(candidate,repeats,[1,0],positive).label,'Not enough evidence');
});
