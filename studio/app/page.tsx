import Studio from './Studio';
import { parseCatalogSeed } from './content';
import snapshot from '../content/site.json';
const fallback=parseCatalogSeed(snapshot);
export default function Page(){return <Studio fallbackContent={fallback}/>;}
