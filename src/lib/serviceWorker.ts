/**
 * Service Worker Client Utility
 * Manages service worker registration and communication
 */

let registration: ServiceWorkerRegistration | null = null;
let updatesSubscribed = false;
let messageListenerAttached = false;

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<void> {
	if (!('serviceWorker' in navigator)) {
		console.warn('Service Worker not supported');
		return;
	}

	try {
		// Only register on HTTPS or localhost
		if (
			window.location.protocol !== 'https:' &&
			window.location.hostname !== 'localhost' &&
			window.location.hostname !== '127.0.0.1'
		) {
			console.warn('Service Worker registration skipped (not HTTPS or localhost)');
			return;
		}

		// Attach the message listener once, regardless of which path we take.
		// Receiving messages does not require an active controller.
		attachMessageListener();

		// Check if already registered
		const existingRegistration = await navigator.serviceWorker.getRegistration();
		if (existingRegistration) {
			registration = existingRegistration;
			console.log('[Service Worker Client] Using existing registration');
			subscribeToUpdates(existingRegistration);
			return;
		}

		// Register new service worker
		registration = await navigator.serviceWorker.register('/service-worker.js', {
			scope: '/'
		});

		console.log('[Service Worker Client] Registered service worker');
		subscribeToUpdates(registration);
	} catch (error) {
		console.error('[Service Worker Client] Registration failed:', error);
	}
}

/**
 * Subscribe to service worker updates
 */
function subscribeToUpdates(reg: ServiceWorkerRegistration): void {
	if (updatesSubscribed) return;
	updatesSubscribed = true;

	reg.onupdatefound = () => {
		const newWorker = reg.installing;
		if (!newWorker) return;

		console.log('[Service Worker Client] Update found');

		newWorker.onstatechange = () => {
			if (newWorker.state === 'installed') {
				console.log('[Service Worker Client] New service worker installed');

				// Check for waiting state (user needs to refresh)
				if (navigator.serviceWorker.controller) {
					console.log('[Service Worker Client] New version available - refresh to update');
					// You could show a toast here: "New version available - refresh to update"
				}
			}

			if (newWorker.state === 'activated') {
				console.log('[Service Worker Client] New service worker activated');
			}
		};
	};
}

/**
 * Attach the message listener from the service worker.
 * Idempotent: only attaches once for the lifetime of the page.
 */
function attachMessageListener(): void {
	if (messageListenerAttached) return;
	if (!navigator.serviceWorker) return;
	messageListenerAttached = true;

	navigator.serviceWorker.addEventListener('message', (event) => {
		console.log('[Service Worker Client] Message from service worker:', event.data);

		if (event.data?.type === 'CACHE_STATS') {
			console.log('Cache stats:', event.data.data);
		}
	});
}

/**
 * Send a message to the service worker
 */
export function sendMessageToServiceWorker(type: string, data?: Record<string, unknown>): void {
	if (!navigator.serviceWorker || !navigator.serviceWorker.controller) {
		console.warn('[Service Worker Client] No active service worker');
		return;
	}

	try {
		navigator.serviceWorker.controller.postMessage({ type, ...data });
		console.log(`[Service Worker Client] Sent message: ${type}`);
	} catch (error) {
		console.error('[Service Worker Client] Failed to send message:', error);
	}
}

/**
 * Request to cache a specific media file
 */
export function cacheMediaFile(url: string): void {
	sendMessageToServiceWorker('CACHE_MEDIA', { url });
}

/**
 * Request to clear the media cache
 */
export function clearMediaCache(): void {
	sendMessageToServiceWorker('CLEAR_CACHE');
}

/**
 * Request to pre-cache all media from playlists
 */
export function precachePlaylists(): void {
	sendMessageToServiceWorker('PRECACHE_PLAYLISTS');
}

/**
 * Request cache statistics.
 * Rejects if there is no active controller, and times out so the
 * promise can never hang indefinitely.
 */
export function getCacheStats(timeoutMs = 5000): Promise<Record<string, unknown>> {
	return new Promise((resolve, reject) => {
		const controller = navigator.serviceWorker?.controller;
		if (!controller) {
			reject(new Error('[Service Worker Client] No active service worker'));
			return;
		}

		const messageChannel = new MessageChannel();

		const timer = setTimeout(() => {
			messageChannel.port1.onmessage = null;
			reject(new Error('[Service Worker Client] getCacheStats timed out'));
		}, timeoutMs);

		messageChannel.port1.onmessage = (event) => {
			if (event.data?.type === 'CACHE_STATS') {
				clearTimeout(timer);
				messageChannel.port1.onmessage = null;
				resolve(event.data.data);
			}
		};

		controller.postMessage({ type: 'GET_CACHE_STATS' }, [messageChannel.port2]);
	});
}

/**
 * Check if service worker is registered and active
 */
export function isServiceWorkerActive(): boolean {
	return !!(navigator.serviceWorker && navigator.serviceWorker.controller);
}

/**
 * Get the current service worker registration
 */
export async function getServiceWorkerRegistration(): Promise<
	ServiceWorkerRegistration | undefined
> {
	if (!navigator.serviceWorker) return;
	return await navigator.serviceWorker.getRegistration();
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<void> {
	const reg = await getServiceWorkerRegistration();
	if (reg) {
		await reg.unregister();
		registration = null;
		updatesSubscribed = false;
		console.log('[Service Worker Client] Service worker unregistered');
	}
}

/**
 * Initialize service worker on page load
 */
export function initServiceWorker(): void {
	// Register service worker after a small delay to avoid blocking page load
	setTimeout(() => {
		registerServiceWorker().catch((error) => {
			console.error('[Service Worker Client] Initialization failed:', error);
		});
	}, 1000);
}
