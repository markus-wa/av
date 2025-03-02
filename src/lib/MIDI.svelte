<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-french-toast';

	let axesState: ReadonlyArray<number> = [0,0,0,0];
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
	let toggleState: { [key: number]: boolean } = {};

	const gates: { [key: number]: number } = {
		0: 4,
		1: 5,
		2: 6,
		3: 7,
		6: 8,
		7: 9,
	};

	const toggles: { [key: number]: number } = {
		4: 10,
		5: 11,
		12: 12,
		13: 13,
		14: 14,
		15: 15,
	};

	// Gates
	// 0  1  2  3  6  7
	// Toggles
	// 4  5 12 13 14 15

	async function initMIDI(): Promise<void> {
		try {
			midiAccess = await navigator.requestMIDIAccess();
			midiOutputs = Array.from(midiAccess.outputs.values());
			if (midiOutputs.length > 0) {
				midiOutput = midiOutputs[0];
			} else {
				toast("No MIDI outputs available.");
			}
		} catch (error) {
			console.error("Error accessing MIDI:", error);
		}
	}

	$: {
		if (midiOutput) {
			toast(`Selected MIDI device: ${midiOutput.name}`);
		} else {
			toast("No valid MIDI output.");
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
		sendMIDICC(2, 2, cc2);
		sendMIDICC(3, 2, cc3);

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

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
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

		const gateCh = gates[buttonIndex];

		if (gateCh) {
			if (isPressed) {
				sendMIDINoteOn(gateCh, 60);
			} else {
				sendMIDINoteOff(gateCh, 60);
			}
		}

		const toggleCh = toggles[buttonIndex];

		if (toggleCh && isPressed) {
			toggleState[toggleCh] = !toggleState[toggleCh];

			if (toggleState[toggleCh]) {
				sendMIDINoteOn(toggleCh, 60);
			} else {
				sendMIDINoteOff(toggleCh, 60);
			}
		}
	}

	export function onAxesStateChange(axes: ReadonlyArray<number>): void {
		axesState = axes;
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			initMIDI();
			midiInterval = setInterval(sendMIDICCs, 100);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			clearInterval(midiInterval);
		}
	});
</script>
