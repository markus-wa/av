<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import HomerunMatrixSwitcher from '$lib/matrix/HomerunMatrixSwitcher';
	import SwitchPro from '$lib/Controllers';
	import { pathAABBAABB, pathABAB, pathCycleAB, pathRandomAll, pathRandomSome } from '$lib/matrix/Paths';

	let matrixSwitcher: HomerunMatrixSwitcher = new HomerunMatrixSwitcher();
	let nSwitches: number = 0;

	let pathIndex = 0;
	let paths = [pathABAB, pathCycleAB, pathAABBAABB, pathRandomSome, pathRandomAll]
	$: path = paths[pathIndex];
	let isManual = false;
	let lastManualSwitchAt = new Date().getMilliseconds();

	export function setPaused(paused: boolean): void {
		isManual = paused;
	}

	async function preparePath(): Promise<void> {
		await path(matrixSwitcher, Math.abs(nSwitches));

		nSwitches++;
	}

	async function onSwitch(manual: boolean): Promise<void> {
		if (isManual && !manual) {
			return;
		} else {
			if (lastManualSwitchAt + 3000 < new Date().getMilliseconds()) {
				return;
			}
		}

		await matrixSwitcher.executeSwitch();

		await preparePath();
	}

	async function onSwitchAuto(): Promise<void> {
		await onSwitch(false);
	}

	let matrixSwitcherInterval: ReturnType<typeof setInterval>;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	export function onAxesStateChange(_axes: ReadonlyArray<number>): void {
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		if (buttonIndex == SwitchPro.LT) {
			if (!isPressed) return;

			nSwitches++;

			preparePath().then(() => {
				onSwitch(true);
			})
		} else if (buttonIndex == SwitchPro.RT) {
			if (!isPressed) return;

			nSwitches--;

			preparePath().then(() => {
				onSwitch(true);
			})
		} else if (buttonIndex == SwitchPro.LT2) {
			if (!isPressed) return;

			pathIndex--;
			if (pathIndex < 0) {
				pathIndex = paths.length - 1;
			}

			console.log("Selected path:", pathIndex);
		} else if (buttonIndex == SwitchPro.RT2) {
			if (!isPressed) return;

			pathIndex++;

			if (pathIndex >= paths.length) {
				pathIndex = 0;
			}

			console.log("Selected path:", pathIndex);
		} else if (buttonIndex == SwitchPro.A) {
			if (!isPressed) return;

			isManual = !isManual;
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			function handleClick() {
				matrixSwitcher.connect({baudRate: 9600}).then(async () => {
					console.log('Switcher version:', await matrixSwitcher.getVersion());

					clearInterval(matrixSwitcherInterval);

					await preparePath();
					await onSwitch(true);

					matrixSwitcherInterval = setInterval(onSwitchAuto, 5000);
				});
				window.removeEventListener('click', handleClick);
			}
			window.addEventListener('click', handleClick);
		}
	});

	onDestroy(() => {
		matrixSwitcher.disconnect();
	});
</script>
