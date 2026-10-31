// Explicit one-time Firebase setup. Never writes to the personal `projects` collection.
// Default is a read-only plan; --apply performs the reviewed setup.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { parseCatalogSeed, storedApplication } from '../app/content.ts';
import { COMPANY_PROJECTS_COLLECTION, COMPANY_SETTINGS_COLLECTION, EDITOR_UIDS } from '../app/catalog-policy.ts';
const require=createRequire(import.meta.url);
const auth=require('firebase-tools/lib/auth.js');
const project='ammarportfolioweb';
const database=`projects/${project}/databases/(default)`;
const rulesRoot=`https://firebaserules.googleapis.com/v1/projects/${project}`;
const documents=`https://firestore.googleapis.com/v1/${database}/documents`;
const authConfig=`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
const reviewedOriginalHash='a8756fab8ed932e8532ca137c7050a7ed07fc815154f44e308fa7da43b99c046';
const apply=process.argv.includes('--apply');
const account=auth.getGlobalDefaultAccount();
if(!account)throw Error('Sign in to Firebase CLI before running setup.');
const credential=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
async function api(url,method='GET',body){
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${credential.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 if(response.status===404&&method==='GET')return null;
 if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(`${method} ${new URL(url).pathname}: ${response.status} ${data.error?.message??''}`);}
 return response.json();
}
async function list(collection){const all=[];let token='';do{const url=new URL(documents+'/'+collection);url.searchParams.set('pageSize','100');if(token)url.searchParams.set('pageToken',token);const page=await api(url);all.push(...(page?.documents??[]));token=page?.nextPageToken??'';}while(token);return all;}
const sourceBefore=await list('projects');
const fingerprint=docs=>JSON.stringify(docs.map(doc=>[doc.name,doc.updateTime]).sort((a,b)=>a[0].localeCompare(b[0])));
const release=await api(rulesRoot+'/releases/cloud.firestore');
const currentRules=await api('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
const existing=currentRules.source.files[0].content;
const desired=fs.readFileSync('firestore.rules','utf8');
const rulesChange=existing!==desired;
if(rulesChange&&crypto.createHash('sha256').update(existing).digest('hex')!==reviewedOriginalHash)throw Error('Production rules changed since review. Inspect them before applying anything.');
const settings=await api(documents+'/'+COMPANY_SETTINGS_COLLECTION+'/catalog');
const existingCompany=await list(COMPANY_PROJECTS_COLLECTION);
if(!settings&&existingCompany.length)throw Error('Company records already exist without settings. No existing records will be overwritten.');
const snapshot=parseCatalogSeed(JSON.parse(fs.readFileSync('content/site.json','utf8')));
if(snapshot.apps.some(app=>app.id.includes('/')))throw Error('Invalid company document ID.');
const config=await api(authConfig);
const domains=[...new Set([...config.authorizedDomains,'ammarrmalik185.github.io'])];
console.log(`Plan: ${rulesChange?'apply tested owner-only company rules':'keep current rules'}; ${settings?'preserve existing company records':`create ${snapshot.apps.length} company project record(s)`}; ${domains.length===config.authorizedDomains.length?'keep authorized domains':'authorize the GitHub Pages sign-in domain'}.`);
if(!apply){console.log('Read-only plan complete. Use --apply to perform this setup.');process.exit(0);}
fs.mkdirSync('.sites-runtime/firebase-backup',{recursive:true});
fs.writeFileSync('.sites-runtime/firebase-backup/setup-before.json',JSON.stringify({release,rules:currentRules,authorizedDomains:config.authorizedDomains,sourceVersions:sourceBefore.map(doc=>({name:doc.name,updateTime:doc.updateTime}))},null,2));
if(rulesChange){
 const created=await api(rulesRoot+'/rulesets','POST',{source:{files:[{name:'firestore.rules',content:desired}]}});
 const latest=await api(rulesRoot+'/releases/cloud.firestore');
 if(latest.rulesetName!==release.rulesetName)throw Error('Production rules changed concurrently. The new rules were not activated.');
 await api(rulesRoot+'/releases/cloud.firestore','PATCH',{release:{name:release.name,rulesetName:created.name},updateMask:'rulesetName'});
 const verified=await api(rulesRoot+'/releases/cloud.firestore');
 if(verified.rulesetName!==created.name)throw Error('Unable to verify the company rules update.');
 console.log('Applied and verified company collection rules; all other collection access behavior preserved.');
}
if(domains.length!==config.authorizedDomains.length){await api(authConfig+'?updateMask=authorizedDomains','PATCH',{name:config.name,authorizedDomains:domains});const verified=await api(authConfig);if(!domains.every(domain=>verified.authorizedDomains.includes(domain)))throw Error('Unable to verify sign-in domains.');console.log('Authorized GitHub Pages sign-in without changing providers or existing domains.');}
function value(input){if(input===null)return {nullValue:null};if(typeof input==='string')return {stringValue:input};if(typeof input==='number')return Number.isInteger(input)?{integerValue:String(input)}:{doubleValue:input};if(typeof input==='boolean')return {booleanValue:input};if(Array.isArray(input))return {arrayValue:{values:input.map(value)}};return {mapValue:{fields:fields(input)}};}
function fields(input){return Object.fromEntries(Object.entries(input).filter(([,v])=>v!==undefined).map(([key,v])=>[key,value(v)]));}
if(!settings){
 const writes=snapshot.apps.map(application=>({update:{name:`${database}/documents/${COMPANY_PROJECTS_COLLECTION}/${application.id}`,fields:{application:value(storedApplication(application)),personalProjectRef:application.personalProjectId?{referenceValue:`${database}/documents/projects/${application.personalProjectId}`}:{nullValue:null},updatedBy:{stringValue:EDITOR_UIDS[0]}}},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}));
 writes.push({update:{name:`${database}/documents/${COMPANY_SETTINGS_COLLECTION}/catalog`,fields:{company:value(snapshot.company),revision:{integerValue:'1'},updatedBy:{stringValue:EDITOR_UIDS[0]}}},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}});
 if(writes.some(write=>![COMPANY_PROJECTS_COLLECTION,COMPANY_SETTINGS_COLLECTION].some(collection=>write.update.name.startsWith(`${database}/documents/${collection}/`))))throw Error('Refusing an out-of-scope write.');
 await api(documents+':commit','POST',{writes});
 console.log(`Created ${snapshot.apps.length} company project record(s) and company settings; existing records cannot be overwritten by setup.`);
}
const sourceAfter=await list('projects');
if(fingerprint(sourceBefore)!==fingerprint(sourceAfter))throw Error('Personal project versions changed concurrently. This setup did not write to that collection; inspect the changes.');
const catalog=await list(COMPANY_PROJECTS_COLLECTION);
for(const document of catalog){const id=document.fields.application.mapValue.fields.personalProjectId?.stringValue;if(id&&document.fields.personalProjectRef.referenceValue!==`${database}/documents/projects/${id}`)throw Error('An imported project is missing its source reference.');}
console.log(`Verified: ${catalog.length} company record(s), valid source references, and all ${sourceAfter.length} personal project versions unchanged.`);
