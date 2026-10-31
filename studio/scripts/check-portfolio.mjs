import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { companyPlatformsSchema, catalogPlatforms, linkedApplicationSchema } from '../app/content.ts';
assert.deepEqual(companyPlatformsSchema.parse([' Steam Deck ','Steam Deck',' android ','Android']),['Steam Deck','Android']);
assert.deepEqual(catalogPlatforms([{platforms:['Steam Deck','Web']},{platforms:['steam deck','Linux']}]),['Web','Linux','Steam Deck']);
assert.equal(companyPlatformsSchema.safeParse(['All apps']).success,false);
assert.equal(companyPlatformsSchema.safeParse(['line\nbreak']).success,false);
assert.equal(linkedApplicationSchema.safeParse({id:'linked',category:'Tools',platforms:['Steam Deck'],color:'mint',personalProjectId:'original'}).success,false);

// Execute the actual adapter with a fetch spy: external requests must all be GET.
const moduleUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const config=moduleUrl(compile(fs.readFileSync('app/firebase-config.ts','utf8')));
const adapter=await import(moduleUrl(compile(fs.readFileSync('app/portfolio.ts','utf8')).replace("'./firebase-config'",JSON.stringify(config)).replace("'./content'",JSON.stringify(new URL('../app/content.ts',import.meta.url).href))));
const value=input=>typeof input==='string'?{stringValue:input}:Array.isArray(input)?{arrayValue:{values:input.map(value)}}:{mapValue:{fields:Object.fromEntries(Object.entries(input).map(([k,v])=>[k,value(v)]))}};
const doc={name:'projects/test/databases/(default)/documents/projects/one',fields:Object.fromEntries(Object.entries({project:{title:'Original title',summary:'Source summary',image:'javascript:alert(1)',liveUrl:'https://example.com',repositoryUrl:'https://github.com/example/project',skills:['Android']},content:{blocks:[{type:'header',data:{text:'Overview'}},{type:'list',data:{items:['First item',{content:'Parent item',items:[{content:'Child item'}]}]}}]}}).map(([k,v])=>[k,value(v)]))};
const before=JSON.stringify(doc),realFetch=globalThis.fetch,requests=[];
globalThis.fetch=async (input,options)=>{const url=new URL(input);assert.equal(options.method,'GET','Adapter attempted a non-GET Firebase request');assert.equal(url.hostname,'firestore.googleapis.com');requests.push(url);return Response.json(url.pathname.endsWith('/one')?doc:url.searchParams.has('pageToken')?{documents:[]}:{documents:[doc],nextPageToken:'second-page'});};
const projects=await adapter.listPersonalProjects();assert.equal(projects.length,1);assert.equal(requests.length,2,'Pagination was not followed');assert.equal(projects[0].icon,'','Unsafe image URL accepted');assert.match(projects[0].description.blocks[1].data.text,/Child item/);
const project=await adapter.readPersonalProject('one');assert.equal(project.name,'Original title');assert.equal(JSON.stringify(doc),before,'Source document was mutated');
const withPlatforms=adapter.normalizePersonalProjectData('platforms',{project:{title:'Multi-platform',platforms:[' linux ','WEB','Android','android','iOS','Windows','macOS','Unknown',42]}});
assert.deepEqual(withPlatforms.platforms,['Android','Web','iOS','Windows','macOS','Linux']);
assert.equal(adapter.normalizePersonalProjectData('legacy',{project:{title:'Legacy'}}).platforms,undefined);
assert.deepEqual(adapter.normalizePersonalProjectData('empty',{project:{platforms:[]}}).platforms,[]);
const fallback={platforms:['Windows']};
assert.deepEqual(adapter.applyPersonalProject(fallback,withPlatforms).platforms,withPlatforms.platforms);
assert.deepEqual(adapter.applyPersonalProject(fallback,adapter.normalizePersonalProjectData('legacy',{})).platforms,['Windows']);
assert.deepEqual(adapter.applyPersonalProject(fallback,adapter.normalizePersonalProjectData('empty',{project:{platforms:[]}})).platforms,[]);
await assert.rejects(()=>adapter.readPersonalProject('../outside'),'Unsafe document ID accepted');
globalThis.fetch=async()=>new Response('{}',{status:403});await assert.rejects(()=>adapter.listPersonalProjects(),/not allowing access/);
globalThis.fetch=realFetch;
console.log('PASS: read-only Firebase adapter, pagination, actual schema mapping, nested Editor.js lists, URL filtering, invalid ID rejection, source immutability, and access errors.');

