// +server.ts
import { MEDIA_DIR } from '$env/static/private';
import fs from 'fs/promises';
import path from 'path';
import type { RequestHandler } from './$types';

/**
 * Recursively gathers all file paths (ignoring directories) inside a given directory.
 * @param dir The directory to scan.
 * @returns An array of full file paths.
 */
async function getFilesRecursive(dir: string): Promise<string[]> {
	const results: string[] = [];
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			// Recursively gather files from sub-directories.
			const subEntries = await getFilesRecursive(fullPath);
			results.push(...subEntries);
		} else if (entry.isFile()) {
			results.push(fullPath);
		}
	}
	return results;
}

export const GET: RequestHandler = async () => {
	// This will hold the final list of playlists.
	const playlists: { name: string; entries: { url: string }[] }[] = [];

	// Read the top-level directories under MEDIA_DIR.
	const items = await fs.readdir(MEDIA_DIR, { withFileTypes: true });
	for (const item of items) {
		if (item.isDirectory() && !item.name.startsWith('.')) {
			const playlistName = item.name;
			// The full path to the playlist folder.
			const playlistPath = path.join(MEDIA_DIR, playlistName);
			// Get all file entries (including files in sub-folders).
			const files = await getFilesRecursive(playlistPath);

			// For each file, compute a URL.
			// We remove the playlist folder from the file’s relative path and then
			// prepend MEDIA_DIR. For example, a file at:
			//    MEDIA_DIR/BCE/bce-tunnel.mp4
			// will become:
			//    /videos/bce-tunnel.mp4
			const entries = files.map((filePath) => {
				const url = "/api/media/"+encodeURI(path.relative(MEDIA_DIR, filePath));

				return { url };
			});

			playlists.push({ name: playlistName, entries });
		}
	}

	return new Response(JSON.stringify(playlists), {
		headers: { 'Content-Type': 'application/json' }
	});
};
