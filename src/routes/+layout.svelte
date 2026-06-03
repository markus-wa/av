<script lang="ts">
	import { onMount } from 'svelte';
	import { initServiceWorker } from '$lib/serviceWorker';
	
	let { children } = $props();
	import "../app.css";

	onMount(() => {
		// Initialize service worker
		initServiceWorker();
	});
</script>

{@render children()}
