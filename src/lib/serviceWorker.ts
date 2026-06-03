/**
 * Service Worker Client Utility
 * Manages service worker registration and communication
 */

let serviceWorker: ServiceWorker | null = null;
let registration: ServiceWorkerRegistration | null = null;
let isSubscribed = false;

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
		if (window.location.protocol !== 'https:' && 
			window.location.hostname !== 'localhost' && 
			window.location.hostname !== '127.0.0.1') {
			console.warn('Service Worker registration skipped (not HTTPS or localhost)');
			return;
		}

		// Check if already registered
		const existingRegistration = await navigator.serviceWorker.getRegistration();
		if (existingRegistration) {
			registration = existingRegistration;
			serviceWorker = existingRegistration.active || existingRegistration.waiting || existingRegistration.installing;
			console.log('[Service Worker Client] Using existing registration');
			
			// Subscribe to updates
			subscribeToUpdates(existingRegistration);
			return;
		}

		// Register new service worker
		registration = await navigator.serviceWorker.register('/service-worker.js', {
			scope: '/',
			type: 'module'
		});

		console.log('[Service Worker Client] Registered service worker');
		
		// Subscribe to updates
		subscribeToUpdates(registration);
		
		// Set up message channel
		setupMessageChannel();
		
	} catch (error) {
		console.error('[Service Worker Client] Registration failed:', error);
	}
}

/**
 * Subscribe to service worker updates
 */
function subscribeToUpdates(reg: ServiceWorkerRegistration): void {
	if (isSubscribed) return;
	isSubscribed = true;

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
				serviceWorker = newWorker;
				// Reload page to use new service worker
				// window.location.reload();
			}
		};
	};
}

/**
 * Set up message channel with service worker
 */
function setupMessageChannel(): void {
	if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;

	const messageChannel = new MessageChannel();
	
	messageChannel.port1.onmessage = (event) => {
		console.log('[Service Worker Client] Message from service worker:', event.data);
		
		if (event.data.type === 'CACHE_STATS') {
			console.log('Cache stats:', event.data.data);
		}
	};
	
	// Listen for messages from service worker
	navigator.serviceWorker.addEventListener('message', (event) => {
		console.log('[Service Worker Client] Direct message from service worker:', event.data);
		
		if (event.data.type === 'CACHE_STATS') {
			console.log('Cache stats:', event.data.data);
		}
	});
}

/**
 * Send a message to the service worker
 */
export function sendMessageToServiceWorker(type: string, data?: any): void {
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
 * Request cache statistics
 */
export function getCacheStats(): Promise<any> {
	return new Promise((resolve) => {
		const messageChannel = new MessageChannel();
		
		messageChannel.port1.onmessage = (event) => {
			if (event.data.type === 'CACHE_STATS') {
				resolve(event.data.data);
			}
		};
		
		navigator.serviceWorker.controller?.postMessage(
			{ type: 'GET_CACHE_STATS' },
			[messageChannel.port2]
		);
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
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
	if (!navigator.serviceWorker) return null;
	return await navigator.serviceWorker.getRegistration();
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<void> {
	const registration = await getServiceWorkerRegistration();
	if (registration) {
		await registration.unregister();
		console.log('[Service Worker Client] Service worker unregistered');
	}
}

/**
 * Initialize service worker on page load
 */
export function initServiceWorker(): void {
	// Register service worker after a small delay to avoid blocking page load
	setTimeout(() => {
		registerServiceWorker().catch(error => {
			console.error('[Service Worker Client] Initialization failed:', error);
		});
	}, 1000);
}
