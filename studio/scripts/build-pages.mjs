import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { parseCatalogSeed } from '../app/content.ts';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
parseCatalogSeed(JSON.parse(fs.readFileSync('content/site.json','utf8')));
await build({configFile:path.resolve('vite.pages.config.ts')});
if(process.env.DEPLOY_TARGET==='firebase')console.log('Firebase Hosting app ready in dist-firebase/.');
else {fs.writeFileSync('dist-pages/.nojekyll','');console.log('GitHub Pages app ready in dist-pages/. Authentication and live data use Firebase directly.');}
