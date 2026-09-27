const fs=require('node:fs');
const read="JSON.stringify({page:location.pathname,width:innerWidth,scroll:document.documentElement.scrollWidth,content:document.body.innerText.length,broken:[...document.images].filter(i=>i.getAttribute('src')&&i.complete&&!i.naturalWidth&&i.getClientRects().length).map(i=>i.getAttribute('src'))})";
let commands=[['set','viewport','1280','900']];
for(const file of fs.readdirSync('IUH shop/HTML').filter(f=>f.endsWith('.html')))commands.push(['open','http://127.0.0.1:4173/HTML/'+encodeURIComponent(file)],['eval',read],['errors']);
for(const width of [360,768]){commands.push(['set','viewport',String(width),'900']);for(const page of ['trangchu','sanpham','diendan'])commands.push(['open','http://127.0.0.1:4173/HTML/'+page+'.html'],['eval',read]);}
commands.push(['close']);fs.writeFileSync('audit/final-browser-batch.json',JSON.stringify(commands));
