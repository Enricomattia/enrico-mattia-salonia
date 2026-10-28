const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const root=path.resolve(__dirname,'../public');
const context=vm.createContext({});
for(const file of ['markdown-it.min.js','review-format.js'])vm.runInContext(fs.readFileSync(path.join(root,'pathos',file),'utf8'),context);
const review=context.PathosReview;
test('nested formatting, paragraphs, lists, quotations and readable excerpts',()=>{
 const source='A **bold and *italic*** review with ~~cuts~~.\n\n> A quote\n\n- One\n- Two\n\n1. First\n2. Second\n\n[Read more](https://example.com)';
 const html=review.render(source);
 for(const tag of ['strong','em','s','blockquote','ul','ol','li','a'])assert.match(html,new RegExp('<'+tag+'[ >]'));
 assert.equal(review.text(source).replace(/\s+/g,' '),'A bold and italic review with cuts. A quote One Two First Second Read more');
 assert.match(html,/rel="noopener noreferrer"/);
});
test('plain text, line breaks, punctuation and stored strings stay intact',()=>{
 const source='An ordinary review: 2 < 3 & 5 > 4.\nAnother line.\n\nA paragraph with snake_case.';
 assert.match(review.render(source),/2 &lt; 3 &amp; 5 &gt; 4\.<br>/);
 assert.equal(review.text(source),source);
 assert.equal(review.render(''), '');
});
test('raw HTML, images and unsafe links cannot execute or fetch media',()=>{
 const source='<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n<svg onload=alert(1)>\n[bad](javascript:alert(1))\n[encoded](jav&#x61;script:alert(1))\n[data](data:text/html,bad)\n[relative](/pathos)\n![tracking](https://example.com/pixel.png)';
 const html=review.render(source);
 assert.doesNotMatch(html,/<(?:script|img|svg|iframe)(?:\s|>)/i);
 assert.doesNotMatch(html,/<a href="(?:javascript:|data:|\/pathos)/i);
 assert.match(html,/&lt;script&gt;/);
 assert.match(review.render('[safe](https://example.com/?a=1&b=2 "a\\\" title")'),/<a href="https:\/\/example.com/);
});
test('offline copies and pinned parser bundle are reproducible',()=>{
 const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
 for(const file of ['markdown-it.min.js','markdown-it.LICENSE.txt','review-format.js','review-format.css'])assert.equal(read(path.join(root,'pathos',file)),read(path.join(root,'pathos-personal',file)),file);
 const parser=path.dirname(require.resolve('markdown-it/package.json'));
 assert.equal(read(path.join(root,'pathos/markdown-it.min.js')),read(path.join(parser,'dist/browser/markdown-it.umd.min.js')));
});
