<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import Video from '$lib/Video.svelte';

	let animationFrame: number;
	let previousButtonStates: boolean[] = [];
	let axesState: ReadonlyArray<number> = [0,0,0,0];
	let selectedGamepadIndex: number = 0;
	let gamepadsList: Gamepad[] = [];
	let midiAccess: MIDIAccess | null = null;
	let midiOutput: MIDIOutput | null = null;
	let midiOutputs: MIDIOutput[] = [];
	let selectedMidiIndex: number = 0;
	let midiInterval: number;
	let cc0: number = 63;
	let cc1: number = 63;
	let cc2: number = 63;
	let cc3: number = 63;
	let stepSize: number = 8;
	let shiftPressed: boolean = false;

	async function initMIDI(): Promise<void> {
		try {
			midiAccess = await navigator.requestMIDIAccess();
			midiOutputs = Array.from(midiAccess.outputs.values());
			if (midiOutputs.length > 0) {
				midiOutput = midiOutputs[0];
				console.log("MIDI Output selected:", midiOutput.name);
			} else {
				console.warn("No MIDI outputs available.");
			}
		} catch (error) {
			console.error("Error accessing MIDI:", error);
		}
	}

	function sendMIDICC(channel: number, controller: number, value: number): void {
		if (!midiOutput) return;

		midiOutput.send([0xB0 | channel, controller, value]); // Control Change
		console.log(`MIDI CC: Channel ${channel}, Controller ${controller}, Value ${value}`);
	}

	function step(prev: number, v: number, max: number): number {
		if (Math.abs(v) < 0.1) return prev; // Deadzone

		const step = Math.floor(v * max);
		const next = prev + step;

		if (next < 0) {
			return 0;
		} else if (next > 127) {
			return 127;
		} else {
			return next;
		}
	}

	function sendMIDICCs(): void {
		if (!midiOutput) return;

		const newCC0 = step(cc0, axesState[0], stepSize);
		const newCC1 = step(cc1, axesState[1], stepSize);
		const newCC2 = step(cc2, axesState[2], stepSize);
		const newCC3 = step(cc3, axesState[3], stepSize);

		if (newCC0 === cc0 && newCC1 === cc1 && newCC2 === cc2 && newCC3 === cc3) return;

		sendMIDICC(0, 2, cc0);
		sendMIDICC(1, 2, cc1);
		sendMIDICC(1, 2, cc2);
		sendMIDICC(2, 2, cc3);

		cc0 = newCC0;
		cc1 = newCC1;
		cc2 = newCC2;
		cc3 = newCC3;
	}

	function sendMIDINoteOn(channel: number, note: number, velocity: number = 127): void {
		if (!midiOutput) return;

		midiOutput.send([0x90 | channel, note, velocity]); // Note ON command
		console.log(`MIDI Note ON: Channel ${channel}, Note ${note}, Velocity: ${velocity}`);
	}

	function sendMIDINoteOff(channel: number, note: number): void {
		if (!midiOutput) return;

		midiOutput.send([0x80 | channel, note, 0]); // Note OFF command
		console.log(`MIDI Note OFF: Channel ${channel}, Note ${note}`);
	}

	function updateGamepadList(): void {
		const gamepads = navigator.getGamepads();
		gamepadsList = Array.from(gamepads).filter((gp): gp is Gamepad => gp !== null);
		console.log(gamepadsList[selectedGamepadIndex]);
	}

	function processGamepadState(): void {
		if (typeof window === 'undefined') return; // Prevent SSR errors

		const gamepads = navigator.getGamepads();
		const gamepad = gamepads[selectedGamepadIndex];

		if (gamepad) {
			const buttons = gamepad.buttons.map((button, index) => ({ index, pressed: button.pressed }));

			buttons.forEach(({ index, pressed }) => {
				if (previousButtonStates[index] !== pressed) {
					console.log(`Button ${index} changed to ${pressed ? 'PRESSED' : 'RELEASED'}`, gamepad.buttons);
					onButtonStateChange(index, pressed);
				}
			});

			previousButtonStates = buttons.map(button => button.pressed);
			axesState = gamepad.axes;
		}
		animationFrame = requestAnimationFrame(processGamepadState);
	}
	function setStepSize(v: number): void {
		if (v < 1) {
			v = 1;
		} else if (v > 127) {
			v = 127;
		}

		stepSize = v;
		console.log("stepSize:", stepSize);
	}

	function incStepSize(): void {
		let inc = Math.floor(stepSize / 3);

		if (inc === 0) {
			inc = 1;
		}

		setStepSize(stepSize + inc);
	}

	function decStepSize(): void {
		let dec = Math.floor(stepSize / 3);

		if (dec === 0) {
			dec = 1;
		}

		setStepSize(stepSize - dec);
	}

	function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		if (buttonIndex == 8) {
			if (!isPressed) return;

			if (shiftPressed) {
				selectedMidiIndex--;
				if (selectedMidiIndex < 0) {
					selectedMidiIndex = midiOutputs.length - 1;
				}

				midiOutput = midiOutputs[selectedMidiIndex];
				console.log("Selected MIDI device:", midiOutput.name);
			} else {
				decStepSize();
			}
		} else if (buttonIndex == 9) {
			if (!isPressed) return;

			if (shiftPressed) {
				selectedMidiIndex++;

				if (selectedMidiIndex >= midiOutputs.length) {
					selectedMidiIndex = 0;
				}

				midiOutput = midiOutputs[selectedMidiIndex];
				console.log("Selected MIDI device:", midiOutput.name);
			} else {
				incStepSize();
			}
		} else if (buttonIndex === 17) {
			shiftPressed = isPressed;
		} else if (buttonIndex === 16) {
			selectedMidiIndex = 0;
		}

		if (isPressed) {
			sendMIDINoteOn(buttonIndex, 60);
		} else {
			sendMIDINoteOff(buttonIndex, 60);
		}
	}

	function handleGamepadSelection(event: Event): void {
		const target = event.target as HTMLSelectElement;
		selectedGamepadIndex = parseInt(target.value);
		console.log("Selected gamepad:", gamepadsList[selectedGamepadIndex].id);
		console.log(gamepadsList[selectedGamepadIndex]);
	}

	function handleMidiSelection(event: Event): void {
		const target = event.target as HTMLSelectElement;
		selectedMidiIndex = parseInt(target.value);
		midiOutput = midiOutputs[selectedMidiIndex];
		console.log("Selected MIDI device:", midiOutput.name);
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			initMIDI();
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
			midiInterval = setInterval(sendMIDICCs, 100);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('gamepadconnected', processGamepadState);
			window.removeEventListener('gamepaddisconnected', () => console.log("Gamepad disconnected"));
			cancelAnimationFrame(animationFrame);
			clearInterval(midiInterval);
		}
	});
</script>

<div>
	<h2>Select Gamepad:</h2>
	<select on:change={handleGamepadSelection}>
		{#each gamepadsList as gamepad, index (gamepad.id)}
			<option value={index}>{gamepad.id}</option>
		{/each}
	</select>

	<h2>Select MIDI Device:</h2>
	<select on:change={handleMidiSelection}>
		{#each midiOutputs as output, index (output.id)}
			<option value={index} selected={selectedMidiIndex === index}>{output.name}</option>
		{/each}
	</select>

	<h2>Check the console for gamepad and MIDI activity logs.</h2>

	<Video />
</div>
