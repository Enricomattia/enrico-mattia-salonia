import { buildHistory, evaluateMatch } from './match-engine.mjs';

const $ = id => document.getElementById(id);
const button = $('discoverBtn');
const dialog = document.createElement('dialog');dialog.id = 'discoveryDialog';dialog.className = 'discover-dialog';
dialog.setAttribute('aria-labelledby', 'discoveryTitle');
dialog.innerHTML = `<div class="dialog-head"><h2 id="discoveryTitle">Find a book or film</h2><button type="button" class="icon-btn" id="closeDiscovery" aria-label="Close search">×</button></div>
<form class="discover-search" id="discoveryForm"><select class="input" id="discoveryType" aria-label="Medium"><option value="Book">Books</option><option value="Film">Films</option></select><input class="input" id="discoveryQuery" aria-label="Title, author or keywords" placeholder="Search a title, author or keywords…" required minlength="2" maxlength="120" autocomplete="off"><button class="btn primary" type="submit">Search</button></form>
<div class="discover-book-filters" id="discoveryBookFilters"><label>Language<select class="input" id="discoveryLanguage"><option value="">Any language</option><option value="ita">Italian</option><option value="eng">English</option><option value="fre">French</option><option value="ger">German</option><option value="spa">Spanish</option></select></label><label>Publisher<input class="input" id="discoveryPublisher" maxlength="120" placeholder="e.g. Einaudi"></label></div>
<p class="discover-status" id="discoveryStatus" role="status" aria-live="polite"></p><div class="discover-results" id="discoveryResults"></div><div class="discover-preview" id="discoveryPreview" hidden></div>`;
document.body.append(dialog);
let request, revision = 0, worker, matching = false, selected, items = [], enabled = false, nextPage = null, searchQuery;
const node = (tag, value, className = '') => {const element = document.createElement(tag);element.textContent = value;if(className)element.className = className;return element;};
const owner = () => !!window.pathosCanEdit && typeof window.pathosOwnerCatalogue === 'function';
function cover(item, className) {
  const box = node('div', item.type === 'Book' ? '📚' : '🎬', className);
  if (item.cover && /^https:\/\/(?:covers\.openlibrary\.org|image\.tmdb\.org|books\.google\.com|books\.googleusercontent\.com)\//.test(item.cover)) {
    const image = document.createElement('img');image.src = item.cover;image.alt = '';image.loading = 'lazy';
    image.onerror = () => {box.textContent = item.type === 'Book' ? '📚' : '🎬';};box.replaceChildren(image);
  }
  return box;
}
function cancel() {revision++;request?.abort();request = null;matching = false;worker?.postMessage({type:'cancel'});if($('calculateMatch'))$('calculateMatch').disabled = false;}
function clearPrivate() {
  cancel();worker?.terminate();worker = null;enabled = false;selected = null;items = [];nextPage = null;searchQuery = null;
  $('discoveryResults').replaceChildren();$('discoveryPreview').replaceChildren();$('discoveryStatus').textContent = '';dialog.close();
}
window.addEventListener('pathos-owner-change', event => {button.hidden = !event.detail.active;if(!event.detail.active)clearPrivate();});
button.hidden = !owner();
button.onclick = () => {if(owner()&&!window.pathosArchiveBusy?.()){dialog.showModal();$('discoveryQuery').focus();}};
$('closeDiscovery').onclick = () => dialog.close();dialog.addEventListener('close', () => {cancel();});
$('discoveryType').onchange = () => {cancel();nextPage = null;selected = null;items = [];results();$('discoveryBookFilters').hidden = $('discoveryType').value==='Film';$('discoveryStatus').textContent = '';$('discoveryQuery').placeholder = $('discoveryType').value==='Film'?'Search a film title…':'Search a title, author or keywords…';};
function results() {
  $('discoveryResults').replaceChildren();$('discoveryResults').hidden = false;$('discoveryPreview').hidden = true;
  for (const item of items) {
    const entry = node('button', '', 'discover-result');entry.type = 'button';
    const details = node('span', '');details.append(node('strong',item.title),node('span',[item.creator,item.year||item.suggestedEdition?.publishYear,item.suggestedEdition?.publisher,item.suggestedEdition?.language,item.provider==='googlebooks'?'Google Books':item.provider==='openlibrary'?'Open Library':'TMDB'].filter(Boolean).join(' · '),'meta'));
    entry.append(cover(item,'discover-thumb'),details);entry.onclick = () => preview(item);$('discoveryResults').append(entry);
  }
  if(nextPage!==null){const more=node('button','More results','btn');more.type='button';more.onclick=()=>search(nextPage);$('discoveryResults').append(more);}
}
$('discoveryForm').onsubmit = event => {event.preventDefault();searchQuery={action:'search',type:$('discoveryType').value,query:$('discoveryQuery').value.trim(),language:$('discoveryLanguage').value||navigator.language,filterLanguage:!!$('discoveryLanguage').value,publisher:$('discoveryPublisher').value.trim()};void search(0);};
async function search(page) {
  if(!owner())return;cancel();const current = revision;request = new AbortController();selected = null;
  $('discoveryStatus').textContent = 'Searching…';$('discoveryPreview').hidden = true;$('discoveryResults').replaceChildren();
  try {
    const response = await window.pathosOwnerCatalogue({...searchQuery,page},request.signal);
    if(current!==revision||!owner())return;items = page?[...items,...response.items.filter(item=>!items.some(old=>old.id===item.id&&old.provider===item.provider))]:response.items;nextPage=response.nextPage??null;results();$('discoveryStatus').textContent = response.warnings?.join(' ')||(items.length ? '' : 'No matches. Try another title or author.');
  } catch(error) {if(current===revision&&error.name!=='AbortError')$('discoveryStatus').textContent = error.message;}
}
async function preview(item) {
  if(!owner())return;cancel();const current = revision;request = new AbortController();$('discoveryStatus').textContent = 'Loading preview…';
  try {
    const response = await window.pathosOwnerCatalogue({action:'detail',type:item.type,id:item.id,provider:item.provider},request.signal);
    if(current!==revision||!owner())return;
    selected = {...item,...response.item,title:item.title||response.item.title,aliases:[...(item.aliases||[]),...(response.item.title!==item.title?[response.item.title]:[])].filter(Boolean),creator:response.item.creator||item.creator,year:response.item.year||item.year};
    renderPreview();$('discoveryStatus').textContent = '';
    if(enabled)void match();
  } catch(error) {if(current===revision&&error.name!=='AbortError')$('discoveryStatus').textContent = error.message;}
}
function renderPreview() {
  const item = selected, box = $('discoveryPreview');box.replaceChildren();box.hidden = false;$('discoveryResults').hidden = true;
  const back = node('button','← Results','view-link');back.type = 'button';back.onclick = () => {cancel();results();};box.append(back);
  const top = node('div','','discover-preview-top'), details = node('div','');
  details.append(node('h3',item.title),node('div',[item.creator,item.year,item.type].filter(Boolean).join(' · '),'meta'));
  const source = node('a',item.provider==='openlibrary'?'Open Library ↗':item.provider==='googlebooks'?'Google Books ↗':'TMDB ↗','source-link');source.href = item.sourceUrl;source.target = '_blank';source.rel = 'noopener noreferrer';details.append(source);
  if(item.type==='Book')details.append(node('p',item.provider==='googlebooks'?'Edition preview. Confirm that this is your copy when logging.':'Work preview. Choose your exact edition when logging.','meta small'));
  top.append(cover(item,'discover-cover'),details);box.append(top);
  box.append(node('p',item.description||'No description is available for this work. Match confidence may be low.','discover-description'));
  if(item.genres.length)box.append(node('p',item.genres.slice(0,6).join(' · '),'meta'));
  const actions = node('div','','discover-actions');
  for(const [label,status] of [['Add to Planned','planned'],['Log experience','completed']]){
    const action = node('button',label,'btn');action.type = 'button';action.onclick = () => {if(!owner())return;const chosen = selected;dialog.close();window.pathosBridge.openCatalogueEntry(chosen,status);};actions.append(action);
  }
  box.append(actions);
  const matchBox = node('section','','discover-match');matchBox.setAttribute('aria-label','Your match');
  matchBox.append(node('h4','Your match'),node('p','Runs on this device, with no paid AI service. First use downloads a multilingual model (about 120 MB plus runtime). Review analysis stays on this device.','discover-match-copy'));
  const calculate = node('button',enabled?'Calculate match':'Enable local matching','btn primary');calculate.id = 'calculateMatch';calculate.type = 'button';calculate.onclick = match;matchBox.append(calculate);
  const status = node('p','','discover-status');status.id = 'matchStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');matchBox.append(status);
  const result = node('div','','discover-match-result');result.id = 'matchResult';matchBox.append(result);box.append(matchBox);
  const credits = document.createElement('details');credits.className = 'discover-credits';credits.append(node('summary','Catalogue & model credits'));
  credits.append(node('p','Book metadata: Open Library and, when configured, Google Books. Local embeddings: multilingual MiniLM via Transformers.js. Match explanations are assembled from your actual history; this is not a language-model review.'));
  if(item.type==='Film'){
    const logo = document.createElement('img');logo.src = 'https://www.themoviedb.org/assets/v4/logos/v2/blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg';logo.alt = 'TMDB';logo.loading = 'lazy';
    credits.append(logo,node('p','This product uses the TMDB API but is not endorsed or certified by TMDB.'));
  }
  box.append(credits);
}
function renderMatch(result) {
  const box = $('matchResult');box.replaceChildren();
  box.append(node('div',result.label,'discover-match-title'),node('div',`${result.confidence} confidence · ${result.historyCount} past experiences considered`,'meta'),node('p',result.explanation||result.summary,'discover-match-explanation'));
  if(result.uncertainty)box.append(node('p',result.uncertainty,'discover-match-uncertainty'));
  const evidence = node('div','','discover-evidence');
  for(const e of result.evidence){
    const card = node('article','');card.dataset.direction = e.direction;
    card.append(node('strong',e.title),node('div',`${e.type} · ${e.rating==null?'unrated':`you rated it ${e.rating}/5`}`,'meta'));
    if(e.shared.length)card.append(node('small','Shared catalogue subjects: '+e.shared.join(', ')));
    if(e.review)card.append(node('blockquote',e.review));evidence.append(card);
  }
  box.append(evidence,node('p',result.limitations,'discover-match-copy'));
}
async function match() {
  if(!owner()||!selected||matching)return;
  matching = true;const current = ++revision;request = new AbortController();$('calculateMatch').disabled = true;$('matchStatus').textContent = 'Verifying owner access…';
  try {
    await window.pathosOwnerCatalogue({action:'check'},request.signal);
    if(current!==revision||!owner())return;
    const history = buildHistory(window.pathosBridge.getArchive(),selected);
    if(!history.length){renderMatch(evaluateMatch(selected,[],[],[]));$('matchStatus').textContent = '';matching = false;$('calculateMatch').disabled = false;return;}
    enabled = true;
    $('matchStatus').textContent = 'Preparing local matching…';
    if(!worker){
      worker = new Worker('/pathos/match-worker.js',{type:'module'});
      worker.onmessage = ({data}) => {
        if(data.id!==revision||!owner()||!dialog.open)return;
        if(data.type==='progress')$('matchStatus').textContent = data.message;
        else {matching = false;$('calculateMatch').disabled = false;$('calculateMatch').textContent = 'Recalculate match';$('matchStatus').textContent = data.type==='error'?data.message:'';if(data.type==='result')renderMatch(data.result);}
      };
      worker.onerror = () => {matching = false;if($('calculateMatch'))$('calculateMatch').disabled = false;if($('matchStatus'))$('matchStatus').textContent = 'Local matching is unavailable in this browser. Try another browser; your archive is unchanged.';worker?.terminate();worker = null;};
    }
    worker.postMessage({type:'match',id:current,candidate:selected,history});
  }catch(error){if(current===revision&&$('matchStatus')){$('matchStatus').textContent = error.message;$('calculateMatch').disabled = false;matching = false;}}
}
