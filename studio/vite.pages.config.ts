import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const directory = (path:string) => fileURLToPath(new URL(path, import.meta.url));
const base = process.env.PAGES_BASE_PATH || '/ParadoXSoftware/';
if (!base.startsWith('/') || !base.endsWith('/')) throw Error('PAGES_BASE_PATH must start and end with /.');
export default defineConfig({
  root: directory('./github-pages/'),
  base,
  publicDir: directory('./public/'),
  plugins: [react()],
  build: { outDir: directory(process.env.DEPLOY_TARGET==='firebase'?'./dist-firebase/':'./dist-pages/'), emptyOutDir: true },
});
