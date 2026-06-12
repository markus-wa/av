# Firefox Configuration Scripts

Scripts to automatically configure Firefox for optimal A/V performance.

## Quick Start

### Using Node.js (Cross-platform: Windows, Linux, macOS)

```bash
# Navigate to scripts directory
cd scripts

# Run the configuration script
node set-firefox-settings.cjs
```

### With a Custom Profile

```bash
node set-firefox-settings.cjs --profile=YourProfileName
```

## How It Works

The script creates a `user.js` file in your Firefox profile directory. Firefox reads this file at startup and applies the settings before any other configuration.

## Requirements

- **Node.js** (v12 or later recommended)
- **Firefox** (Nightly recommended for full Web Serial API support)

## What It Configures

- **API Enablement** — Web Serial, Web MIDI, Gamepad, Service Workers, Web Audio
- **Security** — Reduces permission popups, extends gesture timeout, allows mixed content
- **Media & Video** — Enables autoplay, screen/camera/microphone access, streaming
- **Performance & Caching** — Optimizes cache sizes for large media files
- **WebGL & Rendering** — Enables WebGL and WebRender for optimal shader performance

## Important Notes

1. **Close Firefox** before running the script. Changes won't take effect if Firefox is running.
2. The script **backs up** your existing `user.js` to `user.js.bak` if it exists.
3. After running, re-open Firefox and verify settings at `about:config`.
4. Some settings (like Web Serial API) require **Firefox Nightly**.

## Manual Verification

Open `about:config` in Firefox and search for any of these settings to confirm they've been applied:
- `webgl.disabled` (should be `false`)
- `gfx.webrender.all` (should be `true`)
- `dom.serial.enabled` (should be `true`)
- `dom.webmidi.enabled` (should be `true`)

## macOS & Linux

Make the script executable if desired:
```bash
chmod +x set-firefox-settings.cjs
```

Then run with Node:
```bash
./set-firefox-settings.cjs
```

## Troubleshooting

### "No default Firefox profile found"

Run Firefox at least once to create a profile, then re-run the script.

### "Firefox profiles directory not found"

The script looks in the standard location for your OS. If you use a custom Firefox installation, specify the profile manually with `--profile=YourProfile`.

### Settings not applying

1. Ensure Firefox was completely closed when running the script
2. Check that `user.js` exists in your profile directory
3. Verify no syntax errors in the generated `user.js` file
4. Some settings may require Firefox Nightly

## Alternative: Manual Configuration

If you prefer not to use the script, you can manually set these preferences by:
1. Opening `about:config` in Firefox
2. Searching for each setting name
3. Modifying the value accordingly

The script's source code contains all the settings that need to be configured.
