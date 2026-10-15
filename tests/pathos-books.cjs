const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const filename=path.resolve(__dirname,'../src/lib/pathos-catalogue.ts');
const compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {catalogue}=compiled.exports;
const api=require('../public/pathos/book-catalogue.mjs');
const key='synthetic-google-key-for-testing',isbn='9780140328721';
const google=(overrides={})=>({id:'volume_1',volumeInfo:{title:'Matilda',authors:['Roald Dahl'],publisher:'Puffin',publishedDate:'1988-10-01',language:'en',industryIdentifiers:[{type:'ISBN_13',identifier:isbn}],imageLinks:{thumbnail:'http://books.google.com/books/content?id=volume_1&key=should-not-survive'}},...overrides});

test('canonical ISBNs, defensive metadata parsing and identical independent modules',()=>{
 assert.equal(api.isbn13('0-14-032872-6'),isbn);assert.equal(api.isbn13('9780140328721'),isbn);
 for(const bad of ['9780140328722','014032872X','storygraph-uid','1234567890123'])assert.equal(api.isbn13(bad),'');
 assert.equal(api.languageCode('it-IT'),'ita');assert.equal(api.languageCode('French'),'fre');
 const edition=api.olEdition({key:'/books/OL1M',languages:{key:'/languages/ita'},covers:1,publisher:'Einaudi'},'http://evil.example');
 assert.equal(edition.language,'ita');assert.equal(edition.publisher,'Einaudi');assert.equal(edition.workKey,'');
 const item=api.googleBook(google());assert.equal(item.year,'','An edition date does not establish first publication');
 assert.equal(item.suggestedEdition.publishYear,'1988');assert.equal(item.suggestedEdition.format,'');assert(!item.cover.includes('key='));assert(item.cover.startsWith('https://'));
 assert.equal(api.googleBook({...google(),id:'../private'}),null);
 assert.equal(api.googleBook(google({volumeInfo:{title:'Unsafe image',imageLinks:{thumbnail:'https://evil.example/image.jpg'}}})).cover,'');
 assert.equal(fs.readFileSync(path.resolve(__dirname,'../public/pathos/book-catalogue.mjs'),'utf8'),fs.readFileSync(path.resolve(__dirname,'../public/pathos-personal/book-catalogue.mjs'),'utf8'));
});
test('both sources search titles/authors/ISBNs, paginate, filter and disclose only the query',async()=>{
 const calls=[];const response=await api.searchBooks('Matilda Dahl',{googleKey:key,language:'ita',filterLanguage:true,publisher:'Einaudi',page:1,getJson:async raw=>{
  const url=new URL(raw);calls.push(url);if(url.hostname==='openlibrary.org')return{numFound:41,docs:[{key:'/works/OL1W',title:'Matilda',author_name:['Roald Dahl'],editions:{docs:[{key:'/books/OL1M',title:'Matilde',language:['ita'],publisher:['Einaudi']}]}}]};
  return{totalItems:41,items:[google()]};
 }});
 assert.equal(response.items.length,2);assert.equal(response.items[0].title,'Matilde');assert.deepEqual(response.items[0].aliases,['Matilda']);assert.equal(response.nextPage,2);
 assert.equal(calls[0].searchParams.get('offset'),'20');assert.match(calls[0].searchParams.get('q'),/language:ita publisher:"Einaudi"/);assert.equal(calls[0].searchParams.get('lang'),'it');assert.equal(calls[0].searchParams.has('key'),false);
 assert.equal(calls[1].searchParams.get('startIndex'),'20');assert.equal(calls[1].searchParams.get('langRestrict'),'it');assert.equal(calls[1].searchParams.get('key'),key);
 const noKey=[];await api.searchBooks('Matilda',{getJson:async raw=>{noKey.push(raw);return{docs:[]}}});assert.equal(noKey.length,1);assert(noKey[0].startsWith('https://openlibrary.org/'));
});
test('provider outages preserve the other source; cancellation and page bounds reject stale/invalid requests',async()=>{
 const response=await api.searchBooks('Matilda',{googleKey:key,getJson:async url=>{if(url.includes('googleapis'))throw new Error('quota '+key);return{docs:[{key:'/works/OL1W',title:'Matilda'}]}}});
 assert.equal(response.items.length,1);assert.deepEqual(response.warnings,['Google Books is unavailable.']);assert(!JSON.stringify(response).includes(key));
 const googleOnly=await api.searchBooks('Matilda',{googleKey:key,getJson:async url=>{if(url.includes('openlibrary'))throw new Error('down');return{items:[google()]}}});assert.equal(googleOnly.items[0].provider,'googlebooks');
 await assert.rejects(api.searchBooks('Matilda',{getJson:async()=>{throw Error('down')}}),/Manual entry/);
 for(const page of [-1,1.5,100,'0'])await assert.rejects(api.searchBooks('Matilda',{page}),/Invalid catalogue page/);
 const controller=new AbortController();await assert.rejects(api.searchBooks('Matilda',{signal:controller.signal,getJson:async()=>{controller.abort();return{docs:[]}}}),error=>error.name==='AbortError');
});
test('exact ISBN lookup rejects unrelated volumes and exposes conflicting edition metadata',async()=>{
 const editions=await api.isbnEditions('0140328726',{googleKey:key,getJson:async url=>url.includes('openlibrary')?{key:'/books/OL1M',title:'Matilda',isbn_13:[isbn],publishers:['Puffin'],languages:[{key:'/languages/eng'}]}:{items:[google(),google({id:'wrong',volumeInfo:{title:'Wrong',industryIdentifiers:[{identifier:'9788806223387'}]}})]}});
 assert.equal(editions.length,1);assert.equal(editions[0].olid,'/books/OL1M');assert.equal(editions[0].googleBooksId,'volume_1');
 const conflicts=api.combineEditions([{isbn,publisher:'Puffin',language:'eng'},{isbn:'0140328726',publisher:'Other publisher',language:'en'}]);assert.equal(conflicts.length,2);
 const languageConflicts=api.combineEditions([{isbn,language:'English'},{isbn,language:'Italian'}]);assert.equal(languageConflicts.length,2);
 assert.equal(api.combineEditions([{isbn,language:'Japanese'},{isbn,language:'Chinese'}]).length,2);
 await assert.rejects(api.isbnEditions(isbn,{getJson:async()=>({})}),/No exact ISBN/);
 await assert.rejects(api.isbnEditions(isbn,{googleKey:key,getJson:async url=>{
  if(url.includes('openlibrary'))throw Error('404');
  return{items:[google({volumeInfo:{title:'Wrong',industryIdentifiers:[{identifier:'9788806223387'}]}})]};
 }}),/No exact ISBN/);
 await assert.rejects(api.isbnEditions('014032872X'),/valid ISBN/);
});
test('edition pages go beyond 100 and targeted language/publisher lookup finds an edition outside that page',async()=>{
 const calls=[];const first=await api.editionPage('/works/OL1W',{language:'ita',publisher:'Einaudi',getJson:async raw=>{
  const url=new URL(raw);calls.push(url);return url.pathname.endsWith('editions.json')?{size:205,entries:[{key:'/books/OL1M',title:'Matilda',languages:[{key:'/languages/eng'}]}]}:{docs:[{key:'/works/OL1W',editions:{docs:[{key:'/books/OL201M',title:'Matilde',language:['ita'],publisher:['Einaudi']}]}}]};
 }});
 assert.equal(first.items[0].olid,'/books/OL201M');assert.equal(first.nextPage,1);assert.match(calls[1].searchParams.get('q'),/key:\/works\/OL1W language:ita publisher:"Einaudi"/);
 const next=await api.editionPage('/works/OL1W',{page:2,getJson:async raw=>{assert.equal(new URL(raw).searchParams.get('offset'),'200');return{size:205,entries:[{key:'/books/OL205M'}]}}});assert.equal(next.nextPage,null);
 await assert.rejects(api.editionPage('/works/../../private'),/Choose a book/);
});
test('owner API supports Google detail with a fixed endpoint and never sends bearer auth to providers',async()=>{
 const calls=[];const network=async(url,options)=>{calls.push(url);assert.equal(options.headers.Authorization,undefined);if(url.includes('googleapis')){assert.equal(options.headers.Referer,'https://pathos.example/');return Response.json(google())}return Response.json({docs:[]})};
 const detail=await catalogue({action:'detail',type:'Book',provider:'googlebooks',id:'volume_1'},'',network,key,'https://pathos.example/');assert.equal(detail.item.provider,'googlebooks');assert.equal(calls[0],'https://www.googleapis.com/books/v1/volumes/volume_1?key='+key);
 await assert.rejects(catalogue({action:'detail',type:'Book',provider:'googlebooks',id:'../private'},'',network,key),e=>e.status===400);
 await assert.rejects(catalogue({action:'detail',type:'Book',provider:'googlebooks',id:'volume_1'},'',network),e=>e.status===428);
 const search=await catalogue({action:'search',type:'Book',query:'Matilda',page:1},'',async url=>Response.json(url.includes('openlibrary')?{docs:[]}:{items:[google()]}),key);assert.equal(search.items[0].id,'volume_1');
});
test('local matching excludes an already recorded Google Books work',async()=>{
 const {buildHistory}=await import('../public/pathos/match-engine.mjs');
 assert.deepEqual(buildHistory({works:[{id:'w',type:'Book',title:'Old translated title',external:{googleBooks:'volume_1'}}],experiences:[{id:'e',workId:'w',review:'Existing review',rating:1,status:'completed'}]},{provider:'googlebooks',id:'volume_1',title:'Matilda',type:'Book'}),[]);
 assert.deepEqual(buildHistory({works:[{id:'w',type:'Book',title:'Old translated title'}],experiences:[{id:'e',workId:'w',edition:{googleBooksId:'volume_1'},review:'Existing review',rating:1,status:'completed'},{id:'repeat',workId:'w',review:'Another edition',rating:5,status:'completed'}]},{provider:'googlebooks',id:'volume_1',title:'Matilda',type:'Book'}),[]);
});
