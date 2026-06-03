import { writable } from 'svelte/store';

// Debug mode store - controls visibility of toasts and FPS counter
const DEBUG_STORAGE_KEY = 'av-debug-mode';

function getInitialDebugState(): boolean {
	if (typeof window === 'undefined') return false;
	const stored = localStorage.getItem(DEBUG_STORAGE_KEY);
	return stored ? JSON.parse(stored) : false;
}

function createDebugStore(): Writable<boolean> {
	const store = writable(getInitialDebugState());
	
	if (typeof window !== 'undefined') {
		store.subscribe(value => {
			localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(value));
		});
	}
	
	return store;
}

export const debugMode = createDebugStore();

// Helper functions
export function toggleDebugMode(): void {
	debugMode.update(v => !v);
}

export function enableDebugMode(): void {
	debugMode.set(true);
}

export function disableDebugMode(): void {
	debugMode.set(false);
}
