// Platform-specific controller mappings
// Detects the platform at runtime and exports the appropriate button mappings

import linuxControllers from './Controllers.linux';
import windowsControllers from './Controllers.windows';

// Detect platform at runtime (browser environment)
const isWindows = typeof navigator !== 'undefined' && /^Win/.test(navigator.platform);

// Export the appropriate mappings based on platform
const SwitchPro = isWindows ? windowsControllers : linuxControllers;

export default SwitchPro;
