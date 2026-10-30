import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOutputSurfaceTransform } from './tools/output-surface-transform.mjs';

const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig( {
	// Relative assets support publication under any application sub-path.
	base: './',
	plugins: [{
        name: 'missing-local-config',
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                if ([
                    '/runtime-config',
                    '/published-worlds.json',
                    '/opening-world.json',
                ].includes(req.url)) {
                    res.statusCode = 404;
                    res.end();
                    return;
                }
                next();
            });
        },
    }, createOutputSurfaceTransform({root})],
	resolve: { dedupe: ['three'], alias: [ { find: 'three/addons/postprocessing/Pass.js', replacement: resolve(root,'node_modules/three/examples/jsm/postprocessing/Pass.js') }, { find: /^three$/, replacement: resolve(root,'src/world-runtime/SplatThree.js') } ] },
	// Dev must use the same transformed contract/Three instance as production.
	optimizeDeps: { exclude: ['@sparkjsdev/spark','three'] },
	build: { target: 'esnext', chunkSizeWarningLimit: 4000, rollupOptions: { input: { main: resolve(root,'index.html'), worlds: resolve(root,'worlds.html') } } },
	server: { port: 5188, strictPort: true, host: '127.0.0.1' },
} );
