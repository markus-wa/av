import { defineConfig } from 'vite';
import fs from 'fs';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
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
