const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {chromium}=require('playwright');
const {managePublication,readPublication}=require('../netlify/lib/pathos-publication.mjs');

const pages=new Map();
const store={
  getMetadata:async id=>pages.get(id)||null,
  getWithMetadata:async id=>pages.get(id)||null,
  async set(id,data,{metadata,onlyIfNew,onlyIfMatch}){
    const existing=pages.get(id);
    if(onlyIfNew?existing:existing?.etag!==onlyIfMatch)return {modified:false};
    pages.set(id,{data,metadata,etag:randomUUID()});
    return {modified:true};
  }
};
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.txt':'text/plain','.png':'image/png','.webmanifest':'application/manifest+json'};
const root=path.resolve(__dirname,'../public');
let origin,browser;
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,origin);
    const endpoint=url.pathname.match(/^\/(api\/pathos-personal\/publication|pathos-share)\/([a-f0-9]{32})$/);
    if(endpoint){
      const body=[];
      for await(const chunk of req)body.push(chunk);
      const request=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body:Buffer.concat(body)}:{})});
      const handler=endpoint[1]==='pathos-share'?readPublication:managePublication;
      const response=await handler(request,endpoint[2],()=>store);
      return res.writeHead(response.status,Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));
    }
    if(!/^\/pathos-personal\/(fonts\/)?[a-z0-9.-]+$/i.test(url.pathname))return res.writeHead(404).end();
    const content=await fs.readFile(path.join(root,url.pathname));
    res.writeHead(200,{'Content-Type':mime[path.extname(url.pathname)],'Cache-Control':'no-store'}).end(content);
  }catch(error){console.error(error.message);res.writeHead(500).end();}
});

const archive={
  schemaVersion:6,
  works:[{id:'book-1',title:'Example novel',creator:'Author',type:'Book',sourceMetadata:{notes:'PRIVATE_METADATA'}}],
  experiences:[
    {id:'include-1',workId:'book-1',startDate:'2026-09-01',endDate:'2026-09-02',rating:4,status:'completed',review:'A **public** review.',quotes:[{id:'quote-1',text:'A chosen passage'}]},
    {id:'exclude-1',workId:'book-1',endDate:'2026-10-01',status:'completed',review:'PRIVATE_REVIEW'}
  ]
};
const ready=page=>page.waitForFunction(()=>window.pathosPersonalReady&&window.PathosPublishing);
async function openPublishing(page){
  await page.locator('#settingsMenu>summary').click();
  await page.locator('#settingsMenu [data-view="publishing"]').click();
}
async function preview(page){
  await page.locator('#publishPreviewBtn').click();
  await page.locator('#publishPreviewWrap').waitFor();
  return page.locator('#publishPreview').getAttribute('srcdoc');
}

(async()=>{
  if(process.env.PATHOS_HOSTED_PUBLICATION_PREVIEW){
    const target=new URL(process.env.PATHOS_HOSTED_PUBLICATION_PREVIEW);
    assert.match(target.hostname,/^deploy-preview-\d+--[a-z0-9-]+\.netlify\.app$/);
    origin=target.origin;
  }else{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    origin='http://127.0.0.1:'+server.address().port;
  }
  browser=await chromium.launch({channel:process.env.PATHOS_BROWSER||'msedge',headless:true});
  const context=await browser.newContext({acceptDownloads:true}),visitor=await browser.newContext();
  const page=await context.newPage(),reader=await visitor.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  reader.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  let websiteUrl;
  try{
    await page.goto(origin+'/pathos-personal/index.html');await ready(page);
    await page.locator('#restoreInput').setInputFiles({name:'archive.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
    await page.waitForFunction(()=>!document.getElementById('restoreInput').value&&pendingWrites===0&&!archiveBusy);
    const disk=await page.evaluate(()=>readLocalArchive());
    await openPublishing(page);
    assert.equal(await page.locator('[data-publish-entry]:checked').count(),2);
    assert.equal(await page.getByRole('button',{name:'Connect Netlify'}).count(),0);
    assert(await page.locator('#publishNowBtn').isDisabled());
    assert.match(await preview(page),/PRIVATE_REVIEW/);
    await page.locator('[data-publish-entry="exclude-1"]').uncheck();
    assert(!await page.locator('#publishPreviewWrap').isVisible());
    const original=await preview(page);
    assert(!original.includes('PRIVATE_REVIEW')&&!original.includes('PRIVATE_METADATA'));
    await page.frameLocator('#publishPreview').getByRole('heading',{name:'Example novel'}).waitFor();
    await page.locator('#publishApproved').check();await page.locator('#publishNowBtn').click();
    await page.locator('#publishProgress').getByText(/Anyone with the link/).waitFor();
    websiteUrl=await page.locator('#publishWebsiteLink').getAttribute('href');
    assert.match(websiteUrl,new RegExp('^'+origin+'/pathos-share/[a-f0-9]{32}$'));
    const first=await reader.goto(websiteUrl);
    assert.equal(first.status(),200);
    assert.equal(await first.text(),original,'The public page exactly matches the approved preview');
    await reader.getByRole('heading',{name:'Example novel'}).click();
    assert.equal(await reader.locator('.review strong').innerText(),'public');
    assert.match(first.headers()['content-security-policy'],/sandbox allow-scripts allow-popups/);
    assert.equal(first.headers()['cache-control'],'no-store');
    assert.equal((await visitor.request.get(websiteUrl.replace('/pathos-share/','/api/pathos-personal/publication/'))).status(),403);
    const key=await page.locator('#publishKeyValue').inputValue();
    assert(/^[a-f0-9]{64}$/.test(key)&&!websiteUrl.includes(key)&&!original.includes(key));
    await page.reload();await ready(page);await openPublishing(page);
    await page.locator('#publishWebsiteLink').waitFor();
    assert.equal(await page.locator('#publishWebsiteLink').getAttribute('href'),websiteUrl);
    assert(!await page.locator('[data-publish-entry="exclude-1"]').isChecked());
    await page.locator('#publishUsername').fill('friend');
    await preview(page);await page.locator('#publishApproved').check();await page.locator('#publishNowBtn').click();
    await page.locator('#publishProgress').getByText(/Anyone with the link/).waitFor();
    await reader.reload();assert.equal(await reader.locator('#profileUsername').innerText(),'friend');
    await page.locator('#unpublishBtn').click();
    await page.locator('#publishProgress').getByText('Your public website is offline.').waitFor();
    assert.equal((await reader.reload()).status(),404);
    await reader.goto(origin+'/pathos-personal/index.html');await ready(reader);
    await openPublishing(reader);
    await reader.getByText('Manage an existing website',{exact:true}).click();
    await reader.locator('#publishRecoverKey').fill(key);
    await reader.locator('#publishRecoverBtn').click();
    await reader.locator('#publishProgress').getByText(/Website connected/).waitFor();
    assert.equal(await reader.locator('#publishKeyValue').inputValue(),key);
    assert.deepEqual(await page.evaluate(()=>readLocalArchive()),disk);
    await context.setOffline(true);
    await preview(page);
    assert.deepEqual(errors,[]);
    console.log('PASS one-click public publishing, anonymous reader, stable updates, takedown, publishing key recovery and local diary preservation');
  }finally{
    if(websiteUrl){
      await context.setOffline(false);
      const key=await page.locator('#publishKeyValue').inputValue().catch(()=>'');
      if(key){
        const url=websiteUrl.replace('/pathos-share/','/api/pathos-personal/publication/');
        const headers={Authorization:'Bearer '+key};
        const result=await context.request.get(url,{headers}).then(response=>response.json()).catch(()=>null);
        if(result?.published)await context.request.delete(url,{headers:{...headers,'If-Match':result.revision}});
      }
    }
    await visitor.close();await context.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
