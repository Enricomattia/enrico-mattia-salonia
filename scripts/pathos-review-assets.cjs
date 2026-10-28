// Reproduce the checked-in offline assets after upgrading the pinned parser.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.dirname(require.resolve('markdown-it/package.json'));
for(const variant of ['pathos','pathos-personal']){
  const target=path.join(root,'public',variant);
  fs.copyFileSync(path.join(source,'dist/browser/markdown-it.umd.min.js'),path.join(target,'markdown-it.min.js'));
  fs.copyFileSync(path.join(source,'LICENSE'),path.join(target,'markdown-it.LICENSE.txt'));
}
for(const name of ['review-format.js','review-format.css']){
  fs.copyFileSync(path.join(root,'public/pathos',name),path.join(root,'public/pathos-personal',name));
}
