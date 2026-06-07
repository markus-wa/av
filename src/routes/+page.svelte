<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Video from '$lib/Video.svelte';
	import MIDI from '$lib/MIDI.svelte';
	import { toast, Toaster } from 'svelte-french-toast';
	import Shader from '$lib/shaders/Shader.svelte';
	import SwitchPro from '$lib/Controllers';
	import MatrixSwitcher from '$lib/matrix/MatrixSwitcher.svelte';
	import { debugMode, toggleDebugMode } from '$lib/stores';

	let animationFrame: number;
	let previousButtonStates: boolean[] = [];
	let axesState: ReadonlyArray<number> = [0, 0, 0, 0];
	let selectedGamepadIndex: number = 0;
	let gamepadsList: Gamepad[] = [];
	let videoComponent: Video;
	let midiComponent: MIDI;
	let shaderComponent: Shader;
	let matrixSwitcherComponent: MatrixSwitcher;
	let shiftPressed: boolean = false;
	let controlledComponentIndex: number = 0;
	let controlledComponents: ControlledComponent[];
	let mediaElement: HTMLVideoElement | HTMLImageElement;
	let rStickPressStart: number | null = null;
	let paused = false;

	$: showToaster = $debugMode;

	function handleMediaChange(element: HTMLVideoElement | HTMLImageElement): void {
		console.log('Media changed:', element);
		mediaElement = element;
	}

	interface ControlledComponent {
		onAxesStateChange(axesState: ReadonlyArray<number>): void;
		onButtonStateChange(buttonIndex: number, isPressed: boolean): void;
	}

	$: controlledComponents = [
		videoComponent,
		midiComponent,
		shaderComponent,
		matrixSwitcherComponent
	];
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
			toast('Mode: Video');
		} else if (controlledComponent === midiComponent) {
			toast('Mode: MIDI');
		} else if (controlledComponent === shaderComponent) {
			toast('Mode: Shader');
		} else if (controlledComponent === matrixSwitcherComponent) {
			toast('Mode: Matrix Switcher');
		}
	}

	function updateGamepadList(): void {
		const gamepads = navigator.getGamepads();
		gamepadsList = Array.from(gamepads).filter((gp): gp is Gamepad => gp !== null && gp.connected);
		console.log('Gamepads:', gamepadsList);
	}

	function processGamepadState(): void {
		if (typeof window === 'undefined') return; // Prevent SSR errors

		if (gamepad) {
			const buttons = gamepad.buttons.map((button, index) => ({ index, pressed: button.pressed }));

			buttons.forEach(({ index, pressed }) => {
				if (previousButtonStates[index] !== pressed) {
					console.log(
						`Button ${index} changed to ${pressed ? 'PRESSED' : 'RELEASED'}`,
						gamepad.buttons
					);

					let handled = false;

					if (index === SwitchPro.SCREENSHOT) {
						shiftPressed = pressed;
					} else if (shiftPressed) {
						if (index === SwitchPro.HOME && pressed) {
							if (controlledComponentIndex === controlledComponents.length - 1) {
								controlledComponentIndex = 0;
							} else {
								controlledComponentIndex++;
							}
							handled = true;
						}
						if (index === SwitchPro.D_UP) {
							controlledComponentIndex = 0;
							handled = true;
						} else if (index === SwitchPro.D_LEFT) {
							controlledComponentIndex = 1;
							handled = true;
						} else if (index === SwitchPro.D_RIGHT) {
							controlledComponentIndex = 2;
							handled = true;
						} else if (index === SwitchPro.D_DOWN) {
							controlledComponentIndex = 3;
							handled = true;
						}
					}

					if (index === SwitchPro.RIGHT_STICK) {
						if (pressed) {
							rStickPressStart = performance.now();
						} else {
							rStickPressStart = null;
						}
					}

					if (index === SwitchPro.X) {
						if (!pressed) return;

						paused = !paused;
						videoComponent?.setPaused(paused);
						matrixSwitcherComponent?.setPaused(paused);
						shaderComponent?.setPaused(paused);
						handled = true;

						toast(paused ? 'Paused' : 'Unpaused');
					}

					if (!handled) {
						controlledComponent?.onButtonStateChange(index, pressed);
					}
				}
			});

			if (rStickPressStart !== null && performance.now() - rStickPressStart >= 3000) {
				toggleDebugMode();
				rStickPressStart = null;

				toast(`Debug ${$debugMode ? 'ON' : 'OFF'}`);
			}

			previousButtonStates = buttons.map((button) => button.pressed);
			if (axesState !== gamepad.axes) {
				controlledComponent?.onAxesStateChange(axesState);
			}
			axesState = gamepad.axes;
		}
		// Only continue animation frame loop if there's an active gamepad
		if (gamepad || gamepadsList.length > 0) {
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

<MIDI bind:this={midiComponent} />
<Video bind:this={videoComponent} onMediaChange={handleMediaChange} />
<Shader bind:this={shaderComponent} {mediaElement} />
<MatrixSwitcher bind:this={matrixSwitcherComponent} />
<Toaster containerStyle={showToaster ? 'display: block;' : 'display: none;'} />
