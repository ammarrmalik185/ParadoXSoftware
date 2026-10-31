import { firebaseConfig } from './firebase-config';
import type { Application, Blocks } from './content';
import { normalizePlatforms } from './content';

type Value = { stringValue?:string; integerValue?:string; doubleValue?:number; booleanValue?:boolean; arrayValue?:{values?:Value[]}; mapValue?:{fields?:Record<string,Value>}; nullValue?:unknown };
type Document = { name:string; fields?:Record<string,Value> };
type RecordData = Record<string,unknown>;
export type PersonalProject = Pick<Application,'name'|'tagline'|'icon'|'url'|'repositoryUrl'|'description'> & {id:string;tags:string[];platforms?:Application['platforms']};
const endpoint=`https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/projects`;
function decode(value:Value):unknown {
 if(value.stringValue!==undefined)return value.stringValue;
 if(value.integerValue!==undefined)return Number(value.integerValue);
 if(value.doubleValue!==undefined)return value.doubleValue;
 if(value.booleanValue!==undefined)return value.booleanValue;
 if(value.arrayValue)return (value.arrayValue.values??[]).map(decode);
 if(value.mapValue)return Object.fromEntries(Object.entries(value.mapValue.fields??{}).map(([k,v])=>[k,decode(v)]));
 return null;
}
const record=(v:unknown):RecordData=>v&&typeof v==='object'&&!Array.isArray(v)?v as RecordData:{};
const text=(v:unknown)=>typeof v==='string'?v:'';
const url=(v:unknown)=>/^https?:\/\//i.test(text(v))?text(v).slice(0,2000):'';
function listLines(items:unknown,depth=0):string[] {
 if(!Array.isArray(items)||depth>8)return [];
 return items.flatMap(item=>typeof item==='string'?['• '+item]:['• '+text(record(item).content),...listLines(record(item).items,depth+1)]);
}
export function normalizeProject(document:Document):PersonalProject {
 return normalizePersonalProjectData(document.name.split('/').at(-1)!,record(decode({mapValue:{fields:document.fields}})));
}
export function normalizePersonalProjectData(id:string,data:RecordData):PersonalProject {
 const project=record(data.project),content=record(data.content);
 const blocks:Blocks['blocks']=[];
 if(Array.isArray(content.blocks))for(const raw of content.blocks.slice(0,100)) {
  const block=record(raw),body=record(block.data);
  if(block.type==='paragraph'||block.type==='header')blocks.push({type:block.type,data:{text:text(body.text).slice(0,20000),...(block.type==='header'?{level:2}:{})}});
  else if(block.type==='list')blocks.push({type:'paragraph',data:{text:listLines(body.items).join('\n').slice(0,20000)}});
  else if(block.type==='quote')blocks.push({type:'paragraph',data:{text:[text(body.text),text(body.caption)].filter(Boolean).join('\n').slice(0,20000)}});
 }
 const summary=text(project.summary)||text(data.summary);
 if(!blocks.length&&summary)blocks.push({type:'paragraph',data:{text:summary.slice(0,20000)}});
 return {id,name:(text(project.title)||text(data.title)||'Untitled project').slice(0,100),tagline:summary.slice(0,250)||'Explore this personal portfolio project.',icon:url(project.image),url:url(project.liveUrl),repositoryUrl:url(project.repositoryUrl),description:{blocks},tags:(Array.isArray(project.skills)?project.skills.map(text):text(data.tags).split(',').map(s=>s.trim())).filter(Boolean),...(Array.isArray(project.platforms)?{platforms:normalizePlatforms(project.platforms)}:{})};
}
// Fixed host/collection, GET only. No SDK write APIs or privileged credentials.
async function read(path:string,params:Record<string,string>={}) {
 const target=new URL(endpoint+path);target.searchParams.set('key',firebaseConfig.apiKey);
 for(const field of ['project','title','tags','content'])target.searchParams.append('mask.fieldPaths',field);
 for(const [key,value] of Object.entries(params))target.searchParams.set(key,value);
 const response=await fetch(target,{method:'GET',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error(response.status===404?'The personal project no longer exists.':response.status===403?'Firebase is not allowing access to portfolio projects.':'Personal projects could not be loaded. Try again shortly.');
 return response.json();
}
export async function listPersonalProjects():Promise<PersonalProject[]> {
 const projects:PersonalProject[]=[];let pageToken='';
 do {const page=await read('',{pageSize:'100',...(pageToken?{pageToken}:{})}) as {documents?:Document[];nextPageToken?:string};projects.push(...(page.documents??[]).map(normalizeProject));pageToken=page.nextPageToken??'';if(projects.length>=2000&&pageToken)throw Error('Too many portfolio projects to list.');}while(pageToken);
 return projects.sort((a,b)=>a.name.localeCompare(b.name));
}
export async function readPersonalProject(id:string):Promise<PersonalProject> {
 if(!/^[A-Za-z0-9_-]{1,150}$/.test(id))throw Error('Invalid personal project ID.');
 return normalizeProject(await read('/'+encodeURIComponent(id)) as Document);
}
export function applyPersonalProject(app:Application,project:PersonalProject):Application {
 const {id: _id,tags: _tags,platforms,...fields}=project;
 return {...app,...fields,...(platforms!==undefined?{platforms}:{})};
}
