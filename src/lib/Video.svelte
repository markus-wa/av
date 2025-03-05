<script lang="ts">
	import { onMount } from "svelte";
	import Hls from 'hls.js';
	import { toast } from 'svelte-french-toast';
	import SwitchPro from '$lib/Controllers';

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
	let playlistIndex: number = 0;
	let mode = 2;
	let loop = true;

	$: playlist = playlists && playlists[playlistIndex];
	$: media = playlist && playlist.entries[mediaIndex];
	$: isVideo = (mode === 0 || mode === 1 || media && media.url.endsWith('.mp4'));

	async function getCameras(): Promise<void> {
		await navigator.mediaDevices.getUserMedia({video: true});

		console.log("Getting cameras...");
		const mediaDevices = await navigator.mediaDevices.enumerateDevices();
		devices = mediaDevices.filter((device) => device.kind === "videoinput");
		devicesIds = [
			...devices.map((device) => device.deviceId),
			'screen',
		];

		console.log(mediaDevices);
	}

	$: {
		if (mode === 0) {
			if (deviceIndex >= devicesIds.length) {
				deviceIndex = 0;
			} else if (deviceIndex < 0) {
				deviceIndex = devicesIds.length - 1;
			}
		} else if (mode === 2 && playlist) {
			if (mediaIndex >= playlist.entries.length) {
				mediaIndex = 0;
			} else if (mediaIndex < 0) {
				mediaIndex = playlist.entries.length - 1;
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
		toast(`Loop: ${loop ? 'ON' : 'OFF'}`);
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
				mediaIndex--;
			}
		} else if (buttonIndex == SwitchPro.RT) {
			if (!isPressed) return;

			if (mode === 0) {
				deviceIndex++;
			} else if (mode === 2) {
				mediaIndex++;
			}
		}else if (buttonIndex == SwitchPro.LT2) {
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

			loop = !loop;
		}
	}

	export function onAxesStateChange(): void {
	}

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
				mediaIndex++;
			};

			await videoElement.play();
		} else {
			if (!imgElement) return;

			imgElement.src = url;
		}
	}

	async function loadPlaylists() {
		const resp = await fetch('/api/playlists');
		playlists = await resp.json();
	}

	function reload() {
		getCameras();
		loadPlaylists();
	}

	onMount(() => {
		reload();
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
				cursor: none;
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
			cursor: none;
		}
</style>

<video class:invisible={!isVideo} autoplay muted bind:this={videoElement} loop={loop || null} />
<img class:invisible={isVideo} bind:this={imgElement} />