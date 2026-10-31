import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const directory=process.env.DEPLOY_TARGET==='firebase'?'dist-firebase':'dist-pages';
const html=fs.readFileSync(directory+'/index.html','utf8');
const base=process.env.PAGES_BASE_PATH||'/ParadoXSoftware/';
assert.match(html,/<title>ParadoXSoftware/);
const references=[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]);
assert.ok(references.some(ref=>ref.endsWith('.js')),'No JavaScript entrypoint');
for(const ref of references){if(ref.startsWith('http'))continue;assert.ok(ref.startsWith(base),`Asset does not respect the deployment base: ${ref}`);assert.ok(fs.existsSync(path.join(directory,ref.slice(base.length))),`Missing asset: ${ref}`);}
if(directory==='dist-pages')assert.ok(fs.existsSync(directory+'/.nojekyll'));
assert.ok(fs.existsSync(directory+'/company-icon.png'));
const scripts=fs.readdirSync(directory+'/assets').filter(name=>name.endsWith('.js')).map(name=>fs.readFileSync(path.join(directory,'assets',name),'utf8')).join('');
assert.ok(!scripts.includes('cloudflare:workers'),'Server code leaked into the static build');
assert.ok(!scripts.includes('OAI-Sites-Authorization'),'Private backend service access leaked into static JavaScript');
assert.ok(!scripts.includes('paradoxsoftware-studio.qinmin-0747.chatgpt.site'),'Obsolete private studio URL was bundled into the site');
console.log('PASS: Static artifact, deployment base path, referenced assets, company icon, and server/credential isolation.');
