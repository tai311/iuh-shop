const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../IUH shop');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json'};
http.createServer((request,response) => {
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url,'http://localhost').pathname).replaceAll('//','/')); }
  catch { response.writeHead(400).end(); return; }
  if (file !== root && !file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  if (file === root || fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  fs.readFile(file,(error,bytes) => {
    if (error) { response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'}).end('Not found'); return; }
    response.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : bytes);
  });
}).listen(Number(process.env.PORT || 4173),'127.0.0.1',() => console.log('IUH Shop: http://127.0.0.1:'+(process.env.PORT || 4173)));
