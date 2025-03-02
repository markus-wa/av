<script lang="ts">
	import { onMount } from "svelte";
	import Hls from 'hls.js';

	let videoElement: HTMLVideoElement | null = null;
	let devices: MediaDeviceInfo[] = [];
	let selectedDeviceId: string = "";
	let mediaIndex: number = 0;
	let playlist: any = null;

	// Fetch available video input devices (cameras)
	async function getCameras(): Promise<void> {
		await navigator.mediaDevices.getUserMedia({audio: true, video: true});

		console.log("Getting cameras...");
		const mediaDevices = await navigator.mediaDevices.enumerateDevices();
		devices = [...mediaDevices.filter((device) => device.kind === "videoinput")];

		console.log(mediaDevices);

		// Ensure Svelte updates state by using a reactive assignment
		if (devices.length > 0) {
			selectedDeviceId = devices[0].deviceId;
		}
	}

	$: if(selectedDeviceId) {
		if (selectedDeviceId === 'screen') {
			startScreenCapture();
		} else {
			startCamera(selectedDeviceId);
		}
	}

	// Start the selected camera
	async function startCamera(deviceId: string): Promise<void> {
		console.log("Starting camera:", deviceId);

		if (!deviceId) return;

		const stream = await navigator.mediaDevices.getUserMedia({
			video: { deviceId: { exact: deviceId } },
		});

		if (videoElement) {
			videoElement.srcObject = stream;
		}
	}

	// Start screen capture
	async function startScreenCapture(): Promise<void> {
		console.log("Starting screen capture");

		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: true
			});

			if (videoElement) {
				videoElement.srcObject = stream;
			}
		} catch (err) {
			console.error("Error starting screen capture:", err);
		}
	}

	// Handle camera selection change
	function handleDeviceChange(event: Event): void {
		const target = event.target as HTMLSelectElement;
		selectedDeviceId = target.value;
	}

	function startHLS() {
		if (!videoElement) return;

		videoElement.srcObject = null;

		const hls = new Hls();
		hls.loadSource('https://live.corusdigitaldev.com/groupd/live/49a91e7f-1023-430f-8d66-561055f3d0f7/live.isml/master.m3u8');
		hls.attachMedia(videoElement);
		hls.on(Hls.Events.MANIFEST_PARSED, function() {
			videoElement!.play();
		});
	}
	async function playMedia() {
		if (!videoElement) return;

		videoElement.srcObject = null;
		videoElement.src = playlist.entries[mediaIndex].url;

		videoElement.onended = () => {
			mediaIndex++;
		};

		await videoElement.play();
	}

	$: if(mediaIndex) {
		if (mediaIndex >= playlist.entries.length) {
			mediaIndex = 0;
		} else if (mediaIndex < 0) {
			mediaIndex = playlist.entries.length - 1;
		}

		playMedia();
	}

	async function startPlaylist() {
		const resp = await fetch('/playlists/1.json');
		playlist = await resp.json();

		await playMedia();
	}

	onMount(getCameras);
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
    .controls {
        position: absolute;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.6);
        padding: 10px;
        border-radius: 8px;
    }
    select {
        color: white;
        background: black;
        border: 1px solid white;
        padding: 5px;
    }
</style>

<div class="controls">
	<label for="camera-select">Select Camera:</label>
	<select id="camera-select" on:change={handleDeviceChange} bind:value={selectedDeviceId}>
		<option value="screen">Screen Capture</option>
		{#each devices as device (device.deviceId)}
			<option value={device.deviceId}>
				{device.label || `Camera ${devices.indexOf(device) + 1}`}
			</option>
		{/each}
	</select>
	<button on:click={getCameras}>Refresh</button>
	<button on:click={startHLS}>HLS</button>
	<button on:click={startPlaylist}>Playlist</button>
</div>

<video autoplay bind:this={videoElement}></video>