const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../IUH shop');let errors=[],scripts=0,pages=0;
for(const file of fs.readdirSync(path.join(root,'JS')).filter(x=>x.endsWith('.js'))){try{new vm.Script(fs.readFileSync(path.join(root,'JS',file),'utf8'),{filename:file});scripts++;}catch(e){errors.push(e.message);}}
for(const file of fs.readdirSync(path.join(root,'HTML')).filter(x=>x.endsWith('.html'))){const p=path.join(root,'HTML',file),doc=new JSDOM(fs.readFileSync(p,'utf8')).window.document;pages++;
 for(const node of doc.querySelectorAll('script[src],link[rel="stylesheet"][href]')){const url=node.getAttribute('src')||node.getAttribute('href');if(/^(https?:|\/\/)/.test(url))continue;const target=path.resolve(path.dirname(p),url.split('?')[0]);if(!fs.existsSync(target))errors.push(file+': missing '+url);}
 const ids=[...doc.querySelectorAll('[id]')].map(n=>n.id);if(new Set(ids).size!==ids.length)errors.push(file+': duplicate IDs');
 if(doc.querySelector('script[src*="supabase"]')&&!doc.querySelector('script[src*="iuh-core"]'))errors.push(file+': missing shared runtime');
}
console.log(JSON.stringify({scripts,pages,errors},null,2));process.exitCode=errors.length?1:0;
