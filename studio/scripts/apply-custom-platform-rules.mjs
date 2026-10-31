// Apply only the reviewed standalone custom-platform change; never writes project data.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const auth=createRequire(import.meta.url)('firebase-tools/lib/auth.js');
const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase CLI login is required.');
const credential=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
async function api(url,method='GET',body){const response=await fetch(url,{method,headers:{Authorization:'Bearer '+credential.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Firebase rules request failed (${response.status}).`);return response.json();}
const root='https://firebaserules.googleapis.com/v1/projects/ammarportfolioweb';
const release=await api(root+'/releases/cloud.firestore');
const current=await api('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
const existing=current.source.files[0].content,desired=fs.readFileSync('firestore.rules','utf8');
if(existing===desired){console.log('Platform rules are already current.');process.exit(0);}
if(crypto.createHash('sha256').update(existing).digest('hex')!=='b19dff33e42aaae47ca03108ed012907c9ca5e407dff2623720cd67c64c5c9b0')throw Error('Production rules changed since review; no changes applied.');
console.log('Plan: allow validated custom platforms on standalone company projects only. Linked-platform restrictions and owner-only writes remain enforced.');
if(!process.argv.includes('--apply'))process.exit(0);
fs.mkdirSync('.sites-runtime/firebase-custom-platform-rules',{recursive:true});fs.writeFileSync('.sites-runtime/firebase-custom-platform-rules/before.json',JSON.stringify({release,rules:current},null,2));
const created=await api(root+'/rulesets','POST',{source:{files:[{name:'firestore.rules',content:desired}]}});
const latest=await api(root+'/releases/cloud.firestore');if(latest.rulesetName!==release.rulesetName)throw Error('Production rules changed concurrently; no release update applied.');
await api(root+'/releases/cloud.firestore','PATCH',{release:{name:release.name,rulesetName:created.name},updateMask:'rulesetName'});
if((await api(root+'/releases/cloud.firestore')).rulesetName!==created.name)throw Error('Unable to verify the rule update.');
console.log('Verified platform compatibility rules. No project documents were written.');
