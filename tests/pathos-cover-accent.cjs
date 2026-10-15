const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const poster=color=>'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="180"><rect width="120" height="180" fill="${color}"/><rect x="8" y="12" width="104" height="32" fill="white"/></svg>`).toString('base64');

async function checkCoverAccents(page){
  const {prominentColor}=await import('../public/pathos/cover-accent.mjs');
  assert.deepEqual(fs.readFileSync(path.join(__dirname,'../public/pathos/cover-accent.mjs')),fs.readFileSync(path.join(__dirname,'../public/pathos-personal/cover-accent.mjs')),'The standalone presentation copies stay identical');
  const pixels=new Uint8ClampedArray(100*4);
  for(let i=0;i<100;i++)pixels.set(i<80?[180,50,35,255]:[10,200,50,255],i*4);
  const dominant=prominentColor(pixels);
  assert(dominant[0]>dominant[1]&&dominant[0]>dominant[2],'Dominant red wins over a bright minority');
  assert.equal(prominentColor(new Uint8ClampedArray([255,255,255,255,0,0,0,255])),null,'Monochrome uses neutral styling');
  assert.equal(prominentColor(new Uint8ClampedArray([255,0,0,0])),null,'Transparent pixels are ignored');
  const before=await page.evaluate(()=>JSON.parse(JSON.stringify(db)));
  const red=poster('#b63737'),blue=poster('#356ca8'),yellow=poster('#c7a22d');
  const fixture={schemaVersion:6,works:[{id:'accent-work',title:'Two editions',type:'Book',creator:'Test author',cover:yellow}],experiences:[
    {id:'accent-red',workId:'accent-work',endDate:'2026-10-10',rating:4,review:'Red edition',edition:{cover:red},quotes:[]},
    {id:'accent-blue',workId:'accent-work',endDate:'2026-10-11',rating:5,review:'Blue edition',edition:{cover:blue},quotes:[]}
  ]};
  await page.evaluate(value=>{db=value;renderAll();showView('timeline');},fixture);
  await page.waitForFunction(()=>document.querySelectorAll('#timelineList .has-cover-accent').length===2);
  const accents=await page.locator('#timelineList .has-cover-accent').evaluateAll(nodes=>nodes.map(n=>n.style.getPropertyValue('--cover-accent')));
  assert.notEqual(accents[0],accents[1],'Each exact edition supplies its own color');
  assert.equal(await page.locator('#timelineList [data-exp="accent-blue"]').getAttribute('data-cover-accent'),blue);
  const ink=await page.locator('#timelineList .serpent-title').first().evaluate(n=>getComputedStyle(n).color);
  await page.evaluate(()=>showView('library'));
  await page.waitForFunction(()=>document.querySelector('#libraryGrid .has-cover-accent'));
  assert.equal(await page.locator('#libraryGrid .work-card').getAttribute('data-cover-accent'),blue,'Library uses the currently shown edition');
  await page.evaluate(()=>openWork('accent-work'));
  await page.waitForFunction(()=>document.querySelectorAll('#workDialogBody .experience.has-cover-accent').length===2);
  assert.notEqual(...await page.locator('#workDialogBody .experience').evaluateAll(nodes=>nodes.map(n=>n.style.getPropertyValue('--cover-accent'))));
  await page.locator('#closeWorkDialog').click();
  // Failure/opaque CORS must never replace or hide an otherwise displayed cover.
  await page.context().route('https://accent.example/**',route=>route.fulfill({contentType:'image/svg+xml',headers:{'access-control-allow-origin':'https://unrelated.example'},body:'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="120"><rect width="80" height="120" fill="red"/></svg>'}));
  await page.evaluate(()=>{db.works[0].cover='https://accent.example/no-cors.svg';db.experiences.forEach(e=>e.edition=null);renderAll();showView('timeline');});
  await page.waitForFunction(()=>[...document.querySelectorAll('#timelineList img')].every(img=>img.complete&&img.naturalWidth>0));
  assert.equal(await page.locator('#timelineList .has-cover-accent').count(),0);
  assert.equal(await page.locator('#timelineList .serpent-title').first().evaluate(n=>getComputedStyle(n).color),ink,'Text color stays fixed');
  await page.context().unroute('https://accent.example/**');
  await page.evaluate(value=>{db=value;renderAll();showView('home');},before);
}
module.exports={checkCoverAccents};
