# A/V

Live performance software for glitchy audio/visual shows. This is the digital backbone of @savg.av's live A/V performances, used alongside eurorack video synthesis hardware and CRT televisions to create immersive, glitch-heavy visual experiences for raves and gigs.

Built as a browser-based control surface, it bridges analog and digital worlds: routing video signals from hardware synths through matrix switchers to CRT displays, while layering real-time digital effects like RGB splits, scanlines, chromatic aberration, pixelation, feedback loops, and audio-reactive distortions. MIDI controllers and gamepads provide tactile, hands-on control during live sets.

## Features

- [x] **Video Matrix Switching** — Control Altinex HOMERUN matrix switchers to route video signals between inputs and outputs with programmable patterns (ABAB, cycle, random)
- [x] **Real-time Video Effects** — Apply glitch, CRT simulation, chromatic aberration, pixelation, edge detection, neon grid overlays, color grading, and feedback effects
- [x] **Audio-reactive Visuals** — Waveform-driven distortions and ripples that respond to live audio input
- [x] **Multiple Video Sources** — Camera input, screen capture, HLS streams, and curated playlists
- [x] **MIDI Control** — Full mapping for MIDI controllers to trigger effects and control parameters
- [x] **Gamepad Support** — Nintendo Switch Pro controller integration for hands-on live performance
- [x] **Hardware Integration** — Designed to work seamlessly with eurorack video synthesis gear and CRT displays

## Browser Configuration

**Note:** This application requires Firefox Nightly for full functionality, particularly for Web Serial API support with matrix switchers.

### API Enablement
- `dom.serial.enabled` = `true` (Web Serial API for matrix switcher)
- `dom.webmidi.enabled` = `true` (Web MIDI API)
- `dom.serviceWorkers.enabled` = `true` (Service Workers)
- `dom.serviceWorkers.testing.enabled` = `true` (more permissive service worker behavior)
- `dom.gamepad.enabled` = `true` (Gamepad API for Switch Pro controller)
- `media.webaudio.enabled` = `true` (Web Audio API)

### Security (Reduce Popups & Annoyances)
- `media.navigator.permission.disabled` = `true` (disable permission prompts)
- `dom.user_activation.transient.timeout` = `2147483647` (default `5000`) (extend user gesture window)
- `security.sandbox.content.level` = `1` (reduce sandbox restrictions for serial/MIDI access)
- `security.mixed_content.block_active_content` = `false` (allow mixed active content)
- `security.mixed_content.block_display_content` = `false` (allow mixed display content)
- `security.insecure_connection_icon.enabled` = `false` (hide "Not Secure" warnings on HTTP pages)
- `browser.urlbar.trimURLs` = `false` (shows full URLs, less confusing)

### Media & Video
- `media.autoplay.default` = `0` (allow autoplay)
- `media.mediasource.enabled` = `true` (HLS streams)
- `media.getusermedia.screensharing.enabled` = `true` (screen capture)
- `media.getusermedia.camera.enabled` = `true` (camera input)
- `media.getusermedia.microphone.enabled` = `true` (microphone input for audio-reactive effects)
- `media.navigator.streaming.enabled` = `true` (smoother media streaming)

### Performance & Caching
- `browser.cache.disk.capacity` = `25600000`
- `browser.cache.disk.max_entry_size` = `5120000`
- `browser.cache.memory.max_entry_size` = `512000`
- `devtools.cache.disabled` = `true`
- `media.cache_size` = `51200000`
- `media.memory_cache_max_size` = `819200`
- `media.memory_caches_combined_limit_kb` = `5242880`

### WebGL & Rendering
- `webgl.disabled` = `false` (enable WebGL — required for all video effects/shaders)
- `gfx.webrender.all` = `true` (enable WebRender, Firefox's modern GPU-accelerated rendering engine — significantly improves performance for complex visuals and animations)
