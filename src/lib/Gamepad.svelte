<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { toast } from 'svelte-french-toast';

	export let onButtonStateChange: (index: number, pressed: boolean) => void;
	export let onAxesStateChange: (axes: ReadonlyArray<number>) => void;

	let gamepad: Gamepad | undefined;
	let previousButtonStates: boolean[] = [];
	let axesState: ReadonlyArray<number> = [0, 0, 0, 0];
	let animationFrame: number;

	$: {
		if (gamepad) {
			toast(`Gamepad connected: ${gamepad.id}`, {
				duration: 3000
			});
		}
	}

	function updateGamepadList(): void {
		const gamepads = Array.from(navigator.getGamepads()).filter(
			(gp): gp is Gamepad => gp !== null && gp.connected
		);
		gamepad = gamepads[0] || undefined;
		console.log('Gamepads:', gamepad);
	}

	function processGamepadState(): void {
		if (typeof window === 'undefined') return; // Prevent SSR errors

		if (gamepad) {
			const buttons = gamepad.buttons.map((button, index) => ({ index, pressed: button.pressed }));

			buttons.forEach(({ index, pressed }) => {
				if (previousButtonStates[index] !== pressed) {
					console.log(
						`Button ${index} changed to ${pressed ? 'PRESSED' : 'RELEASED'}`,
						gamepad!.buttons
					);

					onButtonStateChange(index, pressed);
				}
			});

			previousButtonStates = buttons.map((button) => button.pressed);
			if (axesState !== gamepad.axes) {
				onAxesStateChange(axesState);
			}
			axesState = gamepad.axes;
		}

		// Only continue animation frame loop if there's an active gamepad
		if (gamepad) {
			animationFrame = requestAnimationFrame(processGamepadState);
		}
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('gamepadconnected', () => {
				updateGamepadList();
				processGamepadState();
			});

			window.addEventListener('gamepaddisconnected', () => {
				console.log('Gamepad disconnected');
				toast('Gamepad disconnected');
				updateGamepadList();
				processGamepadState();
			});

			updateGamepadList();
			processGamepadState();
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('gamepadconnected', processGamepadState);
			window.removeEventListener('gamepaddisconnected', () => console.log('Gamepad disconnected'));
			cancelAnimationFrame(animationFrame);
		}
	});
</script>
