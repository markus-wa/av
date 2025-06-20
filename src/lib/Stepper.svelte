<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import SwitchPro from '$lib/Controllers';

	export let [min, max] = [0, 1];
	export let stepSize: number = 0.1;
	export let [p0, p1, p2, p3] = [0.5, 0.5, 0.5, 0.5];
	export let onParamsChange: (p0: number, p1: number, p2: number, p3: number) => void;

	let axesState: ReadonlyArray<number> = [0,0,0,0];
	let paramInterval: ReturnType<typeof setInterval>;

	$: {
		onParamsChange(p0, p1, p2, p3);
		console.log("Params:", p0, p1, p2, p3);
	}

	export function onAxesStateChange(axes: ReadonlyArray<number>): void {
		axesState = axes;
	}

	function setStepSize(v: number): void {
		if (v < 0.001) {
			v = 0.001;
		} else if (v > 1) {
			v = 1;
		}

		stepSize = v;
		console.log("stepSize:", stepSize);
	}

	function incStepSize(): void {
		let inc = stepSize / 2;

		if (inc === 0) {
			inc = 1;
		}

		setStepSize(stepSize + inc);
	}

	function decStepSize(): void {
		let dec = stepSize / 3;

		if (dec === 0) {
			dec = 1;
		}

		setStepSize(stepSize - dec);
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		if (buttonIndex == SwitchPro.SELECT) {
			if (!isPressed) return;

			decStepSize();
		} else if (buttonIndex == SwitchPro.START) {
			if (!isPressed) return;

			incStepSize();
		}
	}

	function step(prev: number, v: number, maxStep: number): number {
		if (Math.abs(v) < 0.1) return prev; // Deadzone

		const step = v * maxStep;
		const next = prev + step;

		if (next < min) {
			return min;
		} else if (next > max) {
			return max;
		} else {
			return next;
		}
	}

	function updateParams(): void {
		p0 = step(p0, axesState[0], stepSize);
		p1 = step(p1, axesState[1], stepSize);
		p2 = step(p2, axesState[2], stepSize);
		p3 = step(p3, axesState[3], stepSize);
	}

	onMount(async () => {
		if (typeof window !== 'undefined') {
			paramInterval = setInterval(updateParams, 100);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			clearInterval(paramInterval);
		}
	});

</script>
