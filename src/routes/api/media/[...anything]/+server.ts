import { MEDIA_DIR } from '$env/static/private';
import fs from 'fs/promises';
import path from 'path';
import { lookup } from 'mime-types';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url }) => {
	const urlPath = url.pathname?.replace(/^\/api\/media\//, '');

	if (!urlPath) {
		return new Response('Missing media URL', { status: 400 });
	}

	// Decode the URL and compute the full file path.
	const decodedUrl = decodeURIComponent(urlPath);
	const filePath = path.join(MEDIA_DIR, decodedUrl);
	const resolvedFilePath = path.resolve(filePath);
	const resolvedMediaDir = path.resolve(MEDIA_DIR);

	// Prevent directory traversal by ensuring the resolved path starts with MEDIA_DIR.
	if (!resolvedFilePath.startsWith(resolvedMediaDir)) {
		return new Response('Access denied', { status: 403 });
	}

	try {
		// Read the file as a Buffer.
		const fileData = await fs.readFile(resolvedFilePath);
		// Determine the MIME type based on the file extension.
		const contentType = lookup(resolvedFilePath) || 'application/octet-stream';

		return new Response(fileData, {
			headers: {
				'Content-Type': contentType.toString(),
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (error) {
		console.error(error);
		return new Response('File not found', { status: 404 });
	}
};