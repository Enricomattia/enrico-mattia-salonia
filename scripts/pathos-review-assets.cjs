// Reproduce the checked-in offline assets after upgrading the pinned parser.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.dirname(require.resolve('markdown-it/package.json'));
const licenses=['markdown-it','entities','linkify-it','mdurl','punycode.js','uc.micro'].map(name=>{
  let directory=path.dirname(require.resolve(name,{paths:[source]}));
  while(!fs.existsSync(path.join(directory,'package.json'))||JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8')).name!==name){
    const parent=path.dirname(directory);if(parent===directory)throw Error('Missing package '+name);directory=parent;
  }
  const license=fs.readdirSync(directory).find(file=>/^LICENSE(?:-MIT)?(?:\.txt)?$/i.test(file));
  if(!license)throw Error('Missing license for '+name);
  const version=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8')).version;
  return name+'@'+version+'\n\n'+fs.readFileSync(path.join(directory,license),'utf8').trim();
}).join('\n\n----------------------------------------\n\n')+'\n';
for(const variant of ['pathos','pathos-personal']){
  const target=path.join(root,'public',variant);
  fs.copyFileSync(path.join(source,'dist/browser/markdown-it.umd.min.js'),path.join(target,'markdown-it.min.js'));
  fs.writeFileSync(path.join(target,'markdown-it.LICENSE.txt'),licenses);
}
for(const name of ['review-format.js','review-format.css']){
  fs.copyFileSync(path.join(root,'public/pathos',name),path.join(root,'public/pathos-personal',name));
}
