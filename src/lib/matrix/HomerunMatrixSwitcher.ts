type SerialPort = any;
type ReadableStreamDefaultReader<T> = any;
type WritableStreamDefaultWriter<T> = any;

/**
 * HOMERUN Series Matrix Switcher Web Serial API
 * Controls Altinex HOMERUN matrix switchers via RS-232 using Web Serial API
 */

export interface SerialConfig {
	baudRate: number;
	dataBits: number;
	stopBits: number;
	parity: 'none' | 'even' | 'odd';
	flowControl: 'none' | 'hardware';
}

export interface ConnectionStatus {
	input: number;
	output: number;
}

export interface SwitcherInfo {
	version: string;
	unitId: number;
	baudRate: number;
	matrixSize: { inputs: number; outputs: number };
	offset: { input: number; output: number };
}

export class HomerunMatrixSwitcher {
	private port: SerialPort | null = null;
	private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
	private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
	private isConnected = false;
	private commandDelayMs = 100; // Required 50ms delay between commands

	// Default configuration matching manual specifications
	private config: SerialConfig = {
		baudRate: 2400,  // Factory default
		dataBits: 8,
		stopBits: 1,
		parity: 'none',
		flowControl: 'none'
	};

	/**
	 * Connect to the HOMERUN switcher
	 */
	async connect(config?: Partial<SerialConfig>): Promise<void> {
		if (!('serial' in navigator)) {
			throw new Error('Web Serial API not supported in this browser');
		}

		try {
			// Merge custom config with defaults
			const finalConfig = { ...this.config, ...config };

			// Request port from user
			this.port = await navigator.serial.requestPort();

			// Open the port with configuration
			await this.port.open(finalConfig);

			// Set up reader and writer
			this.reader = this.port.readable?.getReader() || null;
			this.writer = this.port.writable?.getWriter() || null;

			this.isConnected = true;
			console.log('Connected to HOMERUN Matrix Switcher');

		} catch (error) {
			throw new Error(`Failed to connect: ${error}`);
		}
	}

	/**
	 * Disconnect from the switcher
	 */
	async disconnect(): Promise<void> {
		if (this.reader) {
			await this.reader.cancel();
			this.reader.releaseLock();
			this.reader = null;
		}

		if (this.writer) {
			await this.writer.close();
			this.writer = null;
		}

		if (this.port) {
			await this.port.close();
			this.port = null;
		}

		this.isConnected = false;
		console.log('Disconnected from HOMERUN Matrix Switcher');
	}

	/**
	 * Send a command to the switcher with automatic feedback checking
	 */
	private async sendCommand(command: string, expectCustomResponse = false): Promise<string> {
		if (!this.isConnected || !this.writer) {
			throw new Error('Not connected to switcher');
		}

		try {
			// Determine if we should add feedback suffix and expect response
			const shouldAddFeedback = this.shouldAddFeedback(command);
			const expectResponse = shouldAddFeedback || expectCustomResponse;

			// Add feedback flag if appropriate
			const finalCommand = shouldAddFeedback ? this.addFeedbackSuffix(command) : command;

			// Encode command as UTF-8
			const encoder = new TextEncoder();
			const data = encoder.encode(finalCommand);

			console.log(`Sending command: ${finalCommand}`);

			// Send command
			await this.writer.write(data);

			// Wait required delay between commands (except RSET which needs 10 second)
			const delay = command.includes('RSET') ? 10000 : this.commandDelayMs;
			await this.sleep(delay);

			// Read response if expected
			let response = '';
			if (expectResponse && this.reader) {
				response = await this.readResponse();

				console.log(`Received response: ${response}`);

				// Check for [OK] or [ERR] responses if feedback was requested
				if (shouldAddFeedback) {
					this.validateFeedbackResponse(response, command);
				}
			}

			return response;
		} catch (error) {
			throw new Error(`Failed to send command '${command}': ${error}`);
		}
	}

	/**
	 * Determine if a command should have feedback suffix added
	 */
	private shouldAddFeedback(command: string): boolean {
		// Commands that don't support feedback (per manual)
		const noFeedbackCommands = [
			'VERN',  // Version command has no feedback but returns version
			'IXXOXXX', // Status commands return data directly
			'IXXO', // Input status commands
			'OXXX', // Output status commands
		];

		// Check if command is in no-feedback list
		const isNoFeedbackCommand = noFeedbackCommands.some(cmd => command.includes(cmd));

		// Commands that already end with F
		const alreadyHasFeedback = command.endsWith('F');

		// Programming commands that support feedback
		const isProgrammingCommand = command.includes('SETID') ||
			command.includes('BAUD') ||
			command.includes('CODE') ||
			command.includes('S]') ||
			command.includes('A]') ||
			command.includes('L]');

		// Control commands that support feedback
		const isControlCommand = command.includes('I') && command.includes('O') &&
			!command.includes('XXX'); // Exclude status commands

		// System commands that support feedback
		const isSystemCommand = command.includes('RSET') ||
			command.includes('SAV') ||
			command.includes('RCL') ||
			command.includes('SW') ||
			command.includes('UID') ||
			command.includes('VIS');

		return !isNoFeedbackCommand &&
			!alreadyHasFeedback &&
			(isProgrammingCommand || isControlCommand || isSystemCommand);
	}

	/**
	 * Add feedback suffix to command
	 */
	private addFeedbackSuffix(command: string): string {
		// Remove closing bracket, add F, then add closing bracket
		if (command.endsWith(']')) {
			return command.slice(0, -1) + 'F]';
		}
		return command + 'F';
	}

	/**
	 * Validate [OK] or [ERR] response from switcher
	 */
	private validateFeedbackResponse(response: string, originalCommand: string): void {
		const trimmedResponse = response.trim();

		if (trimmedResponse === '[OK]') {
			// Command successful
			return;
		} else if (trimmedResponse === '[ERR]') {
			throw new Error(`Switcher returned error for command: ${originalCommand}`);
		} else if (trimmedResponse.length === 0) {
			throw new Error(`No response received for command: ${originalCommand}`);
		} else {
			// For commands that return data (like version), the response is the data itself
			// This is valid for certain commands like [VERN] or status queries
			if (originalCommand.includes('VERN') || originalCommand.includes('XXX')) {
				return; // Valid data response
			}

			console.warn(`Unexpected response for command ${originalCommand}: ${trimmedResponse}`);
		}
	}

	/**
	 * Read response from switcher with better timeout and error handling
	 */
	private async readResponse(timeoutMs = 2000): Promise<string> {
		if (!this.reader) {
			throw new Error('Reader not available');
		}

		const decoder = new TextDecoder();
		let response = '';
		let attempts = 0;
		const maxAttempts = 3;

		while (attempts < maxAttempts) {
			try {
				const timeoutPromise = new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('Response timeout')), timeoutMs);
				});

				const readPromise = this.reader.read();
				const result = await Promise.race([readPromise, timeoutPromise]);

				if (result.value) {
					const chunk = decoder.decode(result.value);
					response += chunk;

					// Check if we have a complete response
					if (this.isCompleteResponse(response)) {
						break;
					}
				}

				attempts++;
				if (attempts < maxAttempts) {
					await this.sleep(100); // Short delay before retry
				}

			} catch (error) {
				if (attempts === maxAttempts - 1) {
					throw new Error(`Failed to read response after ${maxAttempts} attempts: ${error}`);
				}
				attempts++;
			}
		}

		return response.trim();
	}

	/**
	 * Check if response is complete (has proper termination)
	 */
	private isCompleteResponse(response: string): boolean {
		const trimmed = response.trim();

		// Standard feedback responses
		if (trimmed === '[OK]' || trimmed === '[ERR]') {
			return true;
		}

		// Version response (surrounded by brackets)
		if (trimmed.startsWith('[') && trimmed.endsWith(']') && trimmed.length > 2) {
			return true;
		}

		// Status responses (multi-character responses)
		if (trimmed.length >= 2 && /^[0-9A-F]+$/.test(trimmed)) {
			return true;
		}

		// For other responses, consider complete if we have some content
		return trimmed.length > 0;
	}

	/**
	 * Utility function for delays
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	// CONTROL COMMANDS

	/**
	 * Connect input to output
	 */
	async connectInputToOutput(input: number, output: number): Promise<void> {
		this.validateInputOutput(input, output);
		const command = `[I${input.toString().padStart(2, '0')}O${output.toString().padStart(2, '0')}]`;
		await this.sendCommand(command);
	}

	/**
	 * Set path without switching (for salvo switching)
	 */
	async setPath(input: number, output: number): Promise<void> {
		this.validateInputOutput(input, output);
		const command = `[I${input.toString().padStart(2, '0')}O${output.toString().padStart(2, '0')}P]`;
		await this.sendCommand(command);
	}

	/**
	 * Execute switch command (for paths set with setPath)
	 */
	async executeSwitch(): Promise<void> {
		await this.sendCommand('[SW]');
	}

	/**
	 * Disconnect input from output (input = 0 disconnects)
	 */
	async disconnectOutput(output: number): Promise<void> {
		this.validateOutput(output);
		const command = `[I00O${output.toString().padStart(2, '0')}]`;
		await this.sendCommand(command);
	}

	/**
	 * Connect input to specific output on specific unit
	 */
	async connectWithUnitId(input: number, output: number, unitId: number): Promise<void> {
		this.validateInputOutput(input, output);
		this.validateUnitId(unitId);
		const command = `[I${input.toString().padStart(2, '0')}O${output.toString().padStart(2, '0')}U${unitId}]`;
		await this.sendCommand(command);
	}

	/**
	 * Set unit ID for module control
	 */
	async setUnitId(unitId: number): Promise<void> {
		this.validateUnitId(unitId);
		await this.sendCommand(`[UID${unitId}]`);
	}

	/**
	 * Set exclusive unit control
	 */
	async setExclusiveUnit(unitId: number): Promise<void> {
		if (unitId < 2 || unitId > 9) {
			throw new Error('Exclusive unit ID must be between 2-9');
		}
		await this.sendCommand(`[UID${unitId}E]`);
	}

	/**
	 * Get all current connections
	 */
	async getAllConnections(): Promise<ConnectionStatus[]> {
		// Note: Status commands don't use F suffix per manual
		const response = await this.sendCommand('[IXXOXXX]', true);
		return this.parseConnectionStatus(response);
	}

	/**
	 * Get connections for specific input
	 */
	async getInputConnections(input: number): Promise<number[]> {
		this.validateInput(input);
		// Note: Status commands don't use F suffix per manual
		const response = await this.sendCommand(`[I${input.toString().padStart(2, '0')}OXXX]`, true);
		return this.parseOutputList(response);
	}

	/**
	 * Get connection for specific output
	 */
	async getOutputConnection(output: number): Promise<number> {
		this.validateOutput(output);
		// Note: Status commands don't use F suffix per manual
		const response = await this.sendCommand(`[IXXO${output.toString().padStart(2, '0')}X]`, true);
		return parseInt(response) || 0;
	}

	// MEMORY COMMANDS

	/**
	 * Save current configuration to memory
	 */
	async saveMemory(memorySlot: number): Promise<void> {
		this.validateMemorySlot(memorySlot);
		await this.sendCommand(`[SAV${memorySlot.toString().padStart(2, '0')}]`);
	}

	/**
	 * Recall configuration from memory
	 */
	async recallMemory(memorySlot: number): Promise<void> {
		this.validateMemorySlot(memorySlot);
		await this.sendCommand(`[RCL${memorySlot.toString().padStart(2, '0')}]`);
	}

	// SYSTEM COMMANDS

	/**
	 * Reset switcher (loads memory #1)
	 */
	async reset(): Promise<void> {
		await this.sendCommand('[RSET]');
	}

	/**
	 * Reset to factory defaults
	 */
	async resetToDefaults(): Promise<void> {
		await this.sendCommand('[RSETD]');
	}

	/**
	 * Get firmware version
	 */
	async getVersion(): Promise<string> {
		// Note: VERN command doesn't support F suffix but returns version directly
		const response = await this.sendCommand('[VERN]', true);
		return response.replace(/[\[\]]/g, ''); // Remove brackets
	}

	/**
	 * Set baud rate
	 */
	async setBaudRate(baudRate: 2400 | 4800 | 9600): Promise<void> {
		const baudMap = { 2400: 4, 4800: 5, 9600: 6 };
		const baudCode = baudMap[baudRate];

		if (!baudCode) {
			throw new Error('Invalid baud rate. Must be 2400, 4800, or 9600');
		}

		await this.sendCommand(`[BAUD${baudCode}]`);
		this.config.baudRate = baudRate;
	}

	/**
	 * Enable/disable vertical interval switching
	 */
	async setVerticalIntervalSwitching(enabled: boolean): Promise<void> {
		await this.sendCommand(`[VIS${enabled ? '1' : '0'}]`);
	}

	// PROGRAMMING COMMANDS (use sparingly - stored in non-volatile memory)

	/**
	 * Set module ID (programming command)
	 */
	async setModuleId(id: number): Promise<void> {
		this.validateUnitId(id);
		await this.sendCommand(`[SETID${id}]`);
	}

	/**
	 * Set matrix size (programming command)
	 */
	async setMatrixSize(inputs: number, outputs: number): Promise<void> {
		if (inputs < 0 || inputs > 96 || outputs < 0 || outputs > 96) {
			throw new Error('Matrix size must be between 0-96 for inputs and outputs');
		}
		const command = `[I${inputs.toString().padStart(2, '0')}O${outputs.toString().padStart(2, '0')}S]`;
		await this.sendCommand(command);
	}

	/**
	 * Set input/output offset (programming command)
	 */
	async setOffset(inputOffset: number, outputOffset: number): Promise<void> {
		if (inputOffset < 0 || inputOffset > 96 || outputOffset < 0 || outputOffset > 96) {
			throw new Error('Offset must be between 0-96');
		}
		const command = `[I${inputOffset.toString().padStart(2, '0')}O${outputOffset.toString().padStart(2, '0')}A]`;
		await this.sendCommand(command);
	}

	// UTILITY METHODS

	/**
	 * Send a raw command with optional feedback
	 */
	async sendRawCommand(command: string, expectResponse = false): Promise<string> {
		return await this.sendCommand(command, expectResponse);
	}

	/**
	 * Test connection with a safe command
	 */
	async testConnection(): Promise<boolean> {
		try {
			await this.getVersion();
			return true;
		} catch (error) {
			console.warn('Connection test failed:', error);
			return false;
		}
	}

	/**
	 * Check if connected
	 */
	isPortConnected(): boolean {
		return this.isConnected;
	}

	/**
	 * Get current configuration
	 */
	getConfiguration(): SerialConfig {
		return { ...this.config };
	}

	/**
	 * Get last command response for debugging
	 */
	async getDebugInfo(): Promise<{ connected: boolean; config: SerialConfig }> {
		return {
			connected: this.isConnected,
			config: this.getConfiguration()
		};
	}

	// VALIDATION METHODS

	private validateInput(input: number): void {
		if (input < 1 || input > 16) {
			throw new Error('Input must be between 1-16');
		}
	}

	private validateOutput(output: number): void {
		if (output < 1 || output > 16) {
			throw new Error('Output must be between 1-16');
		}
	}

	private validateInputOutput(input: number, output: number): void {
		this.validateInput(input);
		this.validateOutput(output);
	}

	private validateUnitId(unitId: number): void {
		if (unitId < 0 || unitId > 9) {
			throw new Error('Unit ID must be between 0-9');
		}
	}

	private validateMemorySlot(slot: number): void {
		if (slot < 0 || slot > 16) {
			throw new Error('Memory slot must be between 0-16');
		}
	}

	// PARSING METHODS

	private parseConnectionStatus(response: string): ConnectionStatus[] {
		const connections: ConnectionStatus[] = [];
		// Parse response format: Each pair of digits represents input connected to that output
		// Example: "010000030000" means output 1->input 1, output 4->input 3
		const cleanResponse = response.replace(/[\[\]]/g, '');

		// Each output is represented by 2 characters showing which input is connected
		for (let i = 0; i < cleanResponse.length; i += 2) {
			const outputNum = Math.floor(i / 2) + 1; // Output number (1-based)
			const inputStr = cleanResponse.substr(i, 2); // Get 2-character input number
			const inputNum = parseInt(inputStr, 10);

			// Only add connection if input is valid (> 0)
			if (inputNum > 0) {
				connections.push({ input: inputNum, output: outputNum });
			}
		}

		return connections;
	}

	private parseOutputList(response: string): number[] {
		const outputs: number[] = [];
		const cleanResponse = response.replace(/[\[\]]/g, '');

		// Parse pairs of digits as output numbers
		for (let i = 0; i < cleanResponse.length; i += 2) {
			const outputNum = parseInt(cleanResponse.substr(i, 2));
			if (outputNum > 0) {
				outputs.push(outputNum);
			}
		}

		return outputs;
	}
}

// USAGE EXAMPLE
export class HomerunSwitcherExample {
	private switcher = new HomerunMatrixSwitcher();

	async demonstrateUsage(): Promise<void> {
		try {
			// Connect to switcher with feedback validation
			await this.switcher.connect({ baudRate: 9600 });

			// Test connection
			const isConnected = await this.switcher.testConnection();
			if (!isConnected) {
				throw new Error('Connection test failed');
			}

			// Get version info
			const version = await this.switcher.getVersion();
			console.log('Switcher version:', version);

			// Connect input 1 to output 1 (will check for [OK] response)
			await this.switcher.connectInputToOutput(1, 1);
			console.log('Connected input 1 to output 1');

			// Set up salvo switching (will check for [OK] responses)
			await this.switcher.setPath(2, 3);
			await this.switcher.setPath(4, 5);
			await this.switcher.executeSwitch();
			console.log('Executed salvo switch');

			// Save current configuration (will check for [OK] response)
			await this.switcher.saveMemory(1);
			console.log('Saved configuration to memory 1');

			// Get current connections (status command, no [OK] expected)
			const connections = await this.switcher.getAllConnections();
			console.log('Current connections:', connections);

			// Test error handling with invalid command
			try {
				await this.switcher.sendRawCommand('[INVALID]');
			} catch (error) {
				console.log('Expected error for invalid command:', error);
			}

			// Disconnect when done
			await this.switcher.disconnect();

		} catch (error) {
			console.error('Error:', error);
		}
	}
}

export default HomerunMatrixSwitcher;