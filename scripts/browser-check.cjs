const fs=require('node:fs');
const inspect=`JSON.stringify({url:location.pathname,width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.title,body:document.body.innerText.slice(0,70),broken:[...document.images].filter(i=>i.getAttribute('src')&&!i.naturalWidth&&i.getClientRects().length).map(i=>i.getAttribute('src'))})`;
const batch=[];
for(const page of ['trangchu','sanpham','diendan','gioithieu','dangnhap','dangky','lienhe','admin','vi']){batch.push(['open','http://127.0.0.1:4173/HTML/'+page+'.html'],['eval',inspect],['errors']);}
batch.push(['set','viewport','390','844'],['open','http://127.0.0.1:4173/HTML/trangchu.html'],['eval',inspect],['screenshot','audit/repair-mobile.png']);
fs.writeFileSync('audit/repair-browser-batch.json',JSON.stringify(batch));
