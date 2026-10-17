// Public metadata only. No archive/session access, storage or arbitrary targets.
const text = (value, limit = 500) => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
const values = value => (Array.isArray(value) ? value : value ? [value] : []).map(x => text(x, 150)).filter(Boolean);
const normal = value => text(value).normalize('NFKC').toLowerCase();
const array = value => Array.isArray(value) ? value : value ? [value] : [];
const languageIdentity = value => languageCode(value) || normal(value);
export function isbn13(value) {
  let isbn = String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    if ([...isbn].reduce((sum, digit, i) => sum + (digit === 'X' ? 10 : Number(digit)) * (10 - i), 0) % 11) return '';
    isbn = '978' + isbn.slice(0, 9);
    isbn += (10 - [...isbn].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10) % 10;
  }
  return /^97[89]\d{10}$/.test(isbn) && [...isbn].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10 === 0 ? isbn : '';
}
export function languageCode(value) {
  const code = normal(value).split('-')[0];
  return ({it:'ita',en:'eng',fr:'fre',fra:'fre',de:'ger',deu:'ger',es:'spa',pt:'por',italian:'ita',english:'eng',french:'fre',german:'ger',spanish:'spa',portuguese:'por'})[code] || (/^[a-z]{3}$/.test(code) ? code : '');
}
function coverUrl(value) {
  try {const url = new URL(value);url.protocol = 'https:';url.searchParams.delete('key');return ['books.google.com','books.googleusercontent.com'].includes(url.hostname) && !url.username && !url.password && !url.port ? url.href : '';}
  catch {return '';}
}
export function olEdition(data, workKey = '') {
  if (!data || typeof data !== 'object') return null;
  const identifiers = [...values(data.isbn_13), ...values(data.isbn_10), ...values(data.isbn)];
  const cover = [data.cover_i, ...array(data.covers)].find(n => Number.isInteger(Number(n)) && Number(n) > 0);
  const language = array(data.languages || data.language).map(x => typeof x === 'string' ? x : String(x?.key || '').split('/').pop()).join(', ');
  return { isbn: identifiers.find(isbn13) || '', publisher: values(data.publishers || data.publisher).join(', '),
    title: text(data.title), publishYear: String(data.publish_date || data.publish_year || '').match(/\b\d{4}\b/)?.[0] || '',
    language, format: text(data.physical_format || data.format), pages: String(data.number_of_pages || data.number_of_pages_median || ''),
    series: values(data.series).join(', '), cover: cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg` : '',
    olid: /^\/books\/OL\d+M$/.test(data.key || '') ? data.key : '', workKey: /^\/works\/OL\d+W$/.test(workKey) ? workKey : '', source: 'Open Library' };
}
export function googleBook(data) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(data?.id || '') || !data.volumeInfo?.title) return null;
  const info = data.volumeInfo, isbn = array(info.industryIdentifiers).map(x => x?.identifier).find(isbn13) || '';
  const sourceUrl = 'https://books.google.com/books?id=' + encodeURIComponent(data.id);
  const edition = { isbn, title: text(info.title), publisher: text(info.publisher), publishYear: text(info.publishedDate).slice(0,4),
    language: text(info.language, 20), pages: String(info.pageCount || ''), format: data.saleInfo?.isEbook ? 'Ebook' : '',
    cover: coverUrl(info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail), googleBooksId: data.id, sourceUrl, source: 'Google Books' };
  return { provider: 'googlebooks', id: data.id, type: 'Book', title: text(info.title), creator: values(info.authors).join(', '),
    year: '', cover: edition.cover, description: text(info.description, 8000), genres: values(info.categories), sourceUrl, label: 'Google Books',
    external: { googleBooks: data.id }, suggestedEdition: edition,
    sourceMetadata: { genres: values(info.categories), overview: text(info.description, 1800) } };
}
function olBook(data) {
  if (!/^\/works\/OL\d+W$/.test(data?.key || '')) return null;
  const edition = data.editions?.docs?.[0] ? olEdition(data.editions.docs[0], data.key) : null;
  return { provider: 'openlibrary', id: data.key, type: 'Book', title: edition?.title || text(data.title), creator: values(data.author_name).join(', '),
    year: String(data.first_publish_year || ''), cover: Number(data.cover_i) > 0 ? `https://covers.openlibrary.org/b/id/${Number(data.cover_i)}-M.jpg` : '',
    description: '', genres: values(data.subject).slice(0,12), sourceUrl: 'https://openlibrary.org' + data.key,
    external: { openlibraryKey: data.key }, label: 'Open Library', aliases: edition?.title && normal(edition.title) !== normal(data.title) ? [text(data.title)] : [],
    suggestedEdition: edition, sourceMetadata: { genres: values(data.subject).slice(0,12) } };
}
export function combineEditions(items) {
  const result = [];
  for (const item of items.filter(Boolean)) {
    const match = result.find(other => {
      if (item.olid && other.olid === item.olid || item.googleBooksId && other.googleBooksId === item.googleBooksId) return true;
      if (!isbn13(item.isbn) || isbn13(item.isbn) !== isbn13(other.isbn)) return false;
      return ['publisher','language','publishYear','format','pages','printing'].every(key => !item[key] || !other[key] || (key === 'language' ? languageIdentity(item[key]) === languageIdentity(other[key]) : normal(item[key]) === normal(other[key])));
    });
    if (!match) result.push({...item});
    else for (const [key,value] of Object.entries(item)) if (!match[key] && value) match[key] = value;
  }
  return result;
}
export function combineBooks(items) {
  const seen = new Set();
  // Work and edition results are deliberately not collapsed by title alone.
  return items.filter(Boolean).filter(item => {const key = item.provider + ':' + item.id;if (seen.has(key)) return false;seen.add(key);return true;});
}
export async function fetchBookJson(url, { signal, method = 'GET', body } = {}) {
  const controller = new AbortController(), abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 8000);
  try {
    const response = await fetch(url, { method, body, headers: body ? {'Content-Type':'application/json'} : undefined, signal: controller.signal, credentials: 'omit', redirect: 'error', referrerPolicy: new URL(url,'https://pathos.invalid').hostname === 'www.googleapis.com' ? 'strict-origin-when-cross-origin' : 'no-referrer' });
    if (!response.ok) {const error=new Error('Catalogue unavailable');error.status=response.status;throw error;}
    const reader = response.body.getReader();let size = 0;const chunks = [];
    while (true) {const {done,value} = await reader.read();if (done) break;size += value.length;if (size > 2*1024*1024) {await reader.cancel();throw new Error('Catalogue response too large');}chunks.push(value);}
    const bytes = new Uint8Array(size);let offset = 0;for (const chunk of chunks) {bytes.set(chunk,offset);offset += chunk.length;}
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export async function fetchIsbnFallback(raw, { signal } = {}) {
  const isbn = isbn13(raw); if (!isbn) throw new Error('Enter a valid ISBN');
  const result = await fetchBookJson('/api/pathos/isbn-fallback', {signal,method:'POST',body:JSON.stringify({isbn})});
  return (Array.isArray(result.items) ? result.items : []).filter(item=>item && isbn13(item.isbn)===isbn && item.source==='Hoepli');
}
function fallbackBook(edition) {
  return {provider:'hoepli',id:edition.isbn,type:'Book',title:edition.title,creator:edition.creator||'',year:'',cover:edition.cover||'',description:'',genres:[],
    sourceUrl:edition.sourceUrl||'',label:'Hoepli · exact ISBN',external:{},sourceMetadata:{},suggestedEdition:edition};
}
const fields = 'key,title,author_name,first_publish_year,cover_i,subject,editions,editions.key,editions.title,editions.isbn,editions.publisher,editions.publish_date,editions.language,editions.cover_i';
function options(input) {
  const page = input.page ?? 0;
  if (!Number.isInteger(page) || page < 0 || page > 99) throw new Error('Invalid catalogue page');
  const key = input.googleKey || '';
  if (key && !/^[A-Za-z0-9_-]{20,200}$/.test(key)) throw new Error('Check your Google Books API key');
  return { ...input, page, googleKey: key, getJson: input.getJson || (url => fetchBookJson(url, input)) };
}
export async function searchBooks(query, input = {}) {
  const opt = options(input), q = text(query,120), isbn = isbn13(q);
  if (q.length < 2) throw new Error('Enter a title, author or ISBN');
  const language = languageCode(opt.language), publisher = text(opt.publisher,120);
  const solr = (isbn ? 'isbn:' + isbn : q) + (language && opt.filterLanguage ? ' language:' + language : '') + (publisher ? ' publisher:' + JSON.stringify(publisher) : '');
  const params = new URLSearchParams({q:solr,limit:'20',offset:String(opt.page*20),fields,lang:({ita:'it',eng:'en',fre:'fr',ger:'de',spa:'es',por:'pt'})[language] || ''});
  const sources = [{name:'Open Library',load:async()=>{const data=await opt.getJson('https://openlibrary.org/search.json?'+params);return{items:(data.docs||[]).map(olBook).filter(Boolean),more:Number(data.numFound ?? data.num_found ?? 0)>(opt.page+1)*20};}}];
  if(opt.googleKey)sources.push({name:'Google Books',load:async()=>{
    const googleParams=new URLSearchParams({q:isbn?'isbn:'+isbn:q+(publisher?' inpublisher:'+JSON.stringify(publisher):''),maxResults:'20',startIndex:String(opt.page*20),printType:'books',key:opt.googleKey});
    if(language&&opt.filterLanguage)googleParams.set('langRestrict',({ita:'it',eng:'en',fre:'fr',ger:'de',spa:'es',por:'pt'})[language]||language);
    const data=await opt.getJson('https://www.googleapis.com/books/v1/volumes?'+googleParams);
    return{items:(data.items||[]).map(googleBook).filter(item=>item&&(!isbn||isbn13(item.suggestedEdition.isbn)===isbn)),more:Number(data.totalItems||0)>(opt.page+1)*20};
  }});
  const results=await Promise.allSettled(sources.map(source=>source.load()));
  if(input.signal?.aborted)throw new DOMException('Lookup cancelled','AbortError');
  const successful=results.filter(result=>result.status==='fulfilled');
  const items=combineBooks(successful.flatMap(result=>result.value.items));
  const warnings=results.flatMap((result,i)=>result.status==='rejected'?[sources[i].name+' is unavailable.']:[]);
  if(isbn&&opt.page===0&&!items.length&&opt.isbnFallback){
    try{const editions=await opt.isbnFallback(isbn);if(input.signal?.aborted)throw new DOMException('Lookup cancelled','AbortError');items.push(...editions.filter(e=>isbn13(e.isbn)===isbn&&e.title).map(fallbackBook));}
    catch(error){if(input.signal?.aborted)throw new DOMException('Lookup cancelled','AbortError');warnings.push('The additional ISBN catalogue is unavailable.');}
  }
  if(!successful.length&&!items.length)throw new Error('Book catalogues are unavailable. Manual entry still works.');
  return {items,nextPage:opt.page<99&&successful.some(result=>result.value.more)?opt.page+1:null,warnings};
}
export async function isbnEditions(raw, input = {}) {
  const opt=options(input), isbn=isbn13(raw);if(!isbn)throw new Error('Enter a valid ISBN');
  const sources=[async()=>{
    let data;try{data=await opt.getJson('https://openlibrary.org/isbn/'+isbn+'.json')}catch(error){if(error.status===404)return[];throw error;}
    const edition=olEdition(data,data.works?.[0]?.key||'');
    if(!edition)return[];
    const reported=[...values(data.isbn_13),...values(data.isbn_10),...values(data.isbn)].map(isbn13).filter(Boolean);
    if(reported.length&&!reported.includes(isbn))return[];
    if(!reported.length&&!edition.olid)return[];
    edition.isbn=isbn;return[edition];
  }];
  if(opt.googleKey)sources.push(async()=>{const data=await opt.getJson('https://www.googleapis.com/books/v1/volumes?'+new URLSearchParams({q:'isbn:'+isbn,maxResults:'20',key:opt.googleKey}));return(data.items||[]).map(googleBook).filter(item=>item&&isbn13(item.suggestedEdition.isbn)===isbn).map(item=>item.suggestedEdition);});
  const results=await Promise.allSettled(sources.map(load=>load()));
  if(input.signal?.aborted)throw new DOMException('Lookup cancelled','AbortError');
  const editions=combineEditions(results.flatMap(result=>result.status==='fulfilled'?result.value:[]));
  if(!editions.length&&opt.isbnFallback){
    try{const extra=await opt.isbnFallback(isbn);if(input.signal?.aborted)throw new DOMException('Lookup cancelled','AbortError');editions.push(...combineEditions(extra.filter(e=>isbn13(e.isbn)===isbn)));}
    catch{if(input.signal?.aborted)throw new DOMException('Lookup cancelled','AbortError');throw new Error('No catalogue could supply this edition. Manual entry still works.');}
  }
  if(!editions.length&&results.every(result=>result.status==='rejected'))throw new Error('Book catalogues are unavailable. Manual entry still works.');
  if(!editions.length)throw new Error('No exact ISBN match found. Check the number or enter the edition manually.');
  return editions;
}
export async function editionPage(workKey, input = {}) {
  const opt=options(input);if(!/^\/works\/OL\d+W$/.test(workKey))throw new Error('Choose a book first');
  const data=await opt.getJson('https://openlibrary.org'+workKey+'/editions.json?'+new URLSearchParams({limit:'100',offset:String(opt.page*100)}));
  let items=(data.entries||[]).map(item=>olEdition(item,workKey));
  // Targeted search finds a relevant translated/publisher edition even if it
  // is beyond the first REST page. Further pages remain explicitly loadable.
  if(opt.page===0&&(opt.language||opt.publisher)){
    try{const query='key:'+workKey+(languageCode(opt.language)?' language:'+languageCode(opt.language):'')+(opt.publisher?' publisher:'+JSON.stringify(text(opt.publisher,120)):'');
      const result=await opt.getJson('https://openlibrary.org/search.json?'+new URLSearchParams({q:query,fields,limit:'1'}));
      const match=(result.docs||[]).find(item=>item.key===workKey);if(match?.editions?.docs?.[0])items.unshift(olEdition(match.editions.docs[0],workKey));
    }catch{/* REST results remain usable when the targeted index is unavailable. */}
  }
  if(input.signal?.aborted)throw new DOMException('Lookup cancelled','AbortError');
  const total=Number(data.size)||0;
  return{items:combineEditions(items),nextPage:opt.page<99&&(total>(opt.page+1)*100||!total&&(data.entries||[]).length===100)?opt.page+1:null};
}
