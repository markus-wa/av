<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Hls from 'hls.js';
	import { toast } from 'svelte-french-toast';
	import SwitchPro from '$lib/Controllers';
	import Stepper from '$lib/Stepper.svelte';
	import { settings, updateVideoSettings } from '$lib/stores/settings';

	interface Playlist {
		name: string;
		entries: { name: string, url: string }[];
		pausedMedia?: { name: string, url: string };
	}

	export let videoElement: HTMLVideoElement | null = null;
	export let imgElement: HTMLImageElement | null = null;
	let devices: MediaDeviceInfo[] = [];
	let devicesIds: string[] = ['screen'];
	let playlists: Playlist[];
	let hlsInstance: Hls | null = null;
	let currentStream: MediaStream | null = null;
	let currentVideoUrl: string | null = null;
	export let onMediaChange: (element: HTMLVideoElement | HTMLImageElement) => void;

	// Get settings from store with defaults
	$: videoSettings = $settings.video || { mode: 2, loopVideos: false, shuffle: true, cutVideo: false, nextMediaIntervalSec: 5, deviceIndex: 0, mediaIndex: 0, playlistIndex: 0 };
	$: mode = videoSettings.mode;
	$: loopVideos = videoSettings.loopVideos;
	$: shuffle = videoSettings.shuffle;
	$: cutVideo = videoSettings.cutVideo;
	$: nextMediaIntervalSec = videoSettings.nextMediaIntervalSec;
	$: deviceIndex = videoSettings.deviceIndex;
	$: mediaIndex = videoSettings.mediaIndex;
	$: playlistIndex = videoSettings.playlistIndex;

	// Shuffle-related state
	let currentShuffleIndex: number = 0;

	// Update store when settings change
	function updateMode(newMode: number) {
		mode = newMode;
		updateVideoSettings({ mode });
	}

	function updateLoop(newLoop: boolean) {
		loopVideos = newLoop;
		updateVideoSettings({ loopVideos });
		toast(`Loop: ${loopVideos ? 'ON' : 'OFF'}`);
	}

	function updateShuffle(newShuffle: boolean) {
		shuffle = newShuffle;
		updateVideoSettings({ shuffle });
		toast(`Shuffle: ${shuffle ? 'ON' : 'OFF'}`);
		if (shuffle && playlist) {
			currentShuffleIndex = shuffleOrder.indexOf(mediaIndex);
		}
	}

	function updateCut(newCut: boolean) {
		cutVideo = newCut;
		updateVideoSettings({ cutVideo });
		toast(`Cut: ${cutVideo ? 'ON' : 'OFF'}`);
	}

	function updateNextMediaInterval(newInterval: number) {
		nextMediaIntervalSec = newInterval;
		updateVideoSettings({ nextMediaIntervalSec });
	}

	function updateDeviceIndex(newIndex: number) {
		deviceIndex = newIndex;
		updateVideoSettings({ deviceIndex });
	}

	function updateMediaIndex(newIndex: number) {
		mediaIndex = newIndex;
		updateVideoSettings({ mediaIndex });
	}

	function updatePlaylistIndex(newIndex: number) {
		playlistIndex = newIndex;
		updateVideoSettings({ playlistIndex });
	}

	// newNextMediaIntervalSec is 0 to 1 but translated to 1 to 10
	function handleParamsChange(newNextMediaIntervalSec: number): void {
		// Only update if value actually changed to avoid recreating interval
		const newValue = 1 + Math.floor(newNextMediaIntervalSec * 9);
		if (newValue !== nextMediaIntervalSec) {
			updateNextMediaInterval(newValue);
			// Recreate interval with new timing
			if (nextMediaInterval) {
				clearInterval(nextMediaInterval);
			}
			nextMediaInterval = setInterval(nextMedia, nextMediaIntervalSec * 1000);
		}
	}

	let nextMediaInterval: ReturnType<typeof setInterval>;
	
	function setupInterval() {
		if (nextMediaInterval) {
			clearInterval(nextMediaInterval);
		}
		nextMediaInterval = setInterval(nextMedia, nextMediaIntervalSec * 1000);
	}

	$: playlist = playlists && playlists[playlistIndex];
	$: media = (paused && playlist?.pausedMedia)
		? playlist.pausedMedia
		: (playlist && playlist.entries[shuffle ? shuffleOrder[currentShuffleIndex] : mediaIndex]);

	$: isVideo = (mode === 0 || mode === 1 || (media && media.url.endsWith('.mp4')));
	$: shuffleOrder = generateShuffleOrder(playlist?.entries?.length || 0);

	$: {
		if (onMediaChange && ((isVideo && videoElement) || (!isVideo && imgElement))) {
			onMediaChange(isVideo ? videoElement! : imgElement!);
		}
	}

	$: selectedDeviceId = devicesIds[deviceIndex];

	$: {
		if (mode === 0) {
			cleanupMedia();
			if (selectedDeviceId === 'screen') {
				startScreenCapture();
			} else {
				startCamera(selectedDeviceId);
			}
		}
	}

	$: {
		if (mode === 1) {
			cleanupMedia();
			startHLS();
		}
	}

	$: {
		if (mode === 2 && playlist) {
			toast(`Playlist: ${playlist.name}`);
		}
	}

	$: {
		if (mode === 2 && media && !paused) {
			if (media.url !== currentVideoUrl) {
				currentVideoUrl = media.url;
				cleanupMedia();
				playMedia(media.url);
			}
		}
	}

	let paused = false;

	export function setPaused(p: boolean): void {
		paused = p;
		if (playlist?.pausedMedia) {
			cleanupMedia();
			playMedia(playlist.pausedMedia.url);
		}
	}

	// Generate a shuffled order using the Fisher-Yates algorithm
	function generateShuffleOrder(length: number): number[] {
		const order = Array.from({ length }, (_, i) => i);
		for (let i = order.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		return order;
	}

	// Ensure the shuffle order is up-to-date when in shuffle mode
	$: if (mode === 2 && playlist && shuffle) {
		if (shuffleOrder.length !== playlist.entries.length || shuffleOrder.indexOf(mediaIndex) === -1) {
			currentShuffleIndex = shuffleOrder.indexOf(mediaIndex);
		}
	}

	function cleanupMedia() {
		// Clean up HLS instance
		if (hlsInstance) {
			hlsInstance.destroy();
			hlsInstance = null;
		}

		// Stop media streams
		if (currentStream) {
			currentStream.getTracks().forEach(track => track.stop());
			currentStream = null;
		}

		// Clear video element
		if (videoElement) {
			videoElement.srcObject = null;
			videoElement.src = '';
			videoElement.onended = null;
		}

		// Clear image element
		if (imgElement) {
			imgElement.src = '';
		}
	}

	// Ensure indices stay within range
	$: {
		if (mode === 0) {
			if (deviceIndex >= devicesIds.length) {
				updateDeviceIndex(0);
			} else if (deviceIndex < 0) {
				updateDeviceIndex(devicesIds.length - 1);
			}
		} else if (mode === 2 && playlist) {
			if (!shuffle) {
				if (mediaIndex >= playlist.entries.length) {
					updateMediaIndex(0);
				} else if (mediaIndex < 0) {
					updateMediaIndex(playlist.entries.length - 1);
				}
			}
		}
	}

	$: {
		if (mode === 2 && playlists) {
			if (playlistIndex >= playlists.length) {
				updatePlaylistIndex(0);
			} else if (playlistIndex < 0) {
				updatePlaylistIndex(playlists.length - 1);
			}
		}
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		if (buttonIndex == SwitchPro.SELECT) {
			if (!isPressed) return;
			if (mode === 2) {
				updateMode(0);
			} else {
				updateMode(mode + 1);
			}
		} else if (buttonIndex == SwitchPro.START) {
			if (!isPressed) return;
			if (mode === 0) {
				updateMode(2);
			} else {
				updateMode(mode - 1);
			}
		} else if (buttonIndex == SwitchPro.LT) {
			if (!isPressed) return;
			if (mode === 0) {
				updateDeviceIndex(deviceIndex - 1);
			} else if (mode === 2) {
				if (shuffle) {
					prevShuffleMedia();
				} else {
					updateMediaIndex(mediaIndex - 1);
				}
			}
		} else if (buttonIndex == SwitchPro.RT) {
			if (!isPressed) return;
			if (mode === 0) {
				updateDeviceIndex(deviceIndex + 1);
			} else if (mode === 2) {
				if (shuffle) {
					nextShuffleMedia();
				} else {
					updateMediaIndex(mediaIndex + 1);
				}
			}
		} else if (buttonIndex == SwitchPro.LT2) {
			if (!isPressed) return;
			if (mode === 2) {
				updatePlaylistIndex(playlistIndex - 1);
				shuffleOrder = generateShuffleOrder(playlist.entries.length);
			}
		} else if (buttonIndex == SwitchPro.RT2) {
			if (!isPressed) return;
			if (mode === 2) {
				updatePlaylistIndex(playlistIndex + 1);
				shuffleOrder = generateShuffleOrder(playlist.entries.length);
			}
		} else if (buttonIndex == SwitchPro.HOME) {
			if (!isPressed) return;
			reload();
		} else if (buttonIndex == SwitchPro.D_LEFT) {
			if (!isPressed) return;
			updateLoop(!loopVideos);
		} else if (buttonIndex == SwitchPro.D_UP) {
			if (!isPressed) return;
			updateShuffle(!shuffle);
		} else if (buttonIndex == SwitchPro.D_RIGHT) {
			if (!isPressed) return;
			updateCut(!cutVideo);
		}
	}

	export function onAxesStateChange(): void {}

	async function getCameras(): Promise<void> {
		try {
			await navigator.mediaDevices.getUserMedia({ video: true });
			const mediaDevices = await navigator.mediaDevices.enumerateDevices();
			devices = mediaDevices.filter((device) => device.kind === "videoinput");
			devicesIds = [
				...devices.map((device) => device.deviceId),
				'screen',
			];
		} catch (error) {
			console.error("Error getting cameras:", error);
			toast("Error accessing cameras");
		}
	}

	async function startCamera(deviceId: string): Promise<void> {
		try {
			const label = devices.find((device) => device.deviceId === deviceId)?.label;
			toast(`Starting camera: ${label}`);
			if (!deviceId) return;

			// Clean up previous stream
			cleanupMedia();

			const stream = await navigator.mediaDevices.getUserMedia({
				video: { deviceId: { exact: deviceId } },
			});
			currentStream = stream;
			if (videoElement) {
				videoElement.srcObject = stream;
			}
		} catch (error) {
			console.error("Error starting camera:", error);
			toast("Failed to start camera");
		}
	}

	async function startScreenCapture(): Promise<void> {
		try {
			cleanupMedia();
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true
			});
			currentStream = stream;
			if (videoElement) {
				videoElement.srcObject = stream;
			}
			toast("Started screen capture");
		} catch (error) {
			console.error("Error starting screen capture:", error);
			toast("Failed to start screen capture");
		}
	}

	function startHLS() {
		cleanupMedia();
		if (!videoElement) return;

		const hls = new Hls();
		hlsInstance = hls;
		
		hls.loadSource('http://fl1.moveonjoy.com/NICKELODEON/index.m3u8');
		hls.attachMedia(videoElement);
		hls.on(Hls.Events.MANIFEST_PARSED, function() {
			videoElement!.play().catch(e => console.error("HLS playback error:", e));
		});
		hls.on(Hls.Events.ERROR, function(event, data) {
			if (data.fatal) {
				console.error("HLS fatal error:", data);
				toast("HLS stream error");
			}
		});
	}

	async function playMedia(url: string) {
		if (url.endsWith('.mp4')) {
			if (!videoElement) return;
			cleanupMedia();
			videoElement.srcObject = null;
			videoElement.src = url;
			videoElement.onended = () => {
				if (shuffle) {
					nextShuffleMedia();
				} else {
					updateMediaIndex(mediaIndex + 1);
				}
			};
			try {
				await videoElement.play();
			} catch (error) {
				console.error("Error playing video:", error);
				toast("Error playing video");
			}
		} else {
			if (!imgElement) return;
			imgElement.src = url;
		}
	}

	async function preloadMedia(url: string): Promise<void> {
		if (url === videoElement?.src || url === currentVideoUrl) {
			return;
		}

		try {
			const response = await fetch(url, { method: 'HEAD' });
			if (!response.ok) {
				console.error(`Failed to preload media: ${url}`);
			}
		} catch (error) {
			console.error(`Error preloading media: ${url}`, error);
		}
	}

	async function loadPlaylists() {
		try {
			const resp = await fetch('/api/playlists');
			let playlistsTmp = await resp.json();
			for (const playlist of playlistsTmp.slice(1)) {
				if (playlist.entries.length > 0) {
					await preloadMedia(playlist.entries[0].url);
				}
			}
			playlists = playlistsTmp;
		} catch (error) {
			console.error("Error loading playlists:", error);
			toast("Error loading playlists");
		}
	}

	$: {
		if (mode === 2 && playlist) {
			// Preload next and previous media
			if (playlist.entries.length > 1) {
				const nextIndex = (mediaIndex + 1) % playlist.entries.length;
				preloadMedia(playlist.entries[nextIndex].url);

				if (playlist.entries.length > 2) {
					const prevIndex = (mediaIndex - 1 + playlist.entries.length) % playlist.entries.length;
					preloadMedia(playlist.entries[prevIndex].url);
				}
			}
		}
	}

	function nextShuffleMedia() {
		if (!playlist) return;
		currentShuffleIndex = (currentShuffleIndex + 1) % shuffleOrder.length;
		updateMediaIndex(shuffleOrder[currentShuffleIndex]);
	}

	function prevShuffleMedia() {
		if (!playlist) return;
		currentShuffleIndex = (currentShuffleIndex - 1 + shuffleOrder.length) % shuffleOrder.length;
		updateMediaIndex(shuffleOrder[currentShuffleIndex]);
	}

	function reload() {
		getCameras();
		loadPlaylists();
	}

	function nextMedia() {
		if (mode === 2 && (!isVideo || cutVideo)) {
			if (shuffle) {
				nextShuffleMedia();
			} else {
				updateMediaIndex(mediaIndex + 1);
			}
		}
	}

	onMount(() => {
		reload();
		setupInterval();
	});

	onDestroy(() => {
		// Clean up all resources
		clearInterval(nextMediaInterval);
		cleanupMedia();
	});
</script>

<style>
	video {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		object-fit: cover;
		z-index: -1;
		background: black;
	}
	img {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		object-fit: contain;
		z-index: -1;
		background: black;
	}
</style>

<video class:invisible={!isVideo} autoplay muted bind:this={videoElement} loop={loopVideos || null} ></video>
<img alt="img" class:invisible={isVideo} bind:this={imgElement} />
<Stepper onParamsChange={handleParamsChange} />
