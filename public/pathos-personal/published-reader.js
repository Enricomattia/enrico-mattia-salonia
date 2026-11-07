/* Read-only public reader: no IndexedDB, account, service worker or editor code. */
(()=>{
  'use strict';
  const data=JSON.parse(document.getElementById('publicationData').textContent),$=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const works=new Map(data.works.map(work=>[work.id,work]));
  const date=entry=>entry.endDate||entry.startDate||'';
  const entries=[...data.experiences].sort((a,b)=>date(b).localeCompare(date(a)));
  const forWork=id=>entries.filter(entry=>entry.workId===id);
  const label=value=>value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Undated';
  const status=entry=>({'in-progress':'In progress',planned:'Planned',dnf:'Did not finish',completed:'Completed'}[entry.status]);
  const rating=entry=>entry.rating===''?'':`<div class="rating">${esc(entry.rating)}/5</div>`;
  const cover=entry=>`<div class="cover">${entry?.cover?`<img src="${esc(entry.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'Π'}</div>`;
  function bind(root){root.querySelectorAll('[data-work]').forEach(button=>button.addEventListener('click',()=>open(button.dataset.work,button.dataset.entry)));}
  function card(entry){const work=works.get(entry.workId);return`<button class="entry" data-work="${esc(work.id)}" data-entry="${esc(entry.id)}">${cover(entry)}<div><div class="meta">${esc(label(date(entry)))} · ${esc(work.type)}</div><h3>${esc(work.title)}</h3><div class="meta">${esc(work.creator)}</div>${rating(entry)}${entry.status!=='completed'?`<div class="meta">${esc(status(entry))}</div>`:''}${entry.review?`<div class="excerpt">${esc(PathosReview.text(entry.review))}</div>`:''}</div></button>`;}
  function open(id,entryId){
    const work=works.get(id),list=forWork(id);
    $('workBody').innerHTML=`<div class="work-head">${cover(list[0])}<div><div class="meta">${esc(work.type)}</div><h2 id="workTitle">${esc(work.title)}</h2><div>${esc([work.creator,work.year].filter(Boolean).join(' · '))}</div></div></div>`+list.map(entry=>{
      const edition=entry.edition,editionText=edition?[edition.publisher,edition.series,edition.seriesNumber,edition.publishYear,edition.language,edition.format].filter(Boolean).join(' · '):'';
      return`<article class="experience" id="experience-${esc(entry.id)}"><div class="meta">${esc(label(date(entry)))} · ${esc(status(entry))}</div>${rating(entry)}${cover(entry)}${editionText?`<div class="edition">${esc(editionText)}</div>`:''}<div class="review">${PathosReview.render(entry.review)}</div>${entry.quotes.map(quote=>`<div class="passage"><blockquote>${esc(quote.text).replace(/\n/g,'<br>')}</blockquote><div class="meta">${esc(quote.note)}</div></div>`).join('')}</article>`;
    }).join('');
    $('workDialog').showModal();$('workDialog').scrollTop=0;
    if(entryId)$('experience-'+entryId)?.scrollIntoView({block:'nearest'});
  }
  function library(){
    const query=$('search').value.trim().toLocaleLowerCase();
    $('books').innerHTML=data.works.filter(work=>(work.title+' '+work.creator).toLocaleLowerCase().includes(query)).sort((a,b)=>a.title.localeCompare(b.title)).map(work=>`<button class="book" data-work="${esc(work.id)}">${cover(forWork(work.id)[0])}<div><h3>${esc(work.title)}</h3><div class="meta">${esc(work.creator)}</div></div></button>`).join('')||'<p class="empty">No matching works.</p>';bind($('books'));
  }
  document.title=data.title+' · Πathos';$('profileTitle').textContent=data.title;
  const current=entries.filter(entry=>entry.status==='in-progress');
  $('current').innerHTML=current.length?'<h2>Current</h2><div class="diary">'+current.map(card).join('')+'</div>':'';bind($('current'));
  const months=new Map();
  for(const entry of entries.filter(entry=>entry.status!=='planned')){const key=date(entry).slice(0,7);if(!months.has(key))months.set(key,[]);months.get(key).push(entry);}
  $('diary').innerHTML=[...months].map(([month,list])=>`<div class="month"><h2>${month?esc(new Date(month+'-15T12:00:00').toLocaleDateString(undefined,{month:'long',year:'numeric'})):'Undated'}</h2><div class="diary">${list.map(card).join('')}</div></div>`).join('')||'<p class="empty">No diary entries published.</p>';bind($('diary'));
  library();$('search').addEventListener('input',library);
  $('quotes').innerHTML=entries.flatMap(entry=>entry.quotes.map(quote=>`<article class="passage"><blockquote>${esc(quote.text).replace(/\n/g,'<br>')}</blockquote><button class="text-link" data-work="${esc(entry.workId)}" data-entry="${esc(entry.id)}">${esc(works.get(entry.workId).title)}</button><div class="meta">${esc(quote.note)}</div></article>`)).join('')||'<p class="empty">No passages published.</p>';bind($('quotes'));
  const logged=entries.filter(entry=>entry.status!=='planned'),rated=logged.filter(entry=>entry.rating!=='');
  $('stats').innerHTML=[[logged.length,'experiences'],[rated.length?(rated.reduce((sum,entry)=>sum+entry.rating,0)/rated.length).toFixed(2)+'/5':'—','average rating'],[logged.filter(entry=>entry.review.trim()).length,'written reviews']].map(([value,title])=>`<div class="stat"><strong>${esc(value)}</strong><span>${esc(title)}</span></div>`).join('');
  const media=new Map();for(const entry of logged){const type=works.get(entry.workId).type;media.set(type,(media.get(type)||0)+1);}
  $('media').innerHTML=[...media].sort((a,b)=>b[1]-a[1]).map(([type,count])=>`<div class="medium"><span>${esc(type)}</span><span>${count}</span></div>`).join('');
  document.querySelectorAll('nav [data-view]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('main>section').forEach(section=>section.hidden=section.id!==button.dataset.view);document.querySelectorAll('nav button').forEach(item=>{if(item===button)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');});window.scrollTo(0,0);}));
  $('closeWork').addEventListener('click',()=>$('workDialog').close());
})();
