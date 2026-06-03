<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-french-toast';
	import SwitchPro from '$lib/Controllers.js';

	let axesState: ReadonlyArray<number> = [0,0,0,0];
	let midiAccess: MIDIAccess | null = null;
	let midiOutput: MIDIOutput | null = null;
	let midiOutputs: MIDIOutput[] = [];
	let selectedMidiIndex: number = 0;
	let midiInterval: ReturnType<typeof setInterval>;
	let cc0: number = 63;
	let cc1: number = 63;
	let cc2: number = 63;
	let cc3: number = 63;
	let stepSize: number = 8;
	let shiftPressed: boolean = false;
	let toggleState: { [key: number]: boolean } = {};
	let lastMidiOutput: MIDIOutput | null = null;

	const gates: { [key: number]: number } = {
		[SwitchPro.B]: 4,
		[SwitchPro.A]: 5,
		[SwitchPro.Y]: 6,
		[SwitchPro.X]: 7,
		[SwitchPro.LT2]: 8,
		[SwitchPro.RT2]: 9,
	};

	const toggles: { [key: number]: number } = {
		[SwitchPro.LT]: 10,
		[SwitchPro.RT]: 11,
		[SwitchPro.D_UP]: 12,
		[SwitchPro.D_DOWN]: 13,
		[SwitchPro.D_LEFT]: 14,
		[SwitchPro.D_RIGHT]: 15,
	};

	async function initMIDI(): Promise<void> {
		try {
			if (!('requestMIDIAccess' in navigator)) {
				console.error("Web MIDI API not supported in this browser");
				toast("Web MIDI API not supported");
				return;
			}

			midiAccess = await navigator.requestMIDIAccess();
			
			// Listen for MIDI device changes
			midiAccess.onstatechange = (event: WebMidi.MIDIConnectionEvent) => {
				console.log("MIDI device state change:", event);
				// Re-initialize outputs when devices change
				midiOutputs = Array.from(midiAccess!.outputs.values());
				
				// Try to keep the same output selected
				if (lastMidiOutput) {
					const stillExists = midiOutputs.some(o => o === lastMidiOutput);
					if (!stillExists) {
						// Previously selected device disconnected
						lastMidiOutput = null;
						if (midiOutputs.length > 0) {
							selectedMidiIndex = 0;
							midiOutput = midiOutputs[0];
							lastMidiOutput = midiOutput;
						} else {
							midiOutput = null;
						}
					}
				}
			};
			
			midiOutputs = Array.from(midiAccess.outputs.values());
			selectedMidiIndex = Math.max(midiOutputs.findIndex((output) => output.name?.includes("CH345")), 0);
			
			if (midiOutputs.length > 0) {
				midiOutput = midiOutputs[selectedMidiIndex];
				lastMidiOutput = midiOutput;
				console.log("Selected MIDI output:", midiOutput.name);
			} else {
				toast("No MIDI outputs available.");
			}
		} catch (error) {
			console.error("Error accessing MIDI:", error);
			toast("Error accessing MIDI");
		}
	}

	// Only toast when midiOutput actually changes
	$: {
		if (midiOutput !== lastMidiOutput) {
			if (midiOutput) {
				toast(`Selected MIDI device: ${midiOutput.name}`);
			} else {
				toast("No valid MIDI output.");
			}
			lastMidiOutput = midiOutput;
		}
	}

	function sendMIDICC(channel: number, controller: number, value: number): void {
		if (!midiOutput) return;

		try {
			midiOutput.send([0xB0 | channel, controller, value]); // Control Change
			console.log(`MIDI CC: Channel ${channel}, Controller ${controller}, Value ${value}`);
		} catch (error) {
			console.error("Error sending MIDI CC:", error);
			toast("MIDI send error");
		}
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

		try {
			midiOutput.send([0x90 | channel, note, velocity]); // Note ON command
			console.log(`MIDI Note ON: Channel ${channel}, Note ${note}, Velocity: ${velocity}`);
		} catch (error) {
			console.error("Error sending MIDI Note ON:", error);
		}
	}

	function sendMIDINoteOff(channel: number, note: number): void {
		if (!midiOutput) return;

		try {
			midiOutput.send([0x80 | channel, note, 0]); // Note OFF command
			console.log(`MIDI Note OFF: Channel ${channel}, Note ${note}`);
		} catch (error) {
			console.error("Error sending MIDI Note OFF:", error);
		}
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
		let inc = Math.floor(stepSize / 2);

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

	export function onAxesStateChange(axes: ReadonlyArray<number>): void {
		axesState = axes;
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		if (buttonIndex == SwitchPro.SELECT) {
			if (!isPressed) return;

			if (shiftPressed) {
				selectedMidiIndex--;
				if (selectedMidiIndex < 0) {
					selectedMidiIndex = midiOutputs.length - 1;
				}

				if (midiOutputs.length > 0) {
					midiOutput = midiOutputs[selectedMidiIndex];
					lastMidiOutput = midiOutput;
					console.log("Selected MIDI device:", midiOutput.name);
				}
			} else {
				decStepSize();
			}
		} else if (buttonIndex == SwitchPro.START) {
			if (!isPressed) return;

			if (shiftPressed) {
				selectedMidiIndex++;

				if (selectedMidiIndex >= midiOutputs.length) {
					selectedMidiIndex = 0;
				}

				if (midiOutputs.length > 0) {
					midiOutput = midiOutputs[selectedMidiIndex];
					lastMidiOutput = midiOutput;
					console.log("Selected MIDI device:", midiOutput.name);
				}
			} else {
				incStepSize();
			}
		} else if (buttonIndex === SwitchPro.SCREENSHOT) {
			shiftPressed = isPressed;
		} else if (buttonIndex === SwitchPro.HOME) {
			selectedMidiIndex = 0;
			if (midiOutputs.length > 0) {
				midiOutput = midiOutputs[0];
				lastMidiOutput = midiOutput;
			}
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

	onMount(() => {
		if (typeof window !== 'undefined') {
			initMIDI();
			midiInterval = setInterval(sendMIDICCs, 100);
		}
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			clearInterval(midiInterval);
			
			// Close MIDI access and clean up
			if (midiAccess) {
				try {
					// Close all outputs
					midiOutputs.forEach(output => {
						try {
							output.close?.();
						} catch (e) {
							console.error("Error closing MIDI output:", e);
						}
					});
					
					// Close access
					midiAccess.onstatechange = null;
					midiAccess = null;
				} catch (error) {
					console.error("Error cleaning up MIDI:", error);
				}
			}
			
			midiOutput = null;
			midiOutputs = [];
		}
	});
</script>
