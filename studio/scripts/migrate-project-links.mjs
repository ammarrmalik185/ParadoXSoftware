// Remove source-detail copies from company imports only; never write to `projects`.
// Read-only by default. --apply activates the tested rules and migrates matching records.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { linkedApplicationSchema } from '../app/content.ts';
import { COMPANY_PROJECTS_COLLECTION, COMPANY_SETTINGS_COLLECTION, EDITOR_UIDS } from '../app/catalog-policy.ts';
const require=createRequire(import.meta.url),auth=require('firebase-tools/lib/auth.js');
const account=auth.getGlobalDefaultAccount();if(!account)throw Error('Firebase CLI login is required.');
const token=await auth.getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
const database='projects/ammarportfolioweb/databases/(default)',documents=`https://firestore.googleapis.com/v1/${database}/documents`;
const rulesRoot='https://firebaserules.googleapis.com/v1/projects/ammarportfolioweb';
const reviewedRuleHash='dc02b2492693ddf5f93d7881cd87892eed6dadebb5312ace29c27c7675f28005';
async function api(url,method='GET',body){const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token.access_token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(`${method} ${new URL(url).pathname}: ${response.status} ${data.error?.message??''}`);}return response.json();}
async function list(collection){const all=[];let pageToken='';do{const url=new URL(documents+'/'+collection);url.searchParams.set('pageSize','100');if(pageToken)url.searchParams.set('pageToken',pageToken);const page=await api(url);all.push(...(page.documents??[]));pageToken=page.nextPageToken??'';}while(pageToken);return all;}
function decode(value){if('stringValue'in value)return value.stringValue;if('arrayValue'in value)return (value.arrayValue.values??[]).map(decode);if('mapValue'in value)return Object.fromEntries(Object.entries(value.mapValue.fields??{}).map(([key,value])=>[key,decode(value)]));return value;}
const versions=rows=>JSON.stringify(rows.map(row=>[row.name,row.updateTime]).sort((a,b)=>a[0].localeCompare(b[0])));
const originalProjects=await list('projects'),company=await list(COMPANY_PROJECTS_COLLECTION);
const release=await api(rulesRoot+'/releases/cloud.firestore');
const originalRules=await api('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
const desiredRules=fs.readFileSync('firestore.rules','utf8');
const rulesChanged=desiredRules!==originalRules.source.files[0].content;
if(rulesChanged&&crypto.createHash('sha256').update(originalRules.source.files[0].content).digest('hex')!==reviewedRuleHash)throw Error('The production rules changed since review. No changes were applied.');
const metadataKeys=['id','category','platforms','color','personalProjectId'];
const migrations=[];
for(const document of company){
 const fields=document.fields,app=fields.application?.mapValue?.fields;
 if(!app?.personalProjectId?.stringValue)continue;
 const metadata=linkedApplicationSchema.parse(decode(fields.application));
 const id=document.name.split('/').at(-1);if(metadata.id!==id)throw Error('A company document ID does not match its metadata.');
 if(fields.personalProjectRef?.referenceValue!==`${database}/documents/projects/${metadata.personalProjectId}`)throw Error('A company source reference does not match its source ID.');
 if(Object.keys(app).some(key=>!metadataKeys.includes(key))){const minimal=Object.fromEntries(metadataKeys.map(key=>[key,app[key]]));migrations.push({document,minimal});}
}
const settings=await api(documents+'/'+COMPANY_SETTINGS_COLLECTION+'/catalog');
console.log(`Plan: ${migrations.length} imported company record(s) to reduce to references and display settings; ${rulesChanged?'tighten linked-record rules':'keep current rules'}; ${originalProjects.length} personal projects remain read-only.`);
if(!process.argv.includes('--apply'))process.exit(0);
fs.mkdirSync('.sites-runtime/firebase-link-migration',{recursive:true});
fs.writeFileSync('.sites-runtime/firebase-link-migration/before.json',JSON.stringify({company,settings,release,rules:originalRules,sourceVersions:originalProjects.map(row=>({name:row.name,updateTime:row.updateTime}))},null,2));
if(rulesChanged){
 const ruleset=await api(rulesRoot+'/rulesets','POST',{source:{files:[{name:'firestore.rules',content:desiredRules}]}});
 const latest=await api(rulesRoot+'/releases/cloud.firestore');if(latest.rulesetName!==release.rulesetName)throw Error('Rules changed concurrently; migration stopped.');
 await api(rulesRoot+'/releases/cloud.firestore','PATCH',{release:{name:release.name,rulesetName:ruleset.name},updateMask:'rulesetName'});
 const verified=await api(rulesRoot+'/releases/cloud.firestore');if(verified.rulesetName!==ruleset.name)throw Error('Unable to verify the new rules.');
 console.log('Activated rules that reject copied source details on imported entries.');
}
if(migrations.length){
 const writes=migrations.map(({document,minimal})=>({update:{name:document.name,fields:{application:{mapValue:{fields:minimal}},personalProjectRef:document.fields.personalProjectRef,updatedBy:{stringValue:EDITOR_UIDS[0]}}},currentDocument:{updateTime:document.updateTime},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]}));
 writes.push({update:{name:settings.name,fields:{revision:{integerValue:String(Number(settings.fields.revision.integerValue)+1)},updatedBy:{stringValue:EDITOR_UIDS[0]}}},updateMask:{fieldPaths:['revision','updatedBy']},currentDocument:{updateTime:settings.updateTime},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]});
 if(writes.some(write=>![COMPANY_PROJECTS_COLLECTION,COMPANY_SETTINGS_COLLECTION].some(collection=>write.update.name.startsWith(`${database}/documents/${collection}/`))))throw Error('Out-of-scope write refused.');
 await api(documents+':commit','POST',{writes});
}
const after=await list(COMPANY_PROJECTS_COLLECTION);
for(const document of after){const app=document.fields.application?.mapValue?.fields;if(app?.personalProjectId&&Object.keys(app).some(key=>!metadataKeys.includes(key)))throw Error('An imported entry still contains copied details.');}
if(versions(originalProjects)!==versions(await list('projects')))throw Error('Personal projects changed concurrently. This migration never writes to them.');
for(const original of company.filter(row=>!row.fields.application?.mapValue?.fields?.personalProjectId)){const current=after.find(row=>row.name===original.name);if(current?.updateTime!==original.updateTime)throw Error('An unrelated company record changed concurrently.');}
console.log(`Verified: ${migrations.length} imported record(s) cleaned; all ${originalProjects.length} personal projects and all standalone company records unchanged.`);
