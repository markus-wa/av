/**
 * A/V Show Service Worker
 * Caches media files and API responses for offline performance
 */

/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

// Cache names
const CACHE_NAME = `av-cache-${version}`;
const MEDIA_CACHE_NAME = `av-media-${version}`;
const PLAYLIST_CACHE_NAME = `av-playlists-${version}`;

// Media file extensions to cache
const MEDIA_EXTENSIONS = [
	'.mp4',
	'.webm',
	'.ogg',
	'.ogv',
	'.mov',
	'.avi',
	'.mpeg',
	'.mpg',
	'.gif',
	'.png',
	'.jpg',
	'.jpeg',
	'.webp',
	'.svg'
];

// API endpoints to cache
const API_ENDPOINTS = ['/api/playlists', '/api/media/'];

// Maximum cache size in bytes (500MB)
const MAX_CACHE_SIZE = 500 * 1024 * 1024;

// Maximum number of media files to cache
const MAX_MEDIA_FILES = 100;

// Type definitions for service worker events
declare global {
	interface ExtendableEvent extends Event {
		waitUntil(f: Promise<any>): void;
	}

	interface FetchEvent extends Event {
		request: Request;
		respondWith(r: Promise<Response> | Response): Promise<void>;
	}

	interface ExtendableMessageEvent extends Event {
		data: any;
		source: MessageEventSource | null;
		waitUntil(f: Promise<any>): void;
	}

	interface MessageEventSource {
		postMessage(message: any): void;
	}
}

/**
 * Check if a URL is a media file
 */
function isMediaFile(url: string): boolean {
	return MEDIA_EXTENSIONS.some((ext) => url.toLowerCase().endsWith(ext));
}

/**
 * Check if a URL is an API endpoint
 */
function isApiEndpoint(url: string): boolean {
	return API_ENDPOINTS.some((endpoint) => url.startsWith(endpoint));
}

/**
 * Get cache size in bytes
 */
async function getCacheSize(cacheName: string): Promise<number> {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();

	let size = 0;
	for (const request of keys) {
		const response = await cache.match(request);
		if (response) {
			const body = await response.clone().arrayBuffer();
			size += body.byteLength;
		}
	}
	return size;
}

/**
 * Clean up old caches
 */
async function cleanupOldCaches(): Promise<void> {
	const cacheKeys = await caches.keys();

	for (const key of cacheKeys) {
		if (key !== CACHE_NAME && key !== MEDIA_CACHE_NAME && key !== PLAYLIST_CACHE_NAME) {
			if (key.startsWith('av-')) {
				console.log(`Deleting old cache: ${key}`);
				await caches.delete(key);
			}
		}
	}
}

/**
 * Clean up cache if it exceeds maximum size
 */
async function cleanupCacheIfNeeded(cacheName: string): Promise<void> {
	try {
		const size = await getCacheSize(cacheName);

		if (size < MAX_CACHE_SIZE) return;

		console.log(`Cache ${cacheName} exceeds max size (${MAX_CACHE_SIZE} bytes), cleaning up...`);

		const cache = await caches.open(cacheName);
		const keys = await cache.keys();

		// Delete oldest entries (simple FIFO approach)
		const deleteCount = Math.max(1, Math.floor(keys.length * 0.2));
		for (let i = 0; i < deleteCount && i < keys.length; i++) {
			const key = keys[i];
			console.log(`Deleting cached entry: ${key.url}`);
			await cache.delete(key);
		}
	} catch (error) {
		console.error(`Error cleaning up cache ${cacheName}:`, error);
	}
}

/**
 * Cache media files from playlists
 */
async function precacheMediaFromPlaylists(): Promise<void> {
	try {
		const cache = await caches.open(MEDIA_CACHE_NAME);

		// Fetch playlists
		const response = await fetch('/api/playlists');
		if (!response.ok) {
			console.warn('Failed to fetch playlists for precaching');
			return;
		}

		const playlists = await response.json();

		// Extract all media URLs
		const mediaUrls: string[] = [];
		for (const playlist of playlists) {
			if (playlist.entries) {
				for (const entry of playlist.entries) {
					if (entry.url && isMediaFile(entry.url)) {
						mediaUrls.push(entry.url);
					}
				}
			}
			if (playlist.pausedMedia?.url && isMediaFile(playlist.pausedMedia.url)) {
				mediaUrls.push(playlist.pausedMedia.url);
			}
		}

		// Pre-cache media files
		const existingKeys = await cache.keys();
		const existingUrls = new Set(existingKeys.map((k) => k.url));

		let cachedCount = 0;
		for (const url of mediaUrls) {
			// Check if already cached
			if (existingUrls.has(url)) {
				continue;
			}

			try {
				// Only cache if it's a same-origin request
				const fullUrl = new URL(url, self.location.origin).href;

				// Try HEAD request first to check if file exists
				const headResponse = await fetch(fullUrl, {
					method: 'HEAD',
					cache: 'no-store'
				});

				if (headResponse.ok) {
					// Use cache API to store
					const cacheResponse = await fetch(fullUrl);
					if (cacheResponse.ok) {
						await cache.put(fullUrl, cacheResponse.clone());
						cachedCount++;
						console.log(`Pre-cached media: ${url}`);
					}
				}
			} catch (error) {
				console.warn(`Failed to pre-cache: ${url}`, error);
			}

			// Check cache size limit
			if (cachedCount >= MAX_MEDIA_FILES) break;
		}

		console.log(`Pre-cached ${cachedCount} media files`);

		// Clean up if needed
		await cleanupCacheIfNeeded(MEDIA_CACHE_NAME);
	} catch (error) {
		console.error('Failed to pre-cache media from playlists:', error);
	}
}

/**
 * Install event - pre-cache assets
 */
self.addEventListener('install', (event: ExtendableEvent) => {
	console.log('[Service Worker] Installing');

	event.waitUntil(
		Promise.all([
			// Pre-cache build assets
			caches.open(CACHE_NAME).then((cache) => {
				console.log('[Service Worker] Caching build files');
				return cache.addAll(build.map((file) => `/${file}`));
			}),
			// Pre-cache media from playlists
			precacheMediaFromPlaylists(),
			// Skip waiting to activate immediately
			self.skipWaiting()
		]).catch((error) => {
			console.error('[Service Worker] Install failed:', error);
		})
	);
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event: ExtendableEvent) => {
	console.log('[Service Worker] Activating');

	event.waitUntil(
		Promise.all([cleanupOldCaches(), clients.claim()]).catch((error) => {
			console.error('[Service Worker] Activation failed:', error);
		})
	);
});

/**
 * Fetch event - handle caching strategies
 */
self.addEventListener('fetch', (event: FetchEvent) => {
	try {
		const url = new URL(event.request.url);
		const path = url.pathname;

		// Skip non-GET requests
		if (event.request.method !== 'GET') {
			return;
		}

		// Strategy 1: API endpoints - Network First with Cache Fallback
		if (isApiEndpoint(path)) {
			event.respondWith(
				fetch(event.request)
					.then((response) => {
						// Clone and cache successful responses
						if (response.ok) {
							const responseClone = response.clone();
							caches.open(PLAYLIST_CACHE_NAME).then((cache) => {
								cache
									.put(event.request, responseClone)
									.catch((e) => console.error('Cache put failed:', e));
							});
						}
						return response;
					})
					.catch(() => {
						// Fallback to cache
						return caches.match(event.request).then((response) => {
							return (
								response ||
								new Response('Offline - API unavailable', {
									status: 503,
									statusText: 'Service Unavailable'
								})
							);
						});
					})
			);
			return;
		}

		// Strategy 2: Media files - Cache First
		if (isMediaFile(path)) {
			event.respondWith(
				caches.open(MEDIA_CACHE_NAME).then((cache) => {
					return cache.match(event.request).then((cachedResponse) => {
						// Return cached response if available
						if (cachedResponse) {
							console.log(`[Service Worker] Serving ${path} from cache`);
							return cachedResponse;
						}

						// Otherwise fetch from network
						return fetch(event.request).then((response) => {
							// Cache the response
							if (response.ok) {
								console.log(`[Service Worker] Caching ${path} from network`);
								const responseClone = response.clone();
								cache
									.put(event.request, responseClone)
									.catch((e) => console.error('Cache put failed:', e));

								// Clean up if cache is getting large
								cleanupCacheIfNeeded(MEDIA_CACHE_NAME);
							}
							return response;
						});
					});
				})
			);
			return;
		}

		// Strategy 3: Build assets - Cache First
		if (path.startsWith('/') && build.some((b) => path.includes(b))) {
			event.respondWith(
				caches
					.open(CACHE_NAME)
					.then((cache) => cache.match(event.request))
					.then((response) => response || fetch(event.request))
			);
			return;
		}

		// Default: Network only
	} catch (error) {
		console.error('[Service Worker] Fetch handler error:', error);
	}
});

/**
 * Message event - handle messages from clients
 */
self.addEventListener('message', (event: ExtendableMessageEvent) => {
	try {
		if (event.data && event.data.type === 'CACHE_MEDIA') {
			console.log('[Service Worker] Received cache media request:', event.data.url);
			event.waitUntil(cacheMediaFile(event.data.url));
		}

		if (event.data && event.data.type === 'CLEAR_CACHE') {
			console.log('[Service Worker] Received clear cache request');
			event.waitUntil(
				Promise.all([caches.delete(MEDIA_CACHE_NAME), caches.delete(PLAYLIST_CACHE_NAME)])
					.then(() => {
						// Recreate caches
						return Promise.all([caches.open(MEDIA_CACHE_NAME), caches.open(PLAYLIST_CACHE_NAME)]);
					})
					.catch((error) => {
						console.error('[Service Worker] Cache clear failed:', error);
					})
			);
		}

		if (event.data && event.data.type === 'PRECACHE_PLAYLISTS') {
			event.waitUntil(
				precacheMediaFromPlaylists().catch((error) => {
					console.error('[Service Worker] Precache playlists failed:', error);
				})
			);
		}

		if (event.data && event.data.type === 'GET_CACHE_STATS') {
			Promise.all([
				getCacheSize(MEDIA_CACHE_NAME),
				getCacheSize(PLAYLIST_CACHE_NAME),
				caches.keys()
			]).then(([mediaSize, playlistSize, cacheNames]) => {
				event.source?.postMessage({
					type: 'CACHE_STATS',
					data: {
						mediaSize,
						playlistSize,
						cacheNames,
						mediaCacheName: MEDIA_CACHE_NAME,
						playlistCacheName: PLAYLIST_CACHE_NAME
					}
				});
			});
		}
	} catch (error) {
		console.error('[Service Worker] Message handler error:', error);
	}
});

/**
 * Cache a specific media file
 */
async function cacheMediaFile(url: string): Promise<void> {
	try {
		const cache = await caches.open(MEDIA_CACHE_NAME);
		const fullUrl = new URL(url, self.location.origin).href;

		// Check if already cached
		const existing = await cache.match(fullUrl);
		if (existing) {
			console.log(`[Service Worker] Already cached: ${url}`);
			return;
		}

		// Fetch and cache
		const response = await fetch(fullUrl);
		if (response.ok) {
			console.log(`[Service Worker] Caching: ${url}`);
			await cache.put(fullUrl, response.clone());
			await cleanupCacheIfNeeded(MEDIA_CACHE_NAME);
		}
	} catch (error) {
		console.error(`[Service Worker] Failed to cache ${url}:`, error);
	}
}

/**
 * Periodic cache cleanup (every hour)
 */
setInterval(
	() => {
		cleanupCacheIfNeeded(MEDIA_CACHE_NAME).catch(() => {});
		cleanupCacheIfNeeded(PLAYLIST_CACHE_NAME).catch(() => {});
	},
	60 * 60 * 1000
);

console.log('[Service Worker] A/V Service Worker loaded, version:', version);
