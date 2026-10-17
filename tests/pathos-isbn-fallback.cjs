const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(relative,mocks={}){
 const filename=path.resolve(__dirname,'..',relative),compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=module.paths;
 const original=compiled.require.bind(compiled);compiled.require=id=>mocks[id]||original(id);
 compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return compiled.exports;
}
const lib=load('src/lib/pathos-isbn-fallback.ts'),api=require('../public/pathos/book-catalogue.mjs');
const isbn='9788811361190',url='https://www.hoepli.it/libro/la-morte-di-ivan-ilic-/'+isbn+'.html';
const book={'@type':'Book',isbn,name:'LA MORTE DI IVAN IL IC',author:{name:'TOLSTOJ LEV'},publisher:{name:'Garzanti'},datePublished:'21/02/2008',inLanguage:'Italiano',numberOfPages:'87',translator:{name:'Buttafava G.'},image:'https://copertine.hoepli.it/hoepli/xl/978/8811/'+isbn+'.jpg'};
const fixture=(data=book)=>'<script type="application/ld+json">'+JSON.stringify({'@type':'WebPage',mainEntity:data})+'</script>'+Object.entries({'Pagine Romane':'LIII','Pagine Arabe':'87','Edizione':'18ª','Collana':'I GRANDI LIBRI','Formato':'Brossura','Pubblicazione':'02/2008'}).map(([k,v])=>'<div class="altreInfo">'+k+': <span>'+v+'</span></div>').join('');
const html=body=>new Response(body,{headers:{'Content-Type':'text/html; charset=utf-8'}});

test('exact reported ISBN preserves preliminary pages, printing and edition provenance',()=>{
 const e=lib.extractHoepliEdition(fixture(),url,isbn);assert.equal(e.isbn,isbn);assert.equal(e.publisher,'Garzanti');assert.equal(e.language,'Italian');assert.equal(e.publishYear,'2008');assert.equal(e.pages,'LIII + 87');assert.equal(e.printing,'18ª');assert.equal(e.contributors,'Buttafava G.');assert.equal(e.sourceUrl,url);
 assert.equal(lib.extractHoepliEdition(fixture({...book,isbn:'9780140328721'}),url,isbn),null);
 assert.equal(lib.extractHoepliEdition(fixture({...book,isbn:undefined}),url,isbn),null);
 assert.equal(lib.extractHoepliEdition(fixture({...book,image:'https://evil.example/cover.jpg'}),url,isbn).cover,'');
});
test('only fixed-host exact-ISBN catalogue links can be fetched',()=>{
 for(const bad of ['http://www.hoepli.it/libro/x/'+isbn+'.html','https://evil.example/libro/x/'+isbn+'.html','https://www.hoepli.it@127.0.0.1/','https://u:p@www.hoepli.it/libro/x/'+isbn+'.html','https://www.hoepli.it:444/libro/x/'+isbn+'.html',url+'?url=http://127.0.0.1',url+'#other','/libro/wrong/9780140328721.html','/cerca/libri.aspx?query='+isbn+'&url=x'])assert.throws(()=>lib.hoepliUrl(bad,isbn));
 assert.equal(lib.hoepliUrl('/libro/la-morte-di-ivan-ilic-/'+isbn+'.html',isbn).href,url);
});
test('normal redirects and search result links work without forwarding private headers',async()=>{
 const calls=[];const result=await lib.lookupHoepli(isbn,async(raw,opt)=>{calls.push(raw);assert.equal(opt.credentials,'omit');assert.equal(opt.redirect,'manual');assert.equal(opt.headers.Authorization,undefined);assert.equal(opt.headers.Cookie,undefined);return calls.length===1?new Response(null,{status:301,headers:{Location:url}}):html(fixture())});
 assert.equal(calls.length,2);assert.equal(result[0].pages,'LIII + 87');
 const linked=await lib.lookupHoepli(isbn,async raw=>raw.includes('/cerca/')?html('<a href="https://evil.example/">bad</a><a href="'+url+'">book</a>'):html(fixture()));assert.equal(linked[0].isbn,isbn);
 let count=0;await assert.rejects(lib.lookupHoepli(isbn,async()=>{count++;return new Response(null,{status:302,headers:{Location:'http://127.0.0.1/'}})}));assert.equal(count,1);
});
test('upstream errors, oversized pages, redirects and timeouts stop cleanly',async()=>{
 await assert.rejects(lib.lookupHoepli(isbn,async()=>new Response('challenge',{status:403})),/Manual entry/);
 assert.deepEqual(await lib.lookupHoepli(isbn,async()=>new Response(null,{status:404})),[]);
 let calls=0;await assert.rejects(lib.lookupHoepli(isbn,async()=>{calls++;return new Response(null,{status:302,headers:{Location:url}})}),/redirects/);assert.equal(calls,4);
 await assert.rejects(lib.lookupHoepli(isbn,async()=>html('x'.repeat(2*1024*1024+1))),/too large/);
 await assert.rejects(lib.lookupHoepli(isbn,async(_raw,opt)=>new Promise((_,reject)=>opt.signal.addEventListener('abort',()=>reject(Error('timeout')))),5),/Manual entry/);
});
test('public route accepts only bounded ISBN input, caches metadata and handles errors',async()=>{
 let calls=0;const {POST}=load('src/app/api/pathos/isbn-fallback/route.ts',{'@/lib/pathos-isbn-fallback':{...lib,lookupHoepli:async value=>{calls++;assert.equal(value,isbn);return [lib.extractHoepliEdition(fixture(),url,isbn)]}}});
 const request=(body,headers={})=>new Request('https://pathos.example/api/pathos/isbn-fallback',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://pathos.example',...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 for(const [body,status] of [[{isbn:'123'},400],[{isbn,url:'https://evil.example/'},400],['{bad',400],[' '.repeat(257),413],[null,400],[{isbn:25},400]])assert.equal((await POST(request(body))).status,status);
 assert.equal((await POST(request({isbn},{Origin:'https://evil.example'}))).status,403);
 assert.equal((await POST(request({isbn},{'sec-fetch-site':'cross-site'}))).status,403);
 assert.equal((await POST(request({isbn},{'Content-Type':'text/plain'}))).status,415);
 const response=await POST(request({isbn}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).items[0].isbn,isbn);await POST(request({isbn}));assert.equal(calls,1);
});
test('book searches and edition lookup fall back only for missing exact ISBNs',async()=>{
 const e=lib.extractHoepliEdition(fixture(),url,isbn);let calls=0;const fallback=async value=>{calls++;assert.equal(value,isbn);return[e,{...e,isbn:'9780140328721'}]};
 const opts={getJson:async()=>{const error=Error('missing');error.status=404;throw error},isbnFallback:fallback};
 assert.equal((await api.isbnEditions(isbn,opts))[0].isbn,isbn);
 const result=await api.searchBooks(isbn,opts);assert.equal(result.items.length,1);assert.equal(result.items[0].provider,'hoepli');assert.equal(result.items[0].year,'');assert.equal(result.items[0].suggestedEdition.publishYear,'2008');
 const existing=await api.isbnEditions(isbn,{...opts,getJson:async()=>({key:'/books/OL1M',isbn_13:[isbn]})});assert.equal(existing[0].olid,'/books/OL1M');assert.equal(calls,2);
 await api.searchBooks('Tolstoj',{getJson:async()=>({docs:[]}),isbnFallback:fallback});assert.equal(calls,2);
 await assert.rejects(api.isbnEditions(isbn,{...opts,isbnFallback:async()=>[{...e,isbn:'9780140328721'}]}),/Manual entry|No exact/);
 const controller=new AbortController();await assert.rejects(api.isbnEditions(isbn,{...opts,signal:controller.signal,isbnFallback:async()=>{controller.abort();return[e]}}),e=>e.name==='AbortError');
 assert.equal(api.combineEditions([e,{...e,pages:'140'}]).length,2);assert.equal(api.combineEditions([e,{...e,printing:'19ª'}]).length,2);
});
