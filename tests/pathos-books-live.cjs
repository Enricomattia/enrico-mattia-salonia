// Optional public Open Library smoke check; no archive access or Google key.
const assert=require('node:assert/strict');
(async()=>{
 const api=await import('../public/pathos/book-catalogue.mjs');
 for(const query of ['La casa in collina Pavese','Matilda Roald Dahl']){
  const result=await api.searchBooks(query,{language:'it'});assert(result.items.length);
  console.log(query+': '+result.items.length+' results, next page '+result.nextPage);
  const work=result.items[0];const editions=await api.editionPage(work.id,{language:'ita',publisher:query.includes('Pavese')?'Einaudi':''});
  assert(editions.items.length);console.log(work.id+': '+editions.items.length+' editions; '+editions.items.filter(item=>api.languageCode(item.language)==='ita').length+' Italian');
  if(editions.nextPage!==null){const more=await api.editionPage(work.id,{page:editions.nextPage});assert(more.items.length);console.log('Next edition page: '+more.items.length);}
 }
 console.log('PASS real Open Library title search and edition pagination');
})().catch(error=>{console.error(error.message);process.exitCode=1});
