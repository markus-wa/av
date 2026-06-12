#!/usr/bin/env node

/**
 * Cross-platform script to configure Firefox settings for A/V performance
 * Creates/updates user.js in the default Firefox profile with optimal settings
 * 
 * Works on: Windows, Linux, macOS
 * Requires: Node.js
 * 
 * Usage:
 *   node set-firefox-settings.js
 *   OR with custom profile: node set-firefox-settings.js --profile "YourProfile"
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// Parse command line arguments
const args = process.argv.slice(2);
const customProfile = args.find(arg => arg.startsWith('--profile='))?.split('=')[1];

// Create readline interface for user input
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// Promise wrapper for readline.question
function question(prompt) {
	return new Promise((resolve) => {
		rl.question(prompt, (answer) => {
			resolve(answer.trim());
		});
	});
}

// Firefox settings for A/V performance
const settings = {
	// API Enablement
	'dom.serial.enabled': true,
	'dom.webmidi.enabled': true,
	'dom.serviceWorkers.enabled': true,
	'dom.serviceWorkers.testing.enabled': true,
	'dom.gamepad.enabled': true,
	'media.webaudio.enabled': true,

	// Security (Reduce Popups & Annoyances)
	'media.navigator.permission.disabled': true,
	'dom.user_activation.transient.timeout': 2147483647,
	'security.sandbox.content.level': 1,
	'security.mixed_content.block_active_content': false,
	'security.mixed_content.block_display_content': false,
	'security.insecure_connection_icon.enabled': false,
	'browser.urlbar.trimURLs': false,

	// Media & Video
	'media.autoplay.default': 0,
	'media.mediasource.enabled': true,
	'media.getusermedia.screensharing.enabled': true,
	'media.getusermedia.camera.enabled': true,
	'media.getusermedia.microphone.enabled': true,
	'media.navigator.streaming.enabled': true,

	// Performance & Caching
	'browser.cache.disk.capacity': 25600000,
	'browser.cache.disk.max_entry_size': 5120000,
	'browser.cache.memory.max_entry_size': 512000,
	'devtools.cache.disabled': true,
	'media.cache_size': 51200000,
	'media.memory_cache_max_size': 819200,
	'media.memory_caches_combined_limit_kb': 5242880,

	// WebGL & Rendering
	'webgl.disabled': false,
	'gfx.webrender.all': true
};

/**
 * Get Firefox profiles directory path for the current OS
 */
function getProfilesDir() {
	const home = os.homedir();
	
	if (process.platform === 'win32') {
		// Windows: %APPDATA%\Mozilla\Firefox\Profiles
		const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
		return path.join(appData, 'Mozilla', 'Firefox', 'Profiles');
	} else if (process.platform === 'darwin') {
		// macOS: ~/Library/Application Support/Firefox/Profiles
		return path.join(home, 'Library', 'Application Support', 'Firefox', 'Profiles');
	} else {
		// Linux and other Unix-like: ~/.mozilla/firefox
		return path.join(home, '.mozilla', 'firefox');
	}
}

/**
 * Get list of valid profile directories
 */
function getProfileDirectories(profilesDir) {
	if (!fs.existsSync(profilesDir)) {
		return [];
	}
	
	return fs.readdirSync(profilesDir)
		.filter(entry => {
			const entryPath = path.join(profilesDir, entry);
			return fs.statSync(entryPath).isDirectory();
		})
		.sort((a, b) => {
			// Sort nightly profiles first, then default-release, then default
			if (a.includes('nightly')) return -1;
			if (b.includes('nightly')) return 1;
			if (a.endsWith('.default-release')) return -1;
			if (b.endsWith('.default-release')) return 1;
			if (a.endsWith('.default')) return -1;
			if (b.endsWith('.default')) return 1;
			return a.localeCompare(b);
		});
}

/**
 * Find and prompt for Firefox profile selection
 */
async function findDefaultProfile(profileName) {
	const profilesDir = getProfilesDir();
	
	if (!fs.existsSync(profilesDir)) {
		console.error(`Firefox profiles directory not found: ${profilesDir}`);
		console.log('Make sure Firefox or Firefox Nightly has been run at least once.');
		process.exit(1);
	}

	const profiles = getProfileDirectories(profilesDir);

	if (profiles.length === 0) {
		console.error('No Firefox profiles found.');
		console.log(`Profiles directory: ${profilesDir}`);
		process.exit(1);
	}

	// If custom profile specified via command line, use it directly
	if (profileName) {
		const profilePath = path.join(profilesDir, profileName);
		if (fs.existsSync(profilePath) && fs.statSync(profilePath).isDirectory()) {
			return profilePath;
		}
		console.error(`Profile "${profileName}" not found.`);
		console.log(`Available profiles in ${profilesDir}:`);
		profiles.forEach(p => console.log(`  - ${p}`));
		process.exit(1);
	}

	// Prefer nightly profile if available
	let defaultProfile = profiles.find(p => p.includes('nightly')) || 
		profiles.find(p => p.endsWith('.default-release')) || 
		profiles.find(p => p.endsWith('.default')) || 
		profiles[0];

	// If only one profile, use it without prompting
	if (profiles.length === 1) {
		return path.join(profilesDir, profiles[0]);
	}

	// Show available profiles and prompt user
	console.log('\nAvailable Firefox profiles:');
	profiles.forEach((profile, index) => {
		const marker = profile === defaultProfile ? ' [DEFAULT]' : '';
		console.log(`  ${index + 1}. ${profile}${marker}`);
	});

	const answer = await question(`\nSelect profile (1-${profiles.length}, or enter name) [${defaultProfile}]: `);
	
	if (answer === '') {
		return path.join(profilesDir, defaultProfile);
	}

	// Check if answer is a number
	const num = parseInt(answer);
	if (!isNaN(num) && num >= 1 && num <= profiles.length) {
		return path.join(profilesDir, profiles[num - 1]);
	}

	// Check if answer matches a profile name
	const matchingProfile = profiles.find(p => p === answer);
	if (matchingProfile) {
		return path.join(profilesDir, matchingProfile);
	}

	console.error(`\nProfile not found: ${answer}`);
	process.exit(1);
}

/**
 * Format value for user.js
 */
function formatValue(value) {
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}
	if (typeof value === 'number') {
		return value.toString();
	}
	return `"${value}"`;
}

/**
 * Generate user.js content
 */
function generateUserJs(settings) {
	let content = '/**\n';
	content += ' * A/V Performance Firefox Settings\n';
	content += ' * Generated by set-firefox-settings.js\n';
	content += ' * Do not edit this file directly - re-run the script to update\n';
	content += ' */\n\n';

	for (const [key, value] of Object.entries(settings)) {
		content += `user_pref("${key}", ${formatValue(value)});\n`;
	}

	return content;
}

/**
 * Main function
 */
async function main() {
	console.log('A/V Performance - Firefox Settings Configurator');
	console.log('================================================\n');

	const profileDir = await findDefaultProfile(customProfile);
	console.log(`\nUsing Firefox profile: ${profileDir}\n`);

	const userJsPath = path.join(profileDir, 'user.js');

	// Check if Firefox is running
	try {
		// Try to read profiles.ini to check if it's locked
		const profilesIniPath = path.join(path.dirname(getProfilesDir()), 'profiles.ini');
		if (fs.existsSync(profilesIniPath)) {
			const profilesIni = fs.readFileSync(profilesIniPath, 'utf8');
			if (profilesIni.includes('StartWithLastProfile=1') || profilesIni.includes('Lock')) {
				// Check if Firefox is running (simplified check)
				console.log('Note: Close Firefox before running this script for changes to take effect.');
			}
		}
	} catch (e) {
		// Ignore errors checking Firefox state
	}

	// Backup existing user.js if it exists
	if (fs.existsSync(userJsPath)) {
		// Create timestamp for backup filename
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupPath = `${userJsPath}.bak.${timestamp}`;
		
		// Also keep a simple .bak for easy access
		const simpleBackupPath = `${userJsPath}.bak`;
		
		fs.copyFileSync(userJsPath, backupPath);
		fs.copyFileSync(userJsPath, simpleBackupPath);
		
		console.log(`✓ Backed up existing user.js to:`);
		console.log(`  - ${simpleBackupPath} (latest)`);
		console.log(`  - ${backupPath} (timestamped)`);
	}

	// Write new user.js
	const content = generateUserJs(settings);
	fs.writeFileSync(userJsPath, content);

	console.log(`\nSettings written to: ${userJsPath}`);
	console.log('\nTo apply changes:');
	console.log('  1. Make sure Firefox is CLOSED');
	console.log('  2. Re-open Firefox');
	console.log('\nTo verify settings:');
	console.log('  Open about:config in Firefox and check the values');
	console.log('\nSettings applied:');
	console.log(`  - ${Object.keys(settings).length} configuration options`);
	
	// Close readline interface
	rl.close();
}

main().catch(err => {
	console.error('Error:', err.message);
	process.exit(1);
});
