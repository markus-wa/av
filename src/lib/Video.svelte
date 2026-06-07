<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Hls from 'hls.js';
	import { toast } from 'svelte-french-toast';
	import SwitchPro from '$lib/Controllers';
	import Stepper from '$lib/Stepper.svelte';
	import { settings, updateVideoSettings } from '$lib/stores/settings';

	interface Playlist {
		name: string;
		entries: { name: string; url: string }[];
		pausedMedia?: { name: string; url: string };
	}

	export let videoElement: HTMLVideoElement | null = null;
	export let imgElement: HTMLImageElement | null = null;
	let devices: MediaDeviceInfo[] = [];
	let devicesIds: string[] = ['screen'];
	let playlists: Playlist[];
	let hlsInstance: Hls | null = null;
	let currentStream: MediaStream | null = null;
	let currentVideoUrl: string | null = null;
	let stepper: Stepper;
	export let onMediaChange: (element: HTMLVideoElement | HTMLImageElement) => void;

	// Get settings from store
	$: videoSettings = $settings.video;
	$: mode = videoSettings.mode;
	$: loopVideos = videoSettings.loopVideos;
	$: shuffle = videoSettings.shuffle;
	$: cutVideo = videoSettings.cutVideo;
	$: nextMediaIntervalSec = videoSettings.nextMediaIntervalSec;
	$: playbackRate = videoSettings.playbackRate;
	$: deviceIndex = videoSettings.deviceIndex;
	$: mediaIndex = videoSettings.mediaIndex;
	$: playlistIndex = videoSettings.playlistIndex;
	// Clamp playlistIndex to valid range when playlists are loaded
	$: if (playlists && playlists.length > 0 && playlistIndex >= playlists.length) {
		updatePlaylistIndex(playlists.length - 1);
	}

	$: if (videoElement) {
		videoElement.playbackRate = playbackRate;
	}

	// Shuffle-related state
	let currentShuffleIndex: number = 0;

	// Update store when settings change
	function updateMode(newMode: number) {
		if (newMode > 2) {
			newMode = 0;
		} else if (newMode < 0) {
			newMode = 2;
		}

		updateVideoSettings({ mode: newMode });
	}

	$: {
		// Handle media initialization directly within user gesture context
		if (mode === 0) {
			cleanupMedia();
			console.log(devicesIds, selectedDeviceId)
			if (selectedDeviceId === 'screen') {
				startScreenCapture();
			} else {
				startCamera(selectedDeviceId);
			}
		} else if (mode === 1) {
			cleanupMedia();
			startHLS();
		}
	}

	function updateLoop(newLoop: boolean) {
		updateVideoSettings({ loopVideos: newLoop });
		toast(`Loop: ${newLoop ? 'ON' : 'OFF'}`);
	}

	function updateShuffle(newShuffle: boolean) {
		updateVideoSettings({ shuffle: newShuffle });
		toast(`Shuffle: ${newShuffle ? 'ON' : 'OFF'}`);
		if (newShuffle && playlist) {
			currentShuffleIndex = shuffleOrder.indexOf(mediaIndex);
		}
	}

	function updateCut(newCut: boolean) {
		updateVideoSettings({ cutVideo: newCut });
		toast(`Cut: ${newCut ? 'ON' : 'OFF'}`);
	}

	function updateNextMediaInterval(newInterval: number) {
		updateVideoSettings({ nextMediaIntervalSec: newInterval });
		toast(`Interval: ${newInterval}s`);
	}

	function updatePlaybackRate(newRate: number) {
		updateVideoSettings({ playbackRate: newRate });
		toast(`Playback Rate: ${newRate.toFixed(1)}x`);
	}

	function updateDeviceIndex(newIndex: number) {
		if (newIndex < 0) {
			newIndex = devicesIds.length - 1;
		} else if (newIndex >= devicesIds.length) {
			newIndex = 0;
		}

		updateVideoSettings({ deviceIndex: newIndex });
	}

	function updateMediaIndex(newIndex: number) {
		if (newIndex < 0) {
			newIndex = playlist?.entries.length - 1;
		} else if (playlist && newIndex >= playlist?.entries.length - 1) {
			newIndex = 0;
		}

		updateVideoSettings({ mediaIndex: newIndex });
	}

	function updatePlaylistIndex(newIndex: number) {
		updateVideoSettings({ playlistIndex: newIndex });
	}

	let nextMediaInterval: ReturnType<typeof setInterval>;

	function setupNextMediaInterval(t: number) {
		if (nextMediaInterval) {
			clearInterval(nextMediaInterval);
		}

		nextMediaInterval = setInterval(nextMedia, t);

		console.log(`nextMediaInterval (ms): ${t}`)
	}

	// newNextMediaIntervalSec is 0 to 1 but translated to 1 to 10
	function handleParamsChange(p0: number, _p1: number, p2: number): void {
		console.log(`handleParamsChange: ${p0} ${p2}`)
		// Only update if value actually changed to avoid recreating interval
		const newNextMediaIntervalSec = 1 + Math.floor(p0 * 9);

		// make playback speed be 1 if either p2 = 0 or 1, make speed be 0.1 if p2 = 0.25, and make it be 10 if p2 = 0.25 - using a sinus curve to interpolate in between
		const mult = p2 === 1 ? 0 : 9 * Math.sin(p2 * Math.PI * 2);

		const newPlaybackRate = 1 + (mult > 0 ? mult : mult/10);

		if (newNextMediaIntervalSec !== nextMediaIntervalSec) {
			updateNextMediaInterval(newNextMediaIntervalSec);
			// Recreate interval with new timing
			setupNextMediaInterval(nextMediaIntervalSec * 1000);
		}

		if (newPlaybackRate !== playbackRate) {
			updatePlaybackRate(newPlaybackRate);
		}
	}

	$: playlist = playlists && playlists[playlistIndex];
	$: media =
		paused && playlist?.pausedMedia
			? playlist.pausedMedia
			: playlist && playlist.entries[shuffle ? shuffleOrder[currentShuffleIndex] : mediaIndex];

	$: isVideo = mode === 0 || mode === 1 || (media && media.url.endsWith('.mp4'));
	$: shuffleOrder = generateShuffleOrder(playlist?.entries?.length || 0);

	$: {
		if (onMediaChange && ((isVideo && videoElement) || (!isVideo && imgElement))) {
			onMediaChange(isVideo ? videoElement! : imgElement!);
		}
	}

	$: selectedDeviceId = devicesIds[deviceIndex];

	$: {
		if (mode === 2 && playlist) {
			toast(`Playlist: ${playlist.name}`);
		}
	}

	$: {
		if (mode === 2 && media) {
			if (paused) {
				if (playlist?.pausedMedia) {
					cleanupMedia();
					playMedia(playlist.pausedMedia.url);
				}
			} else {
				if (media.url !== currentVideoUrl) {
					currentVideoUrl = media.url;
					cleanupMedia();
					playMedia(media.url);
				}
			}
		}
	}

	let paused = false;

	export function setPaused(p: boolean): void {
		paused = p;
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
		if (
			shuffleOrder.length !== playlist.entries.length ||
			shuffleOrder.indexOf(mediaIndex) === -1
		) {
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
			currentStream.getTracks().forEach((track) => track.stop());
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

	export function onAxesStateChange(axes: ReadonlyArray<number>): void {
		stepper.onAxesStateChange(axes);
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		stepper.onButtonStateChange(buttonIndex, isPressed);

		if (buttonIndex == SwitchPro.SELECT) {
			if (!isPressed) return;
			updateMode(mode + 1);
		} else if (buttonIndex == SwitchPro.START) {
			if (!isPressed) return;
			updateMode(mode - 1);
		} else if (buttonIndex == SwitchPro.LT) {
			if (!isPressed) return;
			if (mode === 0) {
				updateDeviceIndex(deviceIndex - 1);
			} else if (mode === 2) {
				prevMedia();
			}
		} else if (buttonIndex == SwitchPro.RT) {
			if (!isPressed) return;
			if (mode === 0) {
				updateDeviceIndex(deviceIndex + 1);
			} else if (mode === 2) {
				nextMedia();
			}
		} else if (buttonIndex == SwitchPro.LT2) {
			if (!isPressed) return;
			if (mode === 2 && playlists && playlists.length > 0) {
				const newIndex = (playlistIndex - 1 + playlists.length) % playlists.length;
				updatePlaylistIndex(newIndex);
			}
		} else if (buttonIndex == SwitchPro.RT2) {
			if (!isPressed) return;
			if (mode === 2 && playlists && playlists.length > 0) {
				const newIndex = (playlistIndex + 1) % playlists.length;
				updatePlaylistIndex(newIndex);
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

	async function getCameras(): Promise<void> {
		try {
			await navigator.mediaDevices.getUserMedia({ video: true });
			const mediaDevices = await navigator.mediaDevices.enumerateDevices();
			devices = mediaDevices.filter((device) => device.kind === 'videoinput');
			devicesIds = [...devices.map((device) => device.deviceId), 'screen'];
		} catch (error) {
			console.error('Error getting cameras:', error);
			toast('Error accessing cameras');
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
				video: { deviceId: { exact: deviceId } }
			});
			currentStream = stream;
			if (videoElement) {
				videoElement.srcObject = stream;
			}
		} catch (error) {
			console.error('Error starting camera:', error);
			toast('Failed to start camera');
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
			toast('Started screen capture');
		} catch (error) {
			console.error('Error starting screen capture:', error);
			toast('Failed to start screen capture');
		}
	}

	function startHLS() {
		cleanupMedia();
		if (!videoElement) return;

		toast('Starting HLS stream');

		const hls = new Hls();
		hlsInstance = hls;

		hls.loadSource('https://matchmaker.live.bidi.net.uk/vs-cmaf-pushb-uk/x=4/i=urn:bbc:pips:service:bbc_four_hd/pc_hd_abr_v2.fmp4.m3u8');
		hls.attachMedia(videoElement);
		hls.on(Hls.Events.MANIFEST_PARSED, function () {
			videoElement!.play().catch((e) => console.error('HLS playback error:', e));
		});
		hls.on(Hls.Events.ERROR, function (event, data) {
			if (data.fatal) {
				console.error('HLS fatal error:', data);
				toast('HLS stream error');
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
				if (loopVideos) {
					return;
				}

				nextMedia();
			};
			try {
				await videoElement.play();
			} catch (error) {
				console.error('Error playing video:', error);
				toast('Error playing video');
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
			console.log('Playlists loaded:', playlists);
		} catch (error) {
			console.error('Error loading playlists:', error);
			toast('Error loading playlists');
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
		if (mode === 2 && (!isVideo || cutVideo || loopVideos)) {
			if (shuffle) {
				nextShuffleMedia();
			} else {
				updateMediaIndex(mediaIndex + 1);
			}
		}
	}

	function prevMedia() {
		if (mode === 2 && (!isVideo || cutVideo)) {
			if (shuffle) {
				prevShuffleMedia();
			} else {
				updateMediaIndex(mediaIndex - 1);
			}
		}
	}

	onMount(() => {
		reload();
		setupNextMediaInterval(nextMediaIntervalSec * 1000);
	});

	onDestroy(() => {
		// Clean up all resources
		clearInterval(nextMediaInterval);
		cleanupMedia();
	});
</script>

<video class:invisible={!isVideo} autoplay muted bind:this={videoElement} loop={loopVideos}></video>
<img alt="img" class:invisible={isVideo} bind:this={imgElement} />
<Stepper bind:this={stepper} onParamsChange={handleParamsChange} />

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
