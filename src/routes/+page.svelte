<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Video from '$lib/Video.svelte';
	import MIDI from '$lib/MIDI.svelte';
	import { toast, Toaster } from 'svelte-french-toast';
	import Shader from '$lib/Shader.svelte';

	let animationFrame: number;
	let previousButtonStates: boolean[] = [];
	let axesState: ReadonlyArray<number> = [0,0,0,0];
	let selectedGamepadIndex: number = 0;
	let gamepadsList: Gamepad[] = [];
	let videoComponent: Video;
	let midiComponent: MIDI;
	let shaderComponent: Shader;
	let shiftPressed: boolean = false;
	let controlledComponentIndex: number = 0;
	let controlledComponents: ControlledComponent[];

	interface ControlledComponent {
		onAxesStateChange(axesState: ReadonlyArray<number>): void;
		onButtonStateChange(buttonIndex: number, isPressed: boolean): void;
	}

	$: controlledComponents = [midiComponent, videoComponent];
	$: controlledComponent = controlledComponents[controlledComponentIndex];
	$: gamepad = gamepadsList[selectedGamepadIndex];

	$: {
		if (gamepad) {
			toast(`Gamepad connected: ${gamepad.id}`, {
				duration: 3000
			});
		}
	}

	$: {
		if (controlledComponent === videoComponent) {
			toast("Mode: Video");
		} else if (controlledComponent === midiComponent) {
			toast("Mode: MIDI");
		}
	}

	function updateGamepadList(): void {
		const gamepads = navigator.getGamepads();
		gamepadsList = Array.from(gamepads).filter((gp): gp is Gamepad => gp !== null);
		console.log("Gamepads:", gamepadsList);
	}

	function processGamepadState(): void {
		if (typeof window === 'undefined') return; // Prevent SSR errors

		if (gamepad) {
			const buttons = gamepad.buttons.map((button, index) => ({ index, pressed: button.pressed }));

			buttons.forEach(({ index, pressed }) => {
				if (previousButtonStates[index] !== pressed) {
					console.log(`Button ${index} changed to ${pressed ? 'PRESSED' : 'RELEASED'}`, gamepad.buttons);

					let handled = false;

					if (index === 17) {
						shiftPressed = pressed;
					} else if (shiftPressed) {
						if (index === 16 && pressed) {
							if (controlledComponentIndex === controlledComponents.length - 1) {
								controlledComponentIndex = 0;
							} else {
								controlledComponentIndex++;
							}

							handled = true;
						}
					}

					if (!handled) {
						controlledComponent?.onButtonStateChange(index, pressed);
					}
				}
			});

			previousButtonStates = buttons.map(button => button.pressed);
			if (axesState !== gamepad.axes) {
				controlledComponent?.onAxesStateChange(axesState);
			}
			axesState = gamepad.axes;
		}
		animationFrame = requestAnimationFrame(processGamepadState);
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('gamepadconnected', () => {
				updateGamepadList();
				processGamepadState();
			});
			window.addEventListener('gamepaddisconnected', () => {
				console.log("Gamepad disconnected");
				updateGamepadList();
			});
			updateGamepadList();
			processGamepadState();
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('gamepadconnected', processGamepadState);
			window.removeEventListener('gamepaddisconnected', () => console.log("Gamepad disconnected"));
			cancelAnimationFrame(animationFrame);
		}
	});
</script>

<MIDI bind:this={midiComponent} />
<Video bind:this={videoComponent} />
<Shader bind:this={shaderComponent} videoElement={videoComponent?.videoElement}/>
<Toaster />