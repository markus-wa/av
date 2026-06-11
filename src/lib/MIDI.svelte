<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-french-toast';
	import SwitchPro from '$lib/Controllers.js';
	import { settings, updateMidiSettings } from '$lib/stores/settings';

	let axesState: ReadonlyArray<number> = [0, 0, 0, 0];
	let midiAccess: MIDIAccess | null = null;
	let midiOutput: MIDIOutput | null = null;
	let midiOutputs: MIDIOutput[] = [];
	let midiInterval: ReturnType<typeof setInterval>;
	let shiftPressed: boolean = false;
	let toggleState: { [key: number]: boolean } = {};
	let lastMidiOutput: MIDIOutput | null = null;

	// Get settings from store
	$: midiSettings = $settings.midi;
	$: stepSize = midiSettings.stepSize;
	$: selectedMidiIndex = midiSettings.selectedMidiIndex;
	$: cc0 = midiSettings.cc0;
	$: cc1 = midiSettings.cc1;
	$: cc2 = midiSettings.cc2;
	$: cc3 = midiSettings.cc3;

	const gates: { [key: number]: number } = {
		[SwitchPro.B]: 4,
		[SwitchPro.A]: 5,
		[SwitchPro.Y]: 6,
		[SwitchPro.X]: 7,
		[SwitchPro.LT2]: 8,
		[SwitchPro.RT2]: 9
	};

	const toggles: { [key: number]: number } = {
		[SwitchPro.LT]: 10,
		[SwitchPro.RT]: 11,
		[SwitchPro.D_UP]: 12,
		[SwitchPro.D_DOWN]: 13,
		[SwitchPro.D_LEFT]: 14,
		[SwitchPro.D_RIGHT]: 15
	};

	// Update store when settings change
	function updateStepSize(newSize: number) {
		updateMidiSettings({ stepSize: newSize });
	}

	function updateSelectedMidiIndex(newIndex: number) {
		if (newIndex < 0) {
			newIndex = midiOutputs.length - 1;
		} else if (newIndex >= midiOutputs.length) {
			newIndex = 0;
		}

		updateMidiSettings({ selectedMidiIndex: newIndex });
		midiOutput = midiOutputs[newIndex];
		lastMidiOutput = midiOutput;
		console.log('MIDI Device:', midiOutput.name);
		toast(`MIDI Device: ${midiOutput.name}`);
	}

	function updateCCValues(c0: number, c1: number, c2: number, c3: number) {
		updateMidiSettings({ cc0: c0, cc1: c1, cc2: c2, cc3: c3 });
	}

	async function initMIDI(): Promise<void> {
		try {
			if (!('requestMIDIAccess' in navigator)) {
				console.error('Web MIDI API not supported in this browser');
				toast('Web MIDI API not supported');
				return;
			}

			midiAccess = await navigator.requestMIDIAccess();

			// Listen for MIDI device changes
			midiAccess.onstatechange = (event: Event) => {
				console.log('MIDI device state change:', event);
				// Re-initialize outputs when devices change
				midiOutputs = Array.from(midiAccess!.outputs.values());

				// Try to keep the same output selected
				if (lastMidiOutput) {
					const stillExists = midiOutputs.some((o) => o === lastMidiOutput);
					if (!stillExists) {
						// Previously selected device disconnected
						lastMidiOutput = null;
						if (midiOutputs.length > 0) {
							updateSelectedMidiIndex(0);
						} else {
							midiOutput = null;
						}
					}
				}
			};

			midiOutputs = Array.from(midiAccess.outputs.values());

			// Try to restore selected MIDI index from settings
			if (selectedMidiIndex >= 0 && selectedMidiIndex < midiOutputs.length) {
				midiOutput = midiOutputs[selectedMidiIndex];
				lastMidiOutput = midiOutput;
			} else {
				// Fallback to CH345 or first device
				const newIndex = Math.max(
					midiOutputs.findIndex((output) => output.name?.includes('CH345')),
					0
				);
				updateSelectedMidiIndex(newIndex);
			}

			if (midiOutput) {
				console.log('Selected MIDI output:', midiOutput.name);
			} else {
				toast('No MIDI outputs available.');
			}
		} catch (error) {
			console.error('Error accessing MIDI:', error);
			toast('Error accessing MIDI');
		}
	}

	// Only toast when midiOutput actually changes
	$: {
		if (midiOutput !== lastMidiOutput) {
			if (midiOutput) {
				toast(`Selected MIDI device: ${midiOutput.name}`);
			} else {
				toast('No valid MIDI output.');
			}
			lastMidiOutput = midiOutput;
		}
	}

	function sendMIDICC(channel: number, controller: number, value: number): void {
		if (!midiOutput) return;

		try {
			midiOutput.send([0xb0 | channel, controller, value]); // Control Change
			console.log(`MIDI CC: Channel ${channel}, Controller ${controller}, Value ${value}`);
			toast(`MIDI CC: ch=${channel} val=${value}`)
		} catch (error) {
			console.error('Error sending MIDI CC:', error);
			toast('MIDI send error');
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

		sendMIDICC(0, 2, newCC0);
		sendMIDICC(1, 2, newCC1);
		sendMIDICC(2, 2, newCC2);
		sendMIDICC(3, 2, newCC3);

		updateCCValues(newCC0, newCC1, newCC2, newCC3);
	}

	function sendMIDINoteOn(channel: number, note: number, velocity: number = 127): void {
		if (!midiOutput) return;

		try {
			midiOutput.send([0x90 | channel, note, velocity]); // Note ON command
			console.log(`MIDI Note ON: Channel ${channel}, Note ${note}, Velocity: ${velocity}`);
			toast(`MIDI Note: ch=${channel}`)
		} catch (error) {
			console.error('Error sending MIDI Note ON:', error);
		}
	}

	function sendMIDINoteOff(channel: number, note: number): void {
		if (!midiOutput) return;

		try {
			midiOutput.send([0x80 | channel, note, 0]); // Note OFF command
			console.log(`MIDI Note OFF: Channel ${channel}, Note ${note}`);
		} catch (error) {
			console.error('Error sending MIDI Note OFF:', error);
		}
	}

	function setStepSize(v: number): void {
		if (v < 1) {
			v = 1;
		} else if (v > 127) {
			v = 127;
		}

		updateStepSize(v);
		console.log('stepSize:', stepSize);
		toast(`Step Size: ${stepSize}`);
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
				if (midiOutputs.length > 0) {
					updateSelectedMidiIndex(selectedMidiIndex - 1);
				}
			} else {
				decStepSize();
			}
		} else if (buttonIndex == SwitchPro.START) {
			if (!isPressed) return;

			if (shiftPressed) {
				if (midiOutputs.length > 0) {
					updateSelectedMidiIndex(selectedMidiIndex + 1);
				}
			} else {
				incStepSize();
			}
		} else if (buttonIndex === SwitchPro.SCREENSHOT) {
			shiftPressed = isPressed;
		} else if (buttonIndex === SwitchPro.HOME) {
			if (!isPressed) return;

			updateSelectedMidiIndex(0);
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
					midiOutputs.forEach((output) => {
						try {
							output.close?.();
						} catch (e) {
							console.error('Error closing MIDI output:', e);
						}
					});

					// Close access
					midiAccess.onstatechange = null;
					midiAccess = null;
				} catch (error) {
					console.error('Error cleaning up MIDI:', error);
				}
			}

			midiOutput = null;
			midiOutputs = [];
		}
	});
</script>
