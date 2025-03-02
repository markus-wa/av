<script lang="ts">
	import { onMount } from "svelte";
	import Hls from 'hls.js';
	import { toast } from 'svelte-french-toast';

	interface Playlist {
		name: string;
		entries: { name: string, url: string }[];
	}

	let videoElement: HTMLVideoElement | null = null;
	let devices: MediaDeviceInfo[] = [];
	let devicesIds: string[] = ['screen'];
	let deviceIndex: number = 0;
	let mediaIndex: number = 0;
	let playlists: Playlist[];
	let playlistIndex: number = 0;
	let mode = 0;

	$: playlist = playlists && playlists[playlistIndex];
	$: media = playlist && playlist.entries[mediaIndex];

	async function getCameras(): Promise<void> {
		await navigator.mediaDevices.getUserMedia({audio: true, video: true});

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
		} else if (mode === 2) {
			if (mediaIndex >= playlist.entries.length) {
				mediaIndex = 0;
			} else if (mediaIndex < 0) {
				mediaIndex = playlist.entries.length - 1;
			}
		}
	}

	$: {
		if (mode === 2) {
			if (playlistIndex >= playlists.length) {
				playlistIndex = 0;
			} else if (playlistIndex < 0) {
				playlistIndex = playlists.length - 1;
			}
		}
	}

	$: selectedDeviceId = devicesIds[deviceIndex];

	$: {
		if (mode === 0) {
			if (selectedDeviceId === 'screen') {
				startScreenCapture();
			} else {
				startCamera(selectedDeviceId);
			}
		} else if (mode === 1) {
			startHLS();
		} else if (mode === 2) {
			playMedia(media.url);
		}
	}

	$: {
		if (mode === 2 && playlist) {
			toast(`Playlist: ${playlist.name}`);
		}
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		if (buttonIndex == 8) { // minus/select
			if (!isPressed) return;

			if (mode === 2) {
				mode = 0;
			} else {
				mode++;
			}
		} else if (buttonIndex == 9) { // plus/start
			if (!isPressed) return;

			if (mode === 0) {
				mode = 2;
			} else {
				mode--;
			}
		} else if (buttonIndex == 4) { // left trigger
			if (!isPressed) return;

			if (mode === 0) {
				deviceIndex--;
			} else if (mode === 2) {
				mediaIndex--;
			}
		} else if (buttonIndex == 5) { // right trigger
			if (!isPressed) return;

			if (mode === 0) {
				deviceIndex++;
			} else if (mode === 2) {
				mediaIndex++;
			}
		}else if (buttonIndex == 6) { // left trigger
			if (!isPressed) return;

			 if (mode === 2) {
				 playlistIndex--;
			}
		} else if (buttonIndex == 7) { // right trigger
			if (!isPressed) return;

			 if (mode === 2) {
				playlistIndex++;
			}
		} else if (buttonIndex == 16) { // home
			if (!isPressed) return;

			reload();
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
		if (!videoElement) return;

		videoElement.srcObject = null;
		videoElement.src = url;

		videoElement.onended = () => {
			mediaIndex++;
		};

		await videoElement.play();
	}

	async function loadPlaylists() {
		const resp = await fetch('/playlists.json');
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
    }
</style>

<video autoplay bind:this={videoElement}></video>