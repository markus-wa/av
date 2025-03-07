<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Hls from 'hls.js';
	import { toast } from 'svelte-french-toast';
	import SwitchPro from '$lib/Controllers';
	import Stepper from '$lib/Stepper.svelte';

	interface Playlist {
		name: string;
		entries: { name: string, url: string }[];
	}

	export let videoElement: HTMLVideoElement | null = null;
	export let imgElement: HTMLImageElement | null = null;
	let devices: MediaDeviceInfo[] = [];
	let devicesIds: string[] = ['screen'];
	let deviceIndex: number = 0;
	let mediaIndex: number = 0;
	let playlists: Playlist[];
	let playlistIndex: number = 1;
	let mode = 0;
	let loopVideos = false;
	let shuffle = false;
	let cutVideo = false;
	let nextMediaIntervalSec = 5;
	let nextMediaInterval: ReturnType<typeof setInterval>;
	export let onMediaChange: (element: HTMLVideoElement | HTMLImageElement) => void;

	// Shuffle-related state
	let shuffleOrder: number[] = [];
	let currentShuffleIndex: number = 0;

	// Update the nextMedia timer when the interval changes
	$: {
		if (nextMediaInterval) {
			clearInterval(nextMediaInterval);
		}
		nextMediaInterval = setInterval(nextMedia, nextMediaIntervalSec * 1000);
	}

	// newNextMediaIntervalSec is 0 to 1 but translated to 1 to 10
	function handleParamsChange(newNextMediaIntervalSec: number): void {
		nextMediaIntervalSec = 1 + Math.floor(newNextMediaIntervalSec * 9);
	}

	$: playlist = playlists && playlists[playlistIndex];
	$: media = playlist && playlist.entries[mediaIndex];
	$: isVideo = (mode === 0 || mode === 1 || (media && media.url.endsWith('.mp4')));

	$: {
		if (onMediaChange && (isVideo && videoElement) || (!isVideo && imgElement)) {
			onMediaChange(isVideo ? videoElement! : imgElement!);
		}
	}

	async function getCameras(): Promise<void> {
		await navigator.mediaDevices.getUserMedia({ video: true });
		console.log("Getting cameras...");
		const mediaDevices = await navigator.mediaDevices.enumerateDevices();
		devices = mediaDevices.filter((device) => device.kind === "videoinput");
		devicesIds = [
			...devices.map((device) => device.deviceId),
			'screen',
		];
		console.log(mediaDevices);
	}

	// Ensure indices stay within range. For mediaIndex we skip auto‑correction in shuffle mode.
	$: {
		if (mode === 0) {
			if (deviceIndex >= devicesIds.length) {
				deviceIndex = 0;
			} else if (deviceIndex < 0) {
				deviceIndex = devicesIds.length - 1;
			}
		} else if (mode === 2 && playlist) {
			if (!shuffle) {
				if (mediaIndex >= playlist.entries.length) {
					mediaIndex = 0;
				} else if (mediaIndex < 0) {
					mediaIndex = playlist.entries.length - 1;
				}
			}
		}
	}

	$: {
		if (mode === 2 && playlists) {
			if (playlistIndex >= playlists.length) {
				playlistIndex = 0;
			} else if (playlistIndex < 0) {
				playlistIndex = playlists.length - 1;
			}
		}
	}

	$: selectedDeviceId = devicesIds[deviceIndex];

	$: {
		toast(`Loop: ${loopVideos ? 'ON' : 'OFF'}`);
	}

	$: {
		toast(`Cut: ${cutVideo ? 'ON' : 'OFF'}`);
	}

	$: {
		toast(`Shuffle: ${shuffle ? 'ON' : 'OFF'}`);
	}

	$: {
		if (mode === 0) {
			if (selectedDeviceId === 'screen') {
				startScreenCapture();
			} else {
				startCamera(selectedDeviceId);
			}
		}
	}

	$: {
		if (mode === 1) {
			startHLS();
		}
	}

	$: {
		if (mode === 2 && media) {
			playMedia(media.url);
		}
	}

	$: {
		if (mode === 2 && playlist) {
			toast(`Playlist: ${playlist.name}`);
		}
	}

	// Generate a shuffled order using the Fisher–Yates algorithm
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
			shuffleOrder = generateShuffleOrder(playlist.entries.length);
			currentShuffleIndex = shuffleOrder.indexOf(mediaIndex);
		}
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		if (buttonIndex == SwitchPro.SELECT) {
			if (!isPressed) return;
			if (mode === 2) {
				mode = 0;
			} else {
				mode++;
			}
		} else if (buttonIndex == SwitchPro.START) {
			if (!isPressed) return;
			if (mode === 0) {
				mode = 2;
			} else {
				mode--;
			}
		} else if (buttonIndex == SwitchPro.LT) {
			if (!isPressed) return;
			if (mode === 0) {
				deviceIndex--;
			} else if (mode === 2) {
				if (shuffle) {
					prevShuffleMedia();
				} else {
					mediaIndex--;
				}
			}
		} else if (buttonIndex == SwitchPro.RT) {
			if (!isPressed) return;
			if (mode === 0) {
				deviceIndex++;
			} else if (mode === 2) {
				if (shuffle) {
					nextShuffleMedia();
				} else {
					mediaIndex++;
				}
			}
		} else if (buttonIndex == SwitchPro.LT2) {
			if (!isPressed) return;
			if (mode === 2) {
				playlistIndex--;
			}
		} else if (buttonIndex == SwitchPro.RT2) {
			if (!isPressed) return;
			if (mode === 2) {
				playlistIndex++;
			}
		} else if (buttonIndex == SwitchPro.HOME) {
			if (!isPressed) return;
			reload();
		} else if (buttonIndex == SwitchPro.D_LEFT) {
			if (!isPressed) return;
			loopVideos = !loopVideos;
		} else if (buttonIndex == SwitchPro.D_UP) {
			if (!isPressed) return;
			shuffle = !shuffle;
			if (shuffle && playlist) {
				shuffleOrder = generateShuffleOrder(playlist.entries.length);
				currentShuffleIndex = shuffleOrder.indexOf(mediaIndex);
			}
		} else if (buttonIndex == SwitchPro.D_RIGHT) {
			if (!isPressed) return;
			cutVideo = !cutVideo;
		}
	}

	export function onAxesStateChange(): void {}

	async function startCamera(deviceId: string): Promise<void> {
		const label = devices.find((device) => device.deviceId === deviceId)?.label;
		toast(`Starting camera: ${label}`);
		if (!deviceId) return;
		const stream = await navigator.mediaDevices.getUserMedia({
			video: { deviceId: { exact: deviceId } },
		});
		if (videoElement) {
			videoElement.srcObject = stream;
		}
	}

	async function startScreenCapture(): Promise<void> {
		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true
			});
			if (videoElement) {
				videoElement.srcObject = stream;
			}
			toast("Started screen capture");
		} catch {
			toast("Failed to start screen capture");
		}
	}

	function startHLS() {
		if (!videoElement) return;
		videoElement.srcObject = null;
		const hls = new Hls();
		hls.loadSource('http://fl1.moveonjoy.com/NICKELODEON/index.m3u8');
		hls.attachMedia(videoElement);
		hls.on(Hls.Events.MANIFEST_PARSED, function() {
			videoElement!.play();
		});
	}

	async function playMedia(url: string) {
		if (isVideo) {
			if (!videoElement) return;
			videoElement.srcObject = null;
			videoElement.src = url;
			videoElement.onended = () => {
				if (shuffle) {
					nextShuffleMedia();
				} else {
					mediaIndex++;
				}
			};
			await videoElement.play();
		} else {
			if (!imgElement) return;
			imgElement.src = url;
		}
	}

	async function preloadMedia(url: string): Promise<void> {
		try {
			const response = await fetch(url);
			if (!response.ok) {
				console.error(`Failed to preload media: ${url}`);
			}
		} catch (error) {
			console.error(`Error preloading media: ${url}`, error);
		}
	}

	async function loadPlaylists() {
		const resp = await fetch('/api/playlists');
		playlists = await resp.json();
		for (const playlist of playlists) {
			if (playlist.entries.length > 0) {
				await preloadMedia(playlist.entries[0].url);
			}
		}
	}

	$: {
		if (mode === 2 && playlist) {
			const nextIndex = (mediaIndex + 1) % playlist.entries.length;
			const prevIndex = (mediaIndex - 1 + playlist.entries.length) % playlist.entries.length;
			// Preload next and previous media
			preloadMedia(playlist.entries[nextIndex].url);
			preloadMedia(playlist.entries[prevIndex].url);
		}
	}

	function nextShuffleMedia() {
		if (!playlist) return;
		currentShuffleIndex = (currentShuffleIndex + 1) % shuffleOrder.length;
		mediaIndex = shuffleOrder[currentShuffleIndex];
	}

	function prevShuffleMedia() {
		if (!playlist) return;
		currentShuffleIndex = (currentShuffleIndex - 1 + shuffleOrder.length) % shuffleOrder.length;
		mediaIndex = shuffleOrder[currentShuffleIndex];
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
				mediaIndex++;
			}
		}
	}

	onMount(() => {
		reload();
	});
	onDestroy(() => {
		clearInterval(nextMediaInterval);
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
        object-fit: cover;
        z-index: -1;
    }
</style>

<video class:invisible={!isVideo} autoplay muted bind:this={videoElement} loop={loopVideos || null} />
<img class:invisible={isVideo} bind:this={imgElement} />
<Stepper onParamsChange={handleParamsChange} />
