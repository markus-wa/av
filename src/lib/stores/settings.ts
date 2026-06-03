import { writable } from 'svelte/store';

interface AVSettings {
	// Video settings
	video: {
		mode: number;
		loopVideos: boolean;
		shuffle: boolean;
		cutVideo: boolean;
		nextMediaIntervalSec: number;
		deviceIndex: number;
		mediaIndex: number;
		playlistIndex: number;
	};
	// MIDI settings
	midi: {
		stepSize: number;
		selectedMidiIndex: number;
		cc0: number;
		cc1: number;
		cc2: number;
		cc3: number;
	};
	// Shader settings
	shader: {
		shaderIndex: number;
		paused: boolean;
	};
	// Matrix settings
	matrix: {
		pathIndex: number;
		isManual: boolean;
	};
}

const DEFAULT_SETTINGS: AVSettings = {
	video: {
		mode: 2,
		loopVideos: false,
		shuffle: true,
		cutVideo: false,
		nextMediaIntervalSec: 5,
		deviceIndex: 0,
		mediaIndex: 0,
		playlistIndex: 0
	},
	midi: {
		stepSize: 8,
		selectedMidiIndex: 0,
		cc0: 63,
		cc1: 63,
		cc2: 63,
		cc3: 63
	},
	shader: {
		shaderIndex: 0,
		paused: false
	},
	matrix: {
		pathIndex: 0,
		isManual: false
	}
};

const STORAGE_KEY = 'av-settings';

function getStoredSettings(): AVSettings {
	if (typeof window === 'undefined') return DEFAULT_SETTINGS;
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
		}
	} catch (error) {
		console.error('Error reading settings from localStorage:', error);
	}
	return DEFAULT_SETTINGS;
}

function createPersistentStore<T>(key: string, startValue: T): Writable<T> {
	const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
	const store = writable(stored ? JSON.parse(stored) : startValue);
	
	if (typeof window !== 'undefined') {
		store.subscribe(value => {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch (error) {
				console.error('Error saving to localStorage:', error);
			}
		});
	}
	
	return store;
}

// Main settings store
export const settings = writable<AVSettings>(getStoredSettings());

if (typeof window !== 'undefined') {
	settings.subscribe(value => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
		} catch (error) {
			console.error('Error saving settings to localStorage:', error);
		}
	});
}

// Helper functions to update settings
export function updateVideoSettings(updates: Partial<AVSettings['video']>) {
	settings.update(s => ({
		...s,
		video: { ...s.video, ...updates }
	}));
}

export function updateMidiSettings(updates: Partial<AVSettings['midi']>) {
	settings.update(s => ({
		...s,
		midi: { ...s.midi, ...updates }
	}));
}

export function updateShaderSettings(updates: Partial<AVSettings['shader']>) {
	settings.update(s => ({
		...s,
		shader: { ...s.shader, ...updates }
	}));
}

export function updateMatrixSettings(updates: Partial<AVSettings['matrix']>) {
	settings.update(s => ({
		...s,
		matrix: { ...s.matrix, ...updates }
	}));
}

// Reset to defaults
export function resetSettings(): void {
	settings.set(DEFAULT_SETTINGS);
}

// Individual stores for convenience (also persisted)
export const videoMode = createPersistentStore<number>('video-mode', DEFAULT_SETTINGS.video.mode);
export const loopVideos = createPersistentStore<boolean>('loop-videos', DEFAULT_SETTINGS.video.loopVideos);
export const shuffle = createPersistentStore<boolean>('shuffle', DEFAULT_SETTINGS.video.shuffle);
export const cutVideo = createPersistentStore<boolean>('cut-video', DEFAULT_SETTINGS.video.cutVideo);
export const nextMediaIntervalSec = createPersistentStore<number>('next-media-interval', DEFAULT_SETTINGS.video.nextMediaIntervalSec);
