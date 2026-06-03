<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import HomerunMatrixSwitcher from '$lib/matrix/HomerunMatrixSwitcher';
	import SwitchPro from '$lib/Controllers';
	import { pathAABBAABB, pathABAB, pathCycleAB, pathRandomAll, pathRandomSome } from '$lib/matrix/Paths';
	import { settings, updateMatrixSettings } from '$lib/stores/settings';

	let matrixSwitcher: HomerunMatrixSwitcher = new HomerunMatrixSwitcher();
	let nSwitches: number = 0;
	let paths = [pathABAB, pathCycleAB, pathAABBAABB, pathRandomSome, pathRandomAll];

	// Get settings from store
	$: matrixSettings = $settings.matrix;
	$: pathIndex = matrixSettings.pathIndex;
	$: isManual = matrixSettings.isManual;
	let lastManualSwitchAt = new Date().getMilliseconds();
	let showModal = false;
	let hideTimer: ReturnType<typeof setTimeout>;
	let connectionStatus = 'disconnected';
	let matrixSwitcherInterval: ReturnType<typeof setInterval>;

	$: path = paths[pathIndex];

	// Update store when settings change
	function updatePathIndex(newIndex: number) {
		pathIndex = newIndex;
		updateMatrixSettings({ pathIndex });
	}

	function updateIsManual(newValue: boolean) {
		isManual = newValue;
		updateMatrixSettings({ isManual });
	}

	export function setPaused(paused: boolean): void {
		updateIsManual(paused);
	}

	async function preparePath(): Promise<void> {
		await path(matrixSwitcher, Math.abs(nSwitches));
		nSwitches++;
	}

	async function onSwitch(manual: boolean): Promise<void> {
		if (isManual && !manual) return;
		if (lastManualSwitchAt + 3000 < new Date().getMilliseconds()) return;

		await matrixSwitcher.executeSwitch();
		await preparePath();
	}

	async function onSwitchAuto(): Promise<void> {
		await onSwitch(false);
	}

	function startHideTimer() {
		clearTimeout(hideTimer);
		hideTimer = setTimeout(() => {
			showModal = false;
		}, 5000);
	}

	let previousCursor: string = '';

	function handleUserInteraction() {
		if (!matrixSwitcher.isPortConnected()) {
			showModal = true;
			startHideTimer();
			// Save and force cursor visibility
			if (browser) {
				previousCursor = document.body.style.cursor;
				document.body.style.cursor = 'auto';
			}
		}
	}

	// Reset cursor when modal hides
	$: {
		if (!showModal && browser) {
			document.body.style.cursor = previousCursor;
		}
	}

	async function connectSerial() {
		connectionStatus = 'connecting';
		try {
			await matrixSwitcher.connect({baudRate: 9600});
			connectionStatus = 'connected';
			startHideTimer();
			clearInterval(matrixSwitcherInterval);
			await preparePath();
			await onSwitch(true);
			matrixSwitcherInterval = setInterval(onSwitchAuto, 5000);
		} catch (error) {
			connectionStatus = 'error';
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	export function onAxesStateChange(_axes: ReadonlyArray<number>): void {}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		if (buttonIndex == SwitchPro.LT) {
			if (!isPressed) return;
			nSwitches++;
			preparePath().then(() => onSwitch(true));
		} else if (buttonIndex == SwitchPro.RT) {
			if (!isPressed) return;
			nSwitches--;
			preparePath().then(() => onSwitch(true));
		} else if (buttonIndex == SwitchPro.LT2) {
			if (!isPressed) return;
			updatePathIndex(pathIndex - 1);
			if (pathIndex < 0) {
				updatePathIndex(paths.length - 1);
			}
			console.log("Selected path:", pathIndex);
		} else if (buttonIndex == SwitchPro.RT2) {
			if (!isPressed) return;
			updatePathIndex(pathIndex + 1);
			if (pathIndex >= paths.length) {
				updatePathIndex(0);
			}
			console.log("Selected path:", pathIndex);
		} else if (buttonIndex == SwitchPro.A) {
			if (!isPressed) return;
			updateIsManual(!isManual);
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			// Show modal on any click (not just first)
			// Don't show on mousemove (bass shaking moves mouse)
			window.addEventListener('click', handleUserInteraction, { passive: true });
			window.addEventListener('keydown', handleUserInteraction, { passive: true });
			window.addEventListener('touchstart', handleUserInteraction, { passive: true });
		}
	});

	onDestroy(() => {
		matrixSwitcher.disconnect();
		clearTimeout(hideTimer);
		if (matrixSwitcherInterval) {
			clearInterval(matrixSwitcherInterval);
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('click', handleUserInteraction);
			window.removeEventListener('keydown', handleUserInteraction);
			window.removeEventListener('mousemove', handleUserInteraction);
			window.removeEventListener('touchstart', handleUserInteraction);
		}
	});
</script>

{#if showModal}
	<div class="serial-modal" on:click|stopPropagation>
		<div class="serial-modal-content">
			<h2>Connect Matrix Switcher</h2>
			<p>Click below to connect to the Altinex HOMERUN switcher via serial port.</p>
			<p class="status">
				Status:
				{#if connectionStatus === 'connected'}
					<span class="connected">✓ Connected</span>
				{:else if connectionStatus === 'connecting'}
					<span class="connecting">⏳ Connecting...</span>
				{:else if connectionStatus === 'error'}
					<span class="error">✗ Connection failed - retry?</span>
				{:else}
					<span class="disconnected">⚪ Disconnected</span>
				{/if}
			</p>
			<div class="modal-buttons">
				<button on:click={connectSerial} disabled={connectionStatus === 'connecting'}>
					{#if connectionStatus === 'connecting'}
						Connecting...
					{:else if connectionStatus === 'connected'}
						✓ Connected
					{:else}
						Connect Serial Port
					{/if}
				</button>
				<button class="close-button" on:click={() => showModal = false}>×</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.serial-modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 10000;
		pointer-events: none;
		cursor: auto !important;
	}

	.serial-modal-content {
		background: rgba(0, 0, 0, 0.9);
		color: white;
		padding: 2rem;
		border-radius: 12px;
		text-align: center;
		pointer-events: auto;
		max-width: 400px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
	}

	.serial-modal-content h2 {
		margin: 0 0 1rem;
		font-size: 1.5rem;
	}

	.serial-modal-content p {
		margin: 0 0 1rem;
		opacity: 0.9;
	}

	.serial-modal-content .status {
		margin: 1rem 0;
		font-size: 0.9rem;
	}

	.serial-modal-content .connected {
		color: #4CAF50;
	}

	.serial-modal-content .connecting {
		color: #FFC107;
	}

	.serial-modal-content .error {
		color: #F44336;
	}

	.serial-modal-content .disconnected {
		color: #9E9E9E;
	}

	.serial-modal-content button {
		background: #4CAF50;
		color: white;
		border: none;
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.serial-modal-content button:hover:not(:disabled) {
		background: #45a049;
	}

	.serial-modal-content button:disabled {
		background: #666;
		cursor: not-allowed;
	}

	.modal-buttons {
		display: flex;
		gap: 10px;
		justify-content: center;
		margin-top: 1rem;
	}

	.close-button {
		background: #f44336;
		padding: 0.75rem 1rem;
		font-size: 1.2rem;
		min-width: auto;
	}

	.close-button:hover {
		background: #d32f2f;
	}
</style>
