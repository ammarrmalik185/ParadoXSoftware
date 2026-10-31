// Add the selected Hosting site's sign-in domains; preserve providers and existing domains.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const auth=createRequire(import.meta.url)('firebase-tools/lib/auth.js');
const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase CLI login is required.');
const credential=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const endpoint='https://identitytoolkit.googleapis.com/admin/v2/projects/ammarportfolioweb/config';
async function api(method='GET',body){const response=await fetch(endpoint+(method==='PATCH'?'?updateMask=authorizedDomains':''),{method,headers:{Authorization:'Bearer '+credential.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Authentication configuration request failed (${response.status}).`);return response.json();}
const config=await api();
const required=['paradox-software.web.app','paradox-software.firebaseapp.com'];
const missing=required.filter(domain=>!config.authorizedDomains.includes(domain));
if(!missing.length){console.log('Firebase Hosting sign-in domains are already authorized.');process.exit(0);}
console.log('Missing sign-in domains:',missing.join(', '));
if(!process.argv.includes('--apply'))process.exit(0);
fs.mkdirSync('.sites-runtime/firebase-hosting',{recursive:true});
fs.writeFileSync('.sites-runtime/firebase-hosting/auth-domains-before.json',JSON.stringify(config.authorizedDomains,null,2));
const domains=[...new Set([...config.authorizedDomains,...required])];
await api('PATCH',{name:config.name,authorizedDomains:domains});
const verified=await api();if(!domains.every(domain=>verified.authorizedDomains.includes(domain)))throw Error('Unable to verify Hosting sign-in domains.');
console.log('Authorized both paradox-software Hosting domains; existing domains and providers preserved.');
