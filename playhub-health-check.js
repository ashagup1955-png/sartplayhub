const fs = require('fs');
const path = require('path');
const root = __dirname;
const required = ['index.html','app.js','games.js','style.css','sw.js','manifest.webmanifest','robots.txt','sitemap.xml'];
let failed = false;
for (const f of required) {
  if (!fs.existsSync(path.join(root,f))) { console.error('MISSING', f); failed = true; }
}
const gamesDir = path.join(root,'games');
const games = fs.readdirSync(gamesDir,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
for (const id of games) {
  const f=path.join(gamesDir,id,'index.html');
  if (!fs.existsSync(f)) { console.error('MISSING GAME ENTRY', id); failed=true; }
}
const catalog=fs.readFileSync(path.join(root,'games.js'),'utf8');
for (const id of games) if (!catalog.includes(`id:"${id}"`)) { console.warn('NOT IN CATALOG', id); }
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
if (/eaglercraft-1-12-2.*\.html|games\/eaglercraft-1-12-2/i.test(sw)) { console.error('EAGLERCRAFT FOUND IN SW PRECACHE'); failed=true; }
console.log(`PlayHub health check: ${failed?'FAIL':'PASS'} (${games.length} game directories)`);
process.exitCode=failed?1:0;
