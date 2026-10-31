import React from 'react';
import { createRoot } from 'react-dom/client';
import Studio from '../app/Studio';
import { parseCatalogSeed } from '../app/content';
import content from '../content/site.json';
import '../app/globals.css';

const base = import.meta.env.BASE_URL;
createRoot(document.getElementById('root')!).render(<Studio fallbackContent={parseCatalogSeed(content)} assetBase={base}/>);
