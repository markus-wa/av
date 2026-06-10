<script lang="ts">
	import Video from '$lib/Video.svelte';
	import MIDI from '$lib/MIDI.svelte';
	import Audio from '$lib/Audio.svelte';
	import { toast, Toaster } from 'svelte-french-toast';
	import Shader from '$lib/shaders/Shader.svelte';
	import SwitchPro from '$lib/Controllers';
	import MatrixSwitcher from '$lib/matrix/MatrixSwitcher.svelte';
	import Gamepad from '$lib/Gamepad.svelte';
	import { resetSettings } from '$lib/stores';

	let videoComponent: Video;
	let midiComponent: MIDI;
	let shaderComponent: Shader;
	let audioComponent: Audio;
	let matrixSwitcherComponent: MatrixSwitcher;
	let controlledComponentIndex: number = 0;
	let controlledComponents: ControlledComponent[];
	let mediaElement: HTMLVideoElement | HTMLImageElement;
	let shiftPressed: boolean = false;
	let sticksPressed = 0;
	let enableDebugTimeout: number;
	let enableTestTimeout: number;
	let resetTimeout: number;
	let paused = false;
	let testMode = false;
	let debugMode = false;

	$: if (sticksPressed === (1|2)) {
		clearTimeout(enableDebugTimeout)
		clearTimeout(enableTestTimeout)
		clearTimeout(resetTimeout)

		// eslint-disable-next-line no-useless-assignment
		resetTimeout = setTimeout(() => {
			resetSettings();
			toast(`Settings RESET!`);
		}, 3000) as unknown as number;
	} else {
		clearTimeout(resetTimeout)
	}

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
		matrixSwitcherComponent,
		audioComponent
	];
	$: controlledComponent = controlledComponents[controlledComponentIndex];

	$: {
		if (controlledComponent === videoComponent) {
			toast('Mode: Video');
		} else if (controlledComponent === midiComponent) {
			toast('Mode: MIDI');
		} else if (controlledComponent === shaderComponent) {
			toast('Mode: Shader');
		} else if (controlledComponent === matrixSwitcherComponent) {
			toast('Mode: Matrix Switcher');
		} else if (controlledComponent === audioComponent) {
			toast('Mode: Audio');
		}
	}

	export function onAxesStateChange(axes: ReadonlyArray<number>): void {
		controlledComponent?.onAxesStateChange(axes);
	}

	export function onButtonStateChange(index: number, pressed: boolean): void {
		let handled = false;

		if (index === SwitchPro.SCREENSHOT) {
			shiftPressed = pressed;
		} else if (shiftPressed) {
			if (index === SwitchPro.HOME && pressed) {
				if (controlledComponentIndex === 3) {
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
			} else if (index === SwitchPro.A) {
				controlledComponentIndex = 4;
				handled = true;
			}
		}

		if (index === SwitchPro.RIGHT_STICK) {
			if (pressed) {
				sticksPressed = sticksPressed | 1;
				clearTimeout(enableDebugTimeout);
				enableDebugTimeout = setTimeout(() => {
					debugMode = !debugMode;

					toast(`Debug ${debugMode ? 'ON' : 'OFF'}`);
				}, 3000) as unknown as number;
			} else {
				sticksPressed = sticksPressed & ~1;
				clearTimeout(enableDebugTimeout);
			}

			handled = true;
		}

		if (index === SwitchPro.LEFT_STICK) {
			if (pressed) {
				sticksPressed = sticksPressed | 2;
				clearTimeout(enableTestTimeout);
				enableTestTimeout = setTimeout(() => {
					testMode = !testMode;

					toast(`Test ${testMode ? 'ON' : 'OFF'}`);
				}, 3000) as unknown as number;
			} else {
				sticksPressed = sticksPressed & ~2;
				clearTimeout(enableTestTimeout);
			}

			handled = true;
		}

		if (index === SwitchPro.X) {
			if (!pressed) return;

			paused = !paused;
			handled = true;

			toast(paused ? 'Paused' : 'Unpaused');
		}

		if (!handled) {
			controlledComponent?.onButtonStateChange(index, pressed);
		}
	}
</script>

<MIDI bind:this={midiComponent} />
<Video bind:this={videoComponent} onMediaChange={handleMediaChange} {testMode} {paused} />
<Shader bind:this={shaderComponent} {mediaElement} {debugMode} {paused} {testMode} />
<MatrixSwitcher bind:this={matrixSwitcherComponent} {paused} />
<Audio bind:this={audioComponent} {paused} />
<Gamepad {onButtonStateChange} {onAxesStateChange} />
<Toaster containerStyle={debugMode ? 'display: block;' : 'display: none;'} />
