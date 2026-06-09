<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-french-toast';
	import Hls from 'hls.js';

	let audioElement: HTMLAudioElement | null = null;
	let audioHlsInstance: Hls | null = null;


	export function onAxesStateChange(_axes: ReadonlyArray<number>): void {
	}

	export function onButtonStateChange(_buttonIndex: number, _isPressed: boolean): void {
	}

	function startAudioHLS() {
		if (!audioElement) return;

		if (audioHlsInstance) {
			audioHlsInstance.destroy();
		}

		if (Hls.isSupported()) {
			const hls = new Hls();
			audioHlsInstance = hls;
			console.log('Audio HLS supported');
			hls.loadSource('/api/audio-proxy/bcfm/live.mp3.m3u8');
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
			audioElement.src = '/api/audio-proxy/bcfm/live.mp3.m3u8';
			audioElement.play().catch((e) => console.error('Native audio HLS error:', e));
		}
	}

	function setPaused(paused: boolean) {
		if (audioElement) {
			if (paused) {
				audioElement.pause();
			} else {
				audioElement.play().catch((e) => console.error('Audio play error:', e));
			}
		}
	}

	onMount(() => {
		startAudioHLS();
	});

	onDestroy(() => {
		if (audioHlsInstance) {
			audioHlsInstance.destroy();
			audioHlsInstance = null;
		}
	});

	export { audioElement, setPaused };
</script>

<audio bind:this={audioElement} src="http://hydra.shoutca.st:8268/live.mp3" preload="auto" autoplay crossorigin="anonymous"></audio>
