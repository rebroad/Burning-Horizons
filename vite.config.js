import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOutputSurfaceTransform } from './tools/output-surface-transform.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig( {
	// Relative assets support publication under any application sub-path.
	base: './',
	plugins: [
		{
			name: 'missing-local-config',
			configureServer(server) {
				server.middlewares.use((req, res, next) => {
					const url = new URL(req.url, 'http://localhost');
					if (url.pathname === '/runtime-config') {
						res.statusCode = 404;
						res.end();
						return;
					}
					const bundles = [
						['9e45eda57c26c7ac1622504b0093be6291e5115bd5e77d3baf299d54e3df3809', '/worlds/elsemesh-world-loz-opening-island/'],
						['f231b6e2e49f3dfebd19f7217895d00479bac27bf73e2eeb3295f244e8dec547', '/worlds/elsemesh-world-loz-opening-island/worlds/table-tennis-room/']
					];
					for (const [digest, source] of bundles) {
						const bundle = `/worlds/${digest}/`;
						if (url.pathname.startsWith(bundle)) {
							req.url = source + url.pathname.slice(bundle.length) + url.search;
							break;
						}
					}
					next();
				});
			}
		},
		createOutputSurfaceTransform({root})
	],
	resolve: { dedupe: ['three'], alias: [ { find: 'three/addons/postprocessing/Pass.js', replacement: resolve(root,'node_modules/three/examples/jsm/postprocessing/Pass.js') }, { find: /^three$/, replacement: resolve(root,'src/world-runtime/SplatThree.js') } ] },
	// Dev must use the same transformed contract/Three instance as production.
	optimizeDeps: { exclude: ['@sparkjsdev/spark','three'] },
	build: { target: 'esnext', chunkSizeWarningLimit: 4000, rollupOptions: { input: { main: resolve(root,'index.html'), worlds: resolve(root,'worlds.html') } } },
	server: { port: 5188, strictPort: true, host: '127.0.0.1' },
} );
