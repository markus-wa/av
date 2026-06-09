/**
 * A/V Show Service Worker
 * Caches media files and API responses for offline performance
 *
 * Improvements:
 * - Memory-safe cache size tracking using content-length headers
 * - LRU eviction based on access timestamps
 * - TTL-based cache expiration
 * - Efficient pre-caching with concurrency limits
 * - Better error handling
 */

/// <reference lib="webworker" />

import { build, version } from '$service-worker';

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

// TTL in milliseconds
const MEDIA_TTL = 24 * 60 * 60 * 1000; // 24 hours
const API_TTL = 60 * 60 * 1000; // 1 hour

// Maximum concurrent requests for pre-caching
const MAX_CONCURRENT_REQUESTS = 6;

// Type definitions for service worker events
declare global {
	interface ExtendableEvent extends Event {
		waitUntil(f: Promise<unknown>): void;
	}

	interface FetchEvent extends Event {
		readonly request: Request;
		respondWith(r: Promise<Response> | Response): Promise<void>;
	}

	interface ExtendableMessageEvent extends Event {
		readonly data: any;
		readonly source: Client | ServiceWorker | MessagePort | null;
		waitUntil(f: Promise<unknown>): void;
	}
}

// In-memory cache for tracking access timestamps (URL -> timestamp)
const accessTimestamps = new Map<string, number>();

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
 * Estimate response size from headers without loading body into memory
 */
function getResponseSize(response: Response): number {
	const contentLength = response.headers.get('content-length');
	if (contentLength) {
		return parseInt(contentLength, 10);
	}
	// Fallback: estimate based on content type
	const contentType = response.headers.get('content-type') || '';
	if (contentType.includes('json')) {
		return 1024;
	}
	if (contentType.includes('text')) {
		return 4096;
	}
	return 1024 * 1024;
}

/**
 * Get approximate cache size by summing content-length headers
 */
async function getApproximateCacheSize(cacheName: string): Promise<number> {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();

	let size = 0;
	for (const request of keys) {
		const response = await cache.match(request);
		if (response) {
			size += getResponseSize(response);
		}
	}
	return size;
}

/**
 * Check if a cached entry has expired based on TTL
 */
async function isEntryExpired(cacheName: string, request: Request): Promise<boolean> {
	const cache = await caches.open(cacheName);
	const response = await cache.match(request);
	if (!response) return false;

	const url = request.url;
	const ttl = isMediaFile(url) ? MEDIA_TTL : API_TTL;
	const cachedTime = accessTimestamps.get(url) || 0;

	return Date.now() - cachedTime > ttl;
}

/**
 * Get cache entries sorted by access time (oldest first for LRU eviction)
 */
async function getEntriesSortedByAccess(
	cacheName: string
): Promise<Array<{ request: Request; timestamp: number }>> {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();

	return keys
		.map((request) => ({
			request,
			timestamp: accessTimestamps.get(request.url) || 0
		}))
		.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Update access timestamp for a URL
 */
function updateAccessTimestamp(url: string): void {
	accessTimestamps.set(url, Date.now());
}

/**
 * Clean up old caches (versioned)
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
 * Clean up expired entries based on TTL
 */
async function cleanupExpiredEntries(cacheName: string): Promise<number> {
	const cache = await caches.open(cacheName);
	const keys = await cache.keys();

	let deletedCount = 0;
	for (const request of keys) {
		if (await isEntryExpired(cacheName, request)) {
			console.log(`Deleting expired entry: ${request.url}`);
			await cache.delete(request);
			accessTimestamps.delete(request.url);
			deletedCount++;
		}
	}
	return deletedCount;
}

/**
 * Clean up cache if it exceeds maximum size using LRU eviction
 */
async function cleanupCacheIfNeeded(cacheName: string): Promise<void> {
	try {
		// First, clean up expired entries
		const expiredDeleted = await cleanupExpiredEntries(cacheName);
		if (expiredDeleted > 0) {
			console.log(`Deleted ${expiredDeleted} expired entries from ${cacheName}`);
		}

		const size = await getApproximateCacheSize(cacheName);

		if (size < MAX_CACHE_SIZE) return;

		console.log(`Cache ${cacheName} exceeds max size (${MAX_CACHE_SIZE} bytes), cleaning up...`);

		const cache = await caches.open(cacheName);
		const entries = await getEntriesSortedByAccess(cacheName);

		// For media cache, also enforce file count limit
		const maxFiles = cacheName === MEDIA_CACHE_NAME ? MAX_MEDIA_FILES : Number.POSITIVE_INFINITY;

		let filesToDelete = Math.max(1, Math.floor(entries.length * 0.2));

		if (entries.length > maxFiles) {
			filesToDelete = Math.max(filesToDelete, entries.length - maxFiles);
		}

		// Delete oldest entries first (LRU)
		for (let i = 0; i < filesToDelete && i < entries.length; i++) {
			const entry = entries[i];
			console.log(`Deleting cached entry (LRU): ${entry.request.url}`);
			await cache.delete(entry.request);
			accessTimestamps.delete(entry.request.url);
		}
	} catch (error) {
		console.error(`Error cleaning up cache ${cacheName}:`, error);
	}
}

/**
 * Simple semaphore for concurrency control
 */
function createSemaphore(maxConcurrent: number) {
	let current = 0;
	const waiting: Array<() => void> = [];

	return {
		acquire: () => {
			return new Promise<void>((resolve) => {
				if (current < maxConcurrent) {
					current++;
					resolve();
				} else {
					waiting.push(resolve);
				}
			});
		},
		release: () => {
			current--;
			if (waiting.length > 0) {
				const next = waiting.shift()!;
				current++;
				next();
			}
		}
	};
}

/**
 * Cache media files from playlists with concurrency control
 */
async function precacheMediaFromPlaylists(): Promise<void> {
	try {
		const cache = await caches.open(MEDIA_CACHE_NAME);

		const response = await fetch('/api/playlists');
		if (!response.ok) {
			console.warn('Failed to fetch playlists for precaching');
			return;
		}

		const playlists = await response.json();

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

		const semaphore = createSemaphore(MAX_CONCURRENT_REQUESTS);

		const existingKeys = await cache.keys();
		const existingUrls = new Set(existingKeys.map((k) => k.url));

		let cachedCount = 0;
		const errors: string[] = [];

		for (const url of mediaUrls) {
			if (existingUrls.has(url)) {
				continue;
			}

			try {
				const fullUrl = new URL(url, self.location.origin).href;

				await semaphore.acquire();

				const stillExists = await cache.match(fullUrl);
				if (stillExists) {
					semaphore.release();
					continue;
				}

				const cacheResponse = await fetch(fullUrl, { cache: 'no-store' });

				if (cacheResponse.ok) {
					const currentSize = await getApproximateCacheSize(MEDIA_CACHE_NAME);
					const entrySize = getResponseSize(cacheResponse);

					if (currentSize + entrySize <= MAX_CACHE_SIZE) {
						await cache.put(fullUrl, cacheResponse.clone());
						updateAccessTimestamp(fullUrl);
						cachedCount++;
						console.log(`Pre-cached media: ${url}`);
					} else {
						console.warn(`Skipping cache for ${url} - would exceed size limit`);
					}
				} else {
					console.warn(`Failed to fetch for caching: ${url} (${cacheResponse.status})`);
				}
			} catch (error) {
				errors.push(url);
				console.warn(`Failed to pre-cache: ${url}`, error);
			} finally {
				semaphore.release();
			}

			if (cachedCount >= MAX_MEDIA_FILES) break;
		}

		cleanupCacheIfNeeded(MEDIA_CACHE_NAME).catch(() => {});

		if (errors.length > 0) {
			console.warn(`Pre-caching completed with ${errors.length} errors`);
		}
		console.log(`Pre-cached ${cachedCount} media files`);
	} catch (error) {
		console.error('Failed to pre-cache media from playlists:', error);
	}
}

/**
 * Cache a specific media file
 */
async function cacheMediaFile(url: string): Promise<void> {
	try {
		const cache = await caches.open(MEDIA_CACHE_NAME);
		const fullUrl = new URL(url, self.location.origin).href;

		const existing = await cache.match(fullUrl);
		if (existing && !(await isEntryExpired(MEDIA_CACHE_NAME, new Request(fullUrl)))) {
			console.log(`[Service Worker] Already cached and valid: ${url}`);
			updateAccessTimestamp(fullUrl);
			return;
		}

		const currentSize = await getApproximateCacheSize(MEDIA_CACHE_NAME);

		const response = await fetch(fullUrl, { cache: 'no-store' });
		if (response.ok) {
			const entrySize = getResponseSize(response);
			if (currentSize + entrySize <= MAX_CACHE_SIZE) {
				console.log(`[Service Worker] Caching: ${url}`);
				await cache.put(fullUrl, response.clone());
				updateAccessTimestamp(fullUrl);
				await cleanupCacheIfNeeded(MEDIA_CACHE_NAME);
			} else {
				console.warn(`[Service Worker] Skipping cache for ${url} - would exceed size limit`);
			}
		}
	} catch (error) {
		console.error(`[Service Worker] Failed to cache ${url}:`, error);
	}
}

/**
 * Install event - pre-cache assets
 */
self.addEventListener('install', (event: ExtendableEvent) => {
	console.log('[Service Worker] Installing');

	event.waitUntil(
		Promise.all([
			caches.open(CACHE_NAME).then((cache) => {
				console.log('[Service Worker] Caching build files');
				return cache.addAll(build.map((file) => `/${file}`)).catch((e) => {
					console.error('[Service Worker] Build cache failed:', e);
				});
			}),
			precacheMediaFromPlaylists().catch((error) => {
				console.error('[Service Worker] Precache failed (non-blocking):', error);
			}),
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

		if (event.request.method !== 'GET') {
			return;
		}

		// Strategy 1: API endpoints - Network First with Cache Fallback
		if (isApiEndpoint(path)) {
			event.respondWith(
				fetch(event.request)
					.then(async (response) => {
						if (response.ok) {
							const responseClone = response.clone();
							const cache = await caches.open(PLAYLIST_CACHE_NAME);
							try {
								const currentSize = await getApproximateCacheSize(PLAYLIST_CACHE_NAME);
								const entrySize = getResponseSize(responseClone);
								if (currentSize + entrySize <= MAX_CACHE_SIZE) {
									await cache.put(event.request, responseClone);
									updateAccessTimestamp(event.request.url);
									console.log(`[Service Worker] Cached API response: ${path}`);
								}
							} catch (e) {
								console.error('[Service Worker] API cache put failed:', e);
							}
						}
						return response;
					})
					.catch(async () => {
						const cache = await caches.open(PLAYLIST_CACHE_NAME);
						const cachedResponse = await cache.match(event.request);

						if (cachedResponse) {
							updateAccessTimestamp(event.request.url);
							return cachedResponse;
						}

						return new Response('Offline - API unavailable', {
							status: 503,
							statusText: 'Service Unavailable'
						});
					})
			);
			return;
		}

		// Strategy 2: Media files - Cache First
		if (isMediaFile(path)) {
			event.respondWith(
				caches.open(MEDIA_CACHE_NAME).then((cache) => {
					return cache.match(event.request).then(async (cachedResponse) => {
						if (cachedResponse && !(await isEntryExpired(MEDIA_CACHE_NAME, event.request))) {
							updateAccessTimestamp(event.request.url);
							console.log(`[Service Worker] Serving ${path} from cache`);
							return cachedResponse;
						}

						return fetch(event.request).then(async (response) => {
							if (response.ok) {
								console.log(`[Service Worker] Caching ${path} from network`);
								const responseClone = response.clone();

								const currentSize = await getApproximateCacheSize(MEDIA_CACHE_NAME);
								const entrySize = getResponseSize(responseClone);

								if (currentSize + entrySize <= MAX_CACHE_SIZE) {
									try {
										await cache.put(event.request, responseClone);
										updateAccessTimestamp(event.request.url);
									} catch (e) {
										console.error('[Service Worker] Media cache put failed:', e);
									}
									cleanupCacheIfNeeded(MEDIA_CACHE_NAME).catch(() => {});
								} else {
									console.warn(
										`[Service Worker] Skipping cache for ${path} - would exceed size limit`
									);
								}
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
						accessTimestamps.clear();
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
				getApproximateCacheSize(MEDIA_CACHE_NAME),
				getApproximateCacheSize(PLAYLIST_CACHE_NAME),
				caches.keys()
			]).then(([mediaSize, playlistSize, cacheNames]) => {
				event.source?.postMessage({
					type: 'CACHE_STATS',
					data: {
						mediaSize,
						playlistSize,
						cacheNames,
						mediaCacheName: MEDIA_CACHE_NAME,
						playlistCacheName: PLAYLIST_CACHE_NAME,
						mediaFileCount: MAX_MEDIA_FILES,
						maxCacheSize: MAX_CACHE_SIZE
					}
				});
			});
		}
	} catch (error) {
		console.error('[Service Worker] Message handler error:', error);
	}
});

/**
 * Periodic cache cleanup (every hour)
 */
setInterval(
	() => {
		cleanupExpiredEntries(MEDIA_CACHE_NAME).catch(() => {});
		cleanupExpiredEntries(PLAYLIST_CACHE_NAME).catch(() => {});
		cleanupCacheIfNeeded(MEDIA_CACHE_NAME).catch(() => {});
		cleanupCacheIfNeeded(PLAYLIST_CACHE_NAME).catch(() => {});
	},
	60 * 60 * 1000
);

console.log('[Service Worker] A/V Service Worker loaded, version:', version);
