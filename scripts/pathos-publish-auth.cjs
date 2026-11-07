// Keep the OAuth landing page self-contained; hosting overlays cannot read its hash.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../public/pathos-personal');
const source=fs.readFileSync(path.join(root,'netlify-auth.js'),'utf8').replace(/\r\n?/g,'\n').trim();
const hash=crypto.createHash('sha256').update(source).digest('base64');
const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'sha256-'+hash+'\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>Connect Πathos to Netlify</title><style>body{max-width:36rem;margin:12vh auto;padding:24px;font:16px/1.6 system-ui;color:#303734;background:#f8f9f6}h1{font:32px Georgia,serif}</style></head><body><h1>Connect Πathos</h1><p id="connectionStatus" role="status">Finishing the Netlify connection…</p><script>'+source+'</script></body></html>\n';
const target=path.join(root,'netlify-auth.html');
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8').replace(/\r\n?/g,'\n')!==html)throw new Error('Run npm run sync:pathos-publish-auth to regenerate the OAuth landing page.');}
else fs.writeFileSync(target,html);
