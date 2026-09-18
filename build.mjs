import fs from 'node:fs';
fs.rmSync('dist',{recursive:true,force:true});fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
const files={};for(const [path,type] of [['index.html','text/html; charset=utf-8'],['theme.css','text/css'],['payments.js','text/javascript'],['assets/andallo-logo.png','image/png'],['assets/service-hero.png','image/png']])files['/'+path]={type,data:fs.readFileSync(path).toString('base64')};
const html=fs.readFileSync('index.html','utf8');const vm=await import('node:vm');const ctx={};vm.createContext(ctx);vm.runInContext(html.match(/let providers = (\[[\s\S]*?\n\]);/)[0]+';globalThis.catalog=providers;',ctx);
fs.writeFileSync('dist/server/index.js','const FILES='+JSON.stringify(files)+';\nconst CATALOG='+JSON.stringify(ctx.catalog.map(p=>({id:p.id,price:p.priceMin,email:p.providerEmail})))+';\n'+fs.readFileSync('worker.js','utf8'));
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');console.log('Worker built with embedded assets and R2 storage.');
