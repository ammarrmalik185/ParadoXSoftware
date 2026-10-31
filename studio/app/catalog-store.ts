'use client';
import { collection, doc, onSnapshot, onSnapshotsInSync, runTransaction, serverTimestamp, type Firestore, type DocumentData } from 'firebase/firestore';
import { getFirebaseClient } from './firebase-client';
import { COMPANY_PROJECTS_COLLECTION, COMPANY_SETTINGS_COLLECTION, isCatalogEditor } from './catalog-policy';
import { displayApplication, storedApplication, contentSchema, type Application, type Content } from './content';
import { normalizeProject, normalizePersonalProjectData } from './portfolio';

export type CatalogState = {data:Content;revision:number;initialized:boolean};
export function catalogError(error:unknown):string {
 const code=(error as {code?:string})?.code;
 if(code==='permission-denied')return 'Firestore denied access. Check the company collection rules and sign in with the portfolio owner account.';
 if(code==='unavailable')return 'Firestore is unavailable. Your changes have not been saved; please try again.';
 return error instanceof Error?error.message:'Unable to update the catalog.';
}
export function subscribeCatalog(fallback:Content,onChange:(state:CatalogState)=>void,onError:(error:unknown)=>void,db=getFirebaseClient().db) {
 let settings:DocumentData|undefined,applications:Application[]=[],settingsReady=false,projectsReady=false;
 const emit=()=>{if(settingsReady&&projectsReady)onChange({data:settings?contentSchema.parse({company:settings.company,apps:applications}):fallback,revision:settings?.revision??0,initialized:!!settings});};
 const stopSettings=onSnapshot(doc(db,COMPANY_SETTINGS_COLLECTION,'catalog'),snapshot=>{settings=snapshot.data();settingsReady=true;},onError);
 const stopProjects=onSnapshot(collection(db,COMPANY_PROJECTS_COLLECTION),snapshot=>{try{applications=snapshot.docs.map(document=>{const data=document.data();return displayApplication({...data.application,id:document.id});}).sort((a,b)=>a.name.localeCompare(b.name));projectsReady=true;}catch(error){onError(error);}},onError);
 const stopSync=onSnapshotsInSync(db,()=>{try{emit();}catch(error){onError(error);}});
 return ()=>{stopSettings();stopProjects();stopSync();};
}
export function subscribePersonalProject(id:string,onChange:(project:ReturnType<typeof normalizeProject>|null)=>void,onError:(error:unknown)=>void,db=getFirebaseClient().db) {
 if(!/^[A-Za-z0-9_-]{1,150}$/.test(id))throw Error('Invalid personal project ID.');
 // This subscription has no write path to the personal projects collection.
 return onSnapshot(doc(db,'projects',id),snapshot=>{
  if(!snapshot.exists()){onChange(null);return;}
  onChange(normalizePersonalProjectData(snapshot.id,snapshot.data()));
 },onError);
}
export async function saveCatalog(next:Content,previous:Content,expectedRevision:number,db?:Firestore):Promise<number> {
 const client=getFirebaseClient();
 if(!isCatalogEditor(client.auth.currentUser))throw Error('Sign in with the portfolio owner account to change projects.');
 return saveCatalogTransaction(db??client.db,next,previous,expectedRevision,client.auth.currentUser!.uid);
}
// Shared transaction implementation is also exercised against the local emulator.
export async function saveCatalogTransaction(db:Firestore,next:Content,previous:Content,expectedRevision:number,userId:string):Promise<number> {
 const parsed=contentSchema.parse(next);
 if(parsed.apps.some(app=>!app.personalProjectId&&!app.platforms.length))throw Error('Choose at least one platform for a company application.');
 const ids=parsed.apps.map(app=>app.id),linked=parsed.apps.flatMap(app=>app.personalProjectId?[app.personalProjectId]:[]);
 if(new Set(ids).size!==ids.length||new Set(linked).size!==linked.length)throw Error('A project is already included in this catalog.');
 if(ids.some(id=>!id||id.includes('/')||id==='.'||id==='..'))throw Error('Invalid company project ID.');
 return runTransaction(db,async transaction=>{
  const settingsRef=doc(db,COMPANY_SETTINGS_COLLECTION,'catalog');
  const current=await transaction.get(settingsRef);
  const revision=current.data()?.revision??0;
  if(revision!==expectedRevision)throw Error('The catalog changed in another session. Close the editor and reopen it before saving.');
  const previousById=new Map(previous.apps.map(app=>[app.id,app]));
  const timestamp=serverTimestamp();
  for(const app of parsed.apps){const record=storedApplication(app),previousApp=previousById.get(app.id);if(!current.exists()||!previousApp||JSON.stringify(storedApplication(previousApp))!==JSON.stringify(record))transaction.set(doc(db,COMPANY_PROJECTS_COLLECTION,app.id),{application:record,personalProjectRef:app.personalProjectId?doc(db,'projects',app.personalProjectId):null,updatedAt:timestamp,updatedBy:userId});}
  for(const old of previous.apps)if(!ids.includes(old.id))transaction.delete(doc(db,COMPANY_PROJECTS_COLLECTION,old.id));
  transaction.set(settingsRef,{company:parsed.company,revision:revision+1,updatedAt:timestamp,updatedBy:userId});
  return revision+1;
 });
}
