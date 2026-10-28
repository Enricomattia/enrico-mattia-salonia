// Rebuild the self-contained visual editor for each independently cached app.
const fs=require('node:fs');
const path=require('node:path');
const esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
async function build({check=false}={}){
 const result=await esbuild.build({
  absWorkingDir:root,entryPoints:['src/lib/pathos-review-editor.mjs'],bundle:true,format:'iife',
  globalName:'PathosReviewEditor',target:['es2020'],minify:true,write:false,metafile:true,legalComments:'none',
  // Reuse the exact parser already loaded by both apps instead of bundling a second dialect.
  plugins:[{name:'shared-markdown',setup(build){
   build.onResolve({filter:/^markdown-it$/},()=>({path:'markdown-it',namespace:'pathos-global'}));
   build.onLoad({filter:/.*/,namespace:'pathos-global'},()=>({contents:'export default globalThis.markdownit;',loader:'js'}));
  }}]
 });
 const packages=new Map();
 for(const input of Object.keys(result.metafile.inputs).filter(name=>name.startsWith('node_modules/'))){
  let directory=path.dirname(path.join(root,input));
  while(!fs.existsSync(path.join(directory,'package.json'))){const parent=path.dirname(directory);if(parent===directory)throw Error(input);directory=parent;}
  const pkg=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));
  const license=fs.readdirSync(directory).find(name=>/^LICENSE(?:-MIT)?(?:\.txt)?$/i.test(name));
  if(!license)throw Error('Missing license for '+pkg.name);
  packages.set(pkg.name,pkg.name+'@'+pkg.version+'\n\n'+fs.readFileSync(path.join(directory,license),'utf8').trim());
 }
 const notices=[...packages.values()].sort().join('\n\n----------------------------------------\n\n')+'\n';
 for(const variant of ['pathos','pathos-personal']){
  for(const [name,contents] of [['review-editor.js',result.outputFiles[0].contents],['review-editor.LICENSE.txt',notices]]){
   const file=path.join(root,'public',variant,name);
   if(check){if(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')!==Buffer.from(contents).toString().replace(/\r\n/g,'\n'))throw Error('Rebuild '+variant+'/'+name);}
   else fs.writeFileSync(file,contents);
  }
 }
 console.log((check?'Verified':'Built')+' visual review editor ('+result.outputFiles[0].contents.length+' bytes) for both apps.');
}
if(require.main===module)build({check:process.argv.includes('--check')}).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={build};
