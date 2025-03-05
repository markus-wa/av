import { defineConfig } from 'vite';
import fs from 'fs';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
	],
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
