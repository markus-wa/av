<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-french-toast';
	import Hls from 'hls.js';

	type Source = {
		name: string;
		src: string | undefined;
		hls: string | undefined;
		device: MediaDeviceInfo | undefined;
	};

	export let audioElement: HTMLAudioElement | null = null;
	export let paused = false;
	let hls: Hls | undefined;

	let streams: Source[] | undefined;
	let devices: Source[] | undefined;

	let device: MediaStream | undefined;

	$: sources = (streams && devices && [...streams, ...devices]) || [];
	let source: Source | undefined;
	let selectedSourceIndex = 0;

	async function selectSource(newSource: Source) {
		if (newSource == source) return;

		source = newSource;

		console.log('Selecting source:', source);

		if (source.src) {
			audioElement!.src = source.src;
		} else if (source.hls) {
			playHLS(source.hls);
		} else if (source.device) {
			playDevice(source.device.deviceId);
		}
	}

	$: if (sources?.length > 0) {
		console.log('Sources changed:', sources);

		selectSource(sources[selectedSourceIndex]);
	}

	async function playDevice(deviceId: string) {
		device = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId } });

		// play audio from device
		audioElement!.srcObject = device;
	}

	async function initDevices() {
		try {
			const devs = (await navigator.mediaDevices.enumerateDevices()).filter(
				(d) => d.kind === 'audioinput'
			);
			console.log('Audio devices:', devs);

			devices = devs.map((d) => ({ name: d.label, src: undefined, hls: undefined, device: d }));
		} catch (error) {
			console.error('Error initializing audio:', error);
		}
	}

	export function onAxesStateChange(_axes: ReadonlyArray<number>): void {}

	export function onButtonStateChange(_buttonIndex: number, _isPressed: boolean): void {}

	async function loadStreams() {
		try {
			const resp = await fetch('/audio-streams.json');
			streams = await resp.json();
			console.log('Audio streams loaded:', streams);
		} catch (error) {
			console.error('Error loading playlists:', error);
			toast('Error loading playlists');
		}
	}

	function playHLS(source: string) {
		if (!audioElement) return;

		if (hls) {
			hls.destroy();
		}

		if (Hls.isSupported()) {
			hls = new Hls();
			console.log('Audio HLS supported');
			hls.loadSource(source);
			hls.attachMedia(audioElement);
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				console.log('Audio HLS manifest parsed');
				audioElement?.play().catch((e) => console.error('Audio HLS playback error:', e));
			});
			hls.on(Hls.Events.ERROR, (event, data) => {
				console.log('Audio HLS error', event, data);
				if (data.fatal) {
					console.error('Audio HLS fatal error:', data);
					toast('Audio stream error');
				}
			});
		} else if (audioElement.canPlayType('application/vnd.apple.mpegurl')) {
			// Native HLS support (Safari)
			audioElement.src = source;
			audioElement.play().catch((e) => console.error('Native audio HLS error:', e));
		}
	}

	$: if (paused) {
		audioElement?.pause();
	} else {
		audioElement?.play().catch((e) => console.error('Audio play error:', e));
	}

	onMount(() => {
		loadStreams();
		initDevices();
	});

	onDestroy(() => {
		if (hls) {
			hls.destroy();
			hls = undefined;
		}
	});
</script>

<audio bind:this={audioElement} preload="auto" autoplay crossorigin="anonymous"></audio>
