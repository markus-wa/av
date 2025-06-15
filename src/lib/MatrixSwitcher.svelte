<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import HomerunMatrixSwitcher from '$lib/HomerunMatrixSwitcher';

	let matrixSwitcher: HomerunMatrixSwitcher = new HomerunMatrixSwitcher();
	let nSwitches: number = 0;

	async function preparePath(): Promise<void> {
		const a = (nSwitches % 2) + 1;
		const b = ((nSwitches + 1) % 2) + 1;

		await matrixSwitcher.setPath(a, 1);
		await matrixSwitcher.setPath(b, 2);
		await matrixSwitcher.setPath(a, 3);
		await matrixSwitcher.setPath(b, 4);
		await matrixSwitcher.setPath(a, 5);
		await matrixSwitcher.setPath(b, 6);
		await matrixSwitcher.setPath(a, 7);
		await matrixSwitcher.setPath(b, 8);
		await matrixSwitcher.setPath(a, 9);
		await matrixSwitcher.setPath(b, 10);
		await matrixSwitcher.setPath(a, 11);
		await matrixSwitcher.setPath(b, 12);
		await matrixSwitcher.setPath(a, 13);
		await matrixSwitcher.setPath(b, 14);
		await matrixSwitcher.setPath(a, 15);
		await matrixSwitcher.setPath(b, 16);

		nSwitches++;
	}

	async function onSwitch(): Promise<void> {
		await matrixSwitcher.executeSwitch();

		await preparePath();
	}

	let matrixSwitcherInterval: ReturnType<typeof setInterval>;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	export function onAxesStateChange(_axes: ReadonlyArray<number>): void {
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	export function onButtonStateChange(_buttonIndex: number, _isPressed: boolean): void {
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			function handleClick() {
				matrixSwitcher.connect({baudRate: 9600}).then(async () => {
					console.log('Switcher version:', await matrixSwitcher.getVersion());

					clearInterval(matrixSwitcherInterval);

					await preparePath();
					await onSwitch();

					matrixSwitcherInterval = setInterval(onSwitch, 5000);
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
