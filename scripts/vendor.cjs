const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'IUH shop', 'JS', 'vendor');
fs.mkdirSync(target, { recursive: true });
for (const [source, name] of [
  ['node_modules/dompurify/dist/purify.min.js', 'purify.min.js'],
  ['node_modules/dompurify/LICENSE', 'DOMPurify-LICENSE'],
  ['node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'supabase.min.js'],
  ['node_modules/@supabase/supabase-js/LICENSE', 'Supabase-LICENSE'],
  ['node_modules/qrcode-generator/dist/qrcode.js', 'qrcode.js']
]) fs.copyFileSync(path.join(root, source), path.join(target, name));
console.log('Vendored DOMPurify 3.4.16, Supabase JS 2.117.2 and qrcode-generator 2.0.4.');
