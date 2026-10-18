const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PassThrough}=require('node:stream');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const filename=path.resolve(__dirname,'../src/lib/pathos-page-images.ts');
const compiled=new Module(filename,module);compiled.filename=filename;compiled.paths=module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {extractPageImages,isPublicAddress,pageUrl,discoverPageImages,downloadPageImage}=compiled.exports;
const publicIp='93.184.216.34',page='https://venue.example/season/ka-in/';
function network(responses,resolve=async()=>[{address:publicIp,family:4}]){
  const calls=[];
  return {calls,resolve,request:(url,options,callback)=>{
    calls.push({url:url.href,options});
    const req=new EventEmitter();req.destroy=()=>{};
    req.end=()=>queueMicrotask(()=>{
      if(options.signal.aborted){req.emit('error',new Error('aborted'));return;}
      const next=responses.shift();if(!next){req.emit('error',new Error('unexpected request'));return;}
      const res=new PassThrough();res.statusCode=next.status||200;
      res.headers=next.headers||{'content-type':'text/html'};
      callback(res);if(!res.destroyed)res.end(next.body||'');
    });
    return req;
  }};
}
test('extracts relative metadata, decoded URLs and JSON-LD without executing markup',()=>{
  const result=extractPageImages(`<title>KA-IN &amp; guests</title>
    <base href="https://cdn.example/events/"><meta content="/poster.jpg?a=1&amp;b=2" property="og:image">
    <meta name="twitter:image" content="twitter.png">
    <script type="application/ld+json">{"@type":"TheaterEvent","image":{"url":"/event.webp"}}</script>
    <img src="tiny.jpg" width="20"><img src="/icons/social.svg"><img src="photo.jpg" width="600">`,page);
  assert.equal(result.title,'KA-IN & guests');
  assert.deepEqual(result.images.map(x=>x.url),['https://cdn.example/poster.jpg?a=1&b=2','https://cdn.example/events/twitter.png','https://cdn.example/event.webp','https://cdn.example/events/photo.jpg']);
});
test('KA-IN-shaped page excludes organization logos and returns production photos without og:image',()=>{
  const result=extractPageImages(`<title>KA-IN | theatre</title><script type="application/ld+json">{"@graph":[{"@type":"Organization","logo":{"@type":"ImageObject","url":"https://venue.example/DARDUST.jpg"}},{"@type":"WebPage","image":{"@id":"https://venue.example/#logo"}}]}</script><img src="/production-02.png" alt="KA-IN"><img src="/production-01.png" alt="KA-IN">`,page);
  assert.deepEqual(result.images.map(x=>x.url),['https://venue.example/production-02.png','https://venue.example/production-01.png']);
});
test('rejects non-web URLs, credentials, nonstandard ports and nonpublic IPv4/IPv6 forms',()=>{
  for(const input of ['file:///etc/passwd','javascript:alert(1)','https://user:pass@venue.example','http://localhost','http://metadata.internal','http://127.1','http://2130706433','http://0x7f000001','http://10.1.2.3','http://169.254.169.254','http://[::1]','http://[::ffff:127.0.0.1]','https://venue.example:8443'])assert.throws(()=>pageUrl(input),undefined,input);
  for(const address of ['0.0.0.0','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','192.0.2.1','224.0.0.1','::','::1','fc00::1','fe80::1','2001:db8::1','::ffff:10.0.0.1'])assert.equal(isPublicAddress(address),false,address);
  assert.equal(isPublicAddress(publicIp),true);assert.equal(isPublicAddress('2606:4700:4700::1111'),true);
});
test('pins the validated DNS address and forwards neither cookies nor authorization',async()=>{
  const mock=network([{body:'<meta property="og:image" content="/poster.jpg">'}]);
  const result=await discoverPageImages(page,mock);assert.equal(result.images[0].url,'https://venue.example/poster.jpg');
  const options=mock.calls[0].options;assert.equal(options.agent,false);assert.equal(options.family,4);
  options.lookup('venue.example',{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,publicIp);assert.equal(family,4);});
  assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,undefined);
});
test('rejects mixed public/private DNS answers before connecting',async()=>{
  const mock=network([],async()=>[{address:publicIp,family:4},{address:'127.0.0.1',family:4}]);
  await assert.rejects(discoverPageImages(page,mock),/public website/);assert.equal(mock.calls.length,0);
});
test('validates every redirect and never connects to a private redirect target',async()=>{
  const mock=network([{status:302,headers:{location:'http://127.0.0.1/secrets'}}]);
  await assert.rejects(discoverPageImages(page,mock),/public http/);assert.equal(mock.calls.length,1);
  const rebinding=network([{status:302,headers:{location:'/new'}}]);let lookups=0;
  rebinding.resolve=async()=>[{address:++lookups===1?publicIp:'10.0.0.1',family:4}];
  await assert.rejects(discoverPageImages(page,rebinding),/public website/);assert.equal(rebinding.calls.length,1);
});
test('resolves relative images against the final redirected URL and excludes private image hosts',async()=>{
  const mock=network([{status:302,headers:{location:'https://other.example/events/final/'}},{body:'<img src="cover.jpg"><img src="https://hidden.example/art.jpg">'}],async host=>[{address:host==='hidden.example'?'192.168.1.2':publicIp,family:4}]);
  const result=await discoverPageImages(page,mock);
  assert.equal(result.pageUrl,'https://other.example/events/final/');assert.deepEqual(result.images,[{url:'https://other.example/events/final/cover.jpg',source:'Page image'}]);
});
test('bounds response size, redirects and DNS time; rejects unsupported bodies and blocked sites',async()=>{
  await assert.rejects(discoverPageImages(page,{...network([{body:'x'.repeat(101)}]),maxBytes:100}),/too large/);
  await assert.rejects(discoverPageImages(page,network([{status:302,headers:{location:'/again'}},{status:302,headers:{location:'/again'}},{status:302,headers:{location:'/again'}},{status:302,headers:{location:'/again'}}])),/too many/);
  await assert.rejects(discoverPageImages(page,{resolve:()=>new Promise(()=>{}),timeoutMs:20}),/too long/);
  await assert.rejects(discoverPageImages(page,network([{headers:{'content-type':'application/pdf'}}])),/webpage or image/);
  await assert.rejects(discoverPageImages(page,network([{status:403}])),/would not let/);
});
test('supports direct public image links and safely handles pages with no artwork',async()=>{
  const direct=await discoverPageImages('https://venue.example/poster.png',network([{headers:{'content-type':'image/png'}}]));
  assert.deepEqual(direct.images,[{url:'https://venue.example/poster.png',source:'Image link'}]);
  const empty=await discoverPageImages(page,network([{body:'<title>No artwork</title>'}]));assert.deepEqual(empty.images,[]);
});
test('stores a bounded raster copy, checks redirects/DNS, and rejects disguised or active content',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6v7sAAAAASUVORK5CYII=','base64');
  const mock=network([{status:302,headers:{location:'https://art.example/final.png'}},{headers:{'content-type':'image/png'},body:png}]);
  const stored=await downloadPageImage('https://venue.example/art.png',mock);
  assert.equal(stored.dataUrl,'data:image/png;base64,'+png.toString('base64'));
  assert.equal(mock.calls[1].options.headers.Cookie,undefined);assert.equal(mock.calls[1].options.headers.Authorization,undefined);
  mock.calls[1].options.lookup('art.example',{},(err,address)=>assert.equal(address,publicIp));
  await assert.rejects(downloadPageImage(page,network([{headers:{'content-type':'image/png'},body:'<html>Not an image</html>'}])),/supported image/);
  await assert.rejects(downloadPageImage(page,network([{headers:{'content-type':'image/svg+xml'},body:'<svg/>'}])),/webpage or image/);
  await assert.rejects(downloadPageImage(page,{...network([{headers:{'content-type':'image/png'},body:png}]),maxBytes:12}),/too large/);
  await assert.rejects(downloadPageImage(page,network([{status:302,headers:{location:'http://127.0.0.1/private'}}])),/public http/);
  await assert.rejects(downloadPageImage(page,network([],async()=>[{address:'10.0.0.1',family:4}])),/public website/);
  await assert.rejects(downloadPageImage(page,{resolve:()=>new Promise(()=>{}),timeoutMs:10}),/too long/);
});
