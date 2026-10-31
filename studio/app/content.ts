import { z } from 'zod';
export const platforms = ['Android', 'Web', 'iOS', 'Windows', 'macOS', 'Linux'] as const;
export function normalizePlatforms(value:unknown):typeof platforms[number][] {
 if(!Array.isArray(value))return [];
 const selected=new Set(value.filter((entry):entry is string=>typeof entry==='string').map(entry=>entry.trim().toLowerCase()));
 return platforms.filter(platform=>selected.has(platform.toLowerCase()));
}
const safeUrl = z.string().max(2000).refine(s => !s || /^https?:\/\//i.test(s), 'Use an http or https URL');
export const platformNameSchema=z.string().trim().min(1,'Enter a platform name.').max(40,'Platform names can have up to 40 characters.').regex(/^\S(?:[^\r\n\t]*\S)?$/,'Use a single-line platform name.').refine(name=>name.toLowerCase()!=='all apps','Choose a different platform name.').transform(name=>platforms.find(platform=>platform.toLowerCase()===name.toLowerCase())??name);
export const companyPlatformsSchema=z.array(platformNameSchema).max(20,'Choose up to 20 platforms.').transform(values=>[...new Map(values.map(value=>[value.toLowerCase(),value])).values()]);
export function catalogPlatforms(apps:Pick<Application,'platforms'>[]):string[]{
 const used=new Map<string,string>();for(const app of apps)for(const value of app.platforms){const normalized=platformNameSchema.parse(value);if(!used.has(normalized.toLowerCase()))used.set(normalized.toLowerCase(),normalized);}
 return [...platforms.filter(value=>used.has(value.toLowerCase())),...[...used.values()].filter(value=>!platforms.some(standard=>standard===value)).sort((a,b)=>a.localeCompare(b))];
}
export const blocksSchema = z.object({blocks:z.array(z.object({id:z.string().optional(),type:z.enum(['paragraph','header']),data:z.object({text:z.string().max(20000),level:z.number().int().min(1).max(6).optional()})})).max(100)});
export const appSchema = z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),tagline:z.string().trim().min(1).max(250),category:z.string().trim().min(1).max(60),platforms:companyPlatformsSchema,url:safeUrl,icon:safeUrl,color:z.enum(['mint','peach','lavender','blue']),description:blocksSchema,personalProjectId:z.string().regex(/^[A-Za-z0-9_-]{1,150}$/).optional(),repositoryUrl:safeUrl.optional()});
export const contentSchema = z.object({company:z.object({headline:z.string().trim().min(1).max(150),intro:z.string().trim().min(1).max(500),email:z.union([z.literal(''),z.string().email()]),about:blocksSchema}),apps:z.array(appSchema).max(200)});
export type Content = z.infer<typeof contentSchema>;
export type Application = z.infer<typeof appSchema>;
export type Blocks = z.infer<typeof blocksSchema>;
export const linkedApplicationSchema=appSchema.pick({id:true,category:true,platforms:true,color:true,personalProjectId:true}).required({personalProjectId:true}).extend({platforms:z.array(z.enum(platforms)).max(6)});
export function storedApplication(app:Application){return app.personalProjectId?linkedApplicationSchema.parse(app):appSchema.parse(app);}
export function displayApplication(input:unknown):Application {
 const record=z.record(z.unknown()).parse(input);
 if(!record.personalProjectId)return appSchema.parse(record);
 const link=linkedApplicationSchema.parse(record);
 return {...link,name:'Personal project',tagline:'Details are loaded from the linked personal project.',url:'',icon:'',description:{blocks:[]}};
}
export function parseCatalogSeed(input:unknown):Content {
 const seed=contentSchema.omit({apps:true}).extend({apps:z.array(z.unknown()).max(200)}).parse(input);
 return {...seed,apps:seed.apps.map(displayApplication)};
}
export const initialContent:Content={company:{headline:'Ideas into apps.\nPossibilities into reality.',intro:'Welcome to ParadoXSoftware. Discover our applications for the devices you use every day.',email:'',about:{blocks:[{type:'paragraph',data:{text:'ParadoXSoftware develops applications across mobile, desktop, and the web. This is our home for sharing what we build.'}}]}},apps:[]};
