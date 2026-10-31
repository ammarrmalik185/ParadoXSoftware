process.env.DEPLOY_TARGET='firebase';
process.env.PAGES_BASE_PATH='/';
await import('./build-pages.mjs');
