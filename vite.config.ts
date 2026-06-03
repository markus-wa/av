import { defineConfig } from 'vite';
import fs from 'fs';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		{
			name: 'service-worker-dev',
			configureServer(server) {
				server.middlewares.use('/service-worker.js', (req, res) => {
					const swCode = `
self.addEventListener('install', e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
console.log('[Service Worker] Dev mode');
`;
					res.setHeader('Content-Type', 'application/javascript');
					res.end(swCode);
				});
			}
		}
	],
	server: {
		open: true,
		https: {
			key: fs.readFileSync('localhost+1-key.pem'),
			cert: fs.readFileSync('localhost+1.pem')
		},
		port: 8443,
		strictPort: true,
		hmr: {
			protocol: 'wss',
		}
	}
});
