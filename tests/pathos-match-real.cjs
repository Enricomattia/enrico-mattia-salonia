/* Opt-in real browser inference: downloads public model files, sends only
 * synthetic text to a local worker, never uses an AI API or a live archive. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.PATHOS_SITE_URL||'http://127.0.0.1:3118';
(async()=>{
 const browser=await chromium.launch({channel:process.env.PATHOS_BROWSER||'msedge',headless:true});
 try{
  const page=await browser.newPage();
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',r=>r.fulfill({contentType:'text/javascript',body:'export function createClient(){return {auth:{getUser:async()=>({data:{user:null}})},rpc:async()=>({data:{schemaVersion:6,works:[],experiences:[]}})}}'}));
  const external=[];page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))external.push({url:r.url(),method:r.method(),body:r.postData()});});
  page.on('console',m=>{if(m.type()==='error')console.log('Browser: '+m.text().slice(0,180));});
  await page.goto(base+'/pathos/app.html');
  await page.exposeFunction('matchTestProgress',message=>{if(/Loading|Comparing/.test(message))console.log(message);});
  const result=await page.evaluate(()=>new Promise((resolve,reject)=>{
   const worker=new Worker('/pathos/match-worker.js',{type:'module'});
   const timer=setTimeout(()=>{worker.terminate();reject(new Error('Real model test timed out'));},240000);
   const history=[
    {title:'Reflective literary fiction',review:'I loved its intimate characters, subtle emotional interior life, beautiful prose and meditative atmosphere.',rating:5,type:'Book'},
    {title:'Romanzo introspettivo',review:'Ho amato i personaggi, la memoria, la malinconia e la scrittura intima e riflessiva.',rating:4.5,type:'Book'},
    {title:'Quiet character film',review:'Beautifully observed relationships and memory. Patient, contemplative and emotionally rich.',rating:5,type:'Film'},
    {title:'Database repair manual',review:'A dry technical textbook about database administration and software configuration. I found it dull.',rating:1,type:'Book'},
    {title:'Financial spreadsheet handbook',review:'Boring accounting formulas, corporate finance procedures, technical jargon and repetitive exercises.',rating:1.5,type:'Book'},
    {title:'Tax law regulations',review:'A dense reference manual of tax legislation and legal compliance. This was tedious.',rating:1,type:'Book'}
   ].map((e,i)=>({...e,id:'real-'+i,workId:'real-work-'+i,creator:'Synthetic author',genres:[],text:[e.type,e.title,e.review].join('. ')}));
   const candidate={type:'Book',title:'A quiet life',creator:'Synthetic novelist',genres:['Literary fiction'],description:'An intimate literary novel about memory, family relationships and the inner lives of its characters, told through reflective, lyrical prose and a contemplative atmosphere.'};
   worker.onmessage=({data})=>{
    if(data.type==='progress')window.matchTestProgress(data.message);
    else {clearTimeout(timer);worker.terminate();data.type==='error'?reject(new Error(data.message)):resolve(data.result);}
   };
   worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(new Error(e.message));};
   worker.postMessage({id:1,type:'match',candidate,history});
  }));
  assert.equal(result.historyCount,6);assert.equal(result.label,'Strong match');
  assert(result.evidence.some(e=>e.rating>=4.5));
  assert(external.every(r=>['GET','HEAD'].includes(r.method)&&!r.body),'Inference must not send reviews to a service');
  assert(external.every(r=>!r.url.includes('Synthetic')&&!r.url.includes('reflective%20')&&!r.url.includes('review')));
  console.log('PASS real multilingual local model, evidence, cross-media comparison and no private text uploads.');
  console.log(JSON.stringify({label:result.label,confidence:result.confidence,evidence:result.evidence.map(e=>e.title),externalAssetRequests:external.length}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
