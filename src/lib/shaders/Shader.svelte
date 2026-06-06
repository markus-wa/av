<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from "three";
	import Stepper from '$lib/Stepper.svelte';
	import {
		ChromaticAberration,
		ColorGrading,
		CRT,
		EdgeDetection,
		Feedback,
		Glitch,
		NeonGrid,
		Pixelation,
		WaveformRipple,
		type Shader
	} from '$lib/shaders/Shaders';
	import SwitchPro from '$lib/Controllers';
	import { UniformsUtils } from 'three';
	import { settings, updateShaderSettings } from '$lib/stores/settings';
	import { debugMode } from '$lib/stores';
	import { toast } from 'svelte-french-toast';

	export let mediaElement: HTMLVideoElement | HTMLImageElement | null = null;

	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene | null = null;
	let camera: THREE.PerspectiveCamera | null = null;
	let material: THREE.ShaderMaterial | null = null;
	let animationFrameId: number | null = null;
	let texture: THREE.Texture | null = null;
	let stepper: Stepper;
	let geometry: THREE.PlaneGeometry | null = null;
	let mesh: THREE.Mesh | null = null;
	const shaders: Shader[] = [WaveformRipple, CRT, ColorGrading, EdgeDetection, ChromaticAberration, Pixelation, Glitch, Feedback, NeonGrid];

	// Get settings from store
	$: shaderSettings = $settings.shader;
	$: shaderIndex = shaderSettings.shaderIndex;
	$: paused = shaderSettings.paused;
	$: shader = shaders[shaderIndex] ?? shaders[0];

	// React ONLY when the shader identity changes, not on every pass.
	let appliedShaderName: string | null = null;
	$: if (shader && material && shader.name !== appliedShaderName) {
		appliedShaderName = shader.name;
		console.log("Shader changed:", shaderIndex, shader.name);
		toast(`Shader: ${shader.name}`);
		setShader(shader);
	}

	export function setPaused(p: boolean): void {
		paused = p;
		updateShaderSettings({ paused });
	}

	// Get current FPS (kept for external access if needed)
	export function getFps(): number {
		return fps;
	}

	// Update store when settings change
	function updateShaderIndex(newIndex: number) {
		const len = shaders.length;
		newIndex = ((newIndex % len) + len) % len; // wrap both directions
		shaderIndex = newIndex;
		updateShaderSettings({ shaderIndex });
	}

	function cleanupThreeJS() {
		// Cancel animation frame
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		// Dispose texture
		if (texture) {
			texture.dispose();
			texture = null;
		}

		// Dispose material
		if (material) {
			material.dispose();
			material = null;
		}

		// Dispose geometry
		if (geometry) {
			geometry.dispose();
			geometry = null;
		}

		// Dispose mesh
		if (mesh) {
			scene?.remove(mesh);
			mesh = null;
		}

		// Dispose renderer
		if (renderer) {
			renderer.dispose();
			// Remove DOM element
			if (renderer.domElement.parentNode) {
				renderer.domElement.parentNode.removeChild(renderer.domElement);
			}
			renderer = null;
		}

		// Clear scene
		if (scene) {
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					if (object.geometry) object.geometry.dispose();
					if (object.material) {
						if (object.material instanceof Array) {
							object.material.forEach(material => material.dispose());
						} else {
							object.material.dispose();
						}
					}
				}
			});
			scene = null;
		}
		
		camera = null;
	}

	function cleanupAudio() {
		if (audioStream) {
			audioStream.getTracks().forEach(track => track.stop());
			audioStream = null;
		}

		if (audioContext) {
			return audioContext.close().catch(e => console.error("Error closing audio context:", e));
		}
		return Promise.resolve();
	}

	function cleanupTexture() {
		if (texture) {
			texture.dispose();
			texture = null;
		}
	}

	function setShader(shader: Shader): void {
		if (!material || !scene) return;

		const next = UniformsUtils.clone(shader.uniforms);

		// Preserve live uniforms across shader swaps
		next.tDiffuse = { value: texture };
		if (material.uniforms.audioData) next.audioData = material.uniforms.audioData;
		if (material.uniforms.time) next.time = { value: material.uniforms.time.value };
		for (const k of ['p0', 'p1', 'p2', 'p3']) {
			if (material.uniforms[k] && next[k]) next[k].value = material.uniforms[k].value;
		}

		material.uniforms = next;
		material.fragmentShader = shader.fragmentShader;
		material.vertexShader = shader.vertexShader;
		material.needsUpdate = true;
	}

	export function onAxesStateChange(axes: ReadonlyArray<number>): void {
		stepper.onAxesStateChange(axes);
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		stepper.onButtonStateChange(buttonIndex, isPressed);

		if (buttonIndex == SwitchPro.LT) {
			if (!isPressed) return;
			updateShaderIndex(shaderIndex - 1);
		} else if (buttonIndex == SwitchPro.RT) {
			if (!isPressed) return;
			updateShaderIndex(shaderIndex + 1);
		}
	}

	function handleParamsChanged(p0: number, p1: number, p2: number, p3: number) {
		if (!material) return;

		function clamp(v: number, min?: number, max?: number) {
			if (min && v < min) return min;
			if (max && v > max) return max;

			return v;
		}

		p0 = clamp(p0, shader.uniforms.p0.min, shader.uniforms.p0.max);
		p1 = clamp(p1, shader.uniforms.p1.min, shader.uniforms.p1.max);
		p2 = clamp(p2, shader.uniforms.p2.min, shader.uniforms.p2.max);
		p3 = clamp(p3, shader.uniforms.p3.min, shader.uniforms.p3.max);



		if (material.uniforms.p0) material.uniforms.p0.value = p0;
		if (material.uniforms.p1) material.uniforms.p1.value = p1;
		if (material.uniforms.p2) material.uniforms.p2.value = p2;
		if (material.uniforms.p3) material.uniforms.p3.value = p3;
	}

	let audioContext: AudioContext | null = null;
	let analyser: AnalyserNode | null = null;
	let audioData: Float32Array | null = null;
	let audioStream: MediaStream | null = null;
	let lastTime: number = 0;
	let resizeHandler: (() => void) | null = null;
	
	// FPS monitoring
	let fps: number = 0;
	let frameCount: number = 0;
	let lastFpsTime: number = 0;
	let fpsStatus: 'high' | 'medium' | 'low' = 'high';
	
	// Sync with debug mode - FPS shows when debug is on
	$: showFps = $debugMode;
	
	// Update FPS status
	$: {
		if (fps >= 50) {
			fpsStatus = 'high';
		} else if (fps >= 30) {
			fpsStatus = 'medium';
		} else {
			fpsStatus = 'low';
		}
	}

	async function initAudio() {
		try {
			audioContext = new AudioContext();
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioStream = stream;
			const source = audioContext.createMediaStreamSource(stream);
			analyser = audioContext.createAnalyser();
			analyser.fftSize = 1024;
			source.connect(analyser);
			audioData = new Float32Array(analyser.frequencyBinCount);
			lastTime = performance.now();
		} catch (error) {
			console.error("Error initializing audio:", error);
			// Continue without audio - shader will still work for non-audio shaders
		}
	}

	function createTextureFromElement(element: HTMLVideoElement | HTMLImageElement): THREE.Texture | null {
		if (element instanceof HTMLVideoElement) {
			const tex = new THREE.VideoTexture(element);
			tex.minFilter = THREE.LinearFilter;
			tex.magFilter = THREE.LinearFilter;
			return tex;
		} else if (element instanceof HTMLImageElement) {
			const tex = new THREE.Texture(element);
			tex.needsUpdate = true;
			tex.minFilter = THREE.LinearFilter;
			tex.magFilter = THREE.LinearFilter;
			tex.generateMipmaps = false;
			return tex;
		}
		return null;
	}

	function animate() {
		if (!renderer || !scene || !camera || paused) {
			return;
		}

		// Calculate FPS
		const now = performance.now();
		frameCount++;
		
		if (now - lastFpsTime >= 1000) {
			fps = Math.round((frameCount * 1000) / (now - lastFpsTime));
			frameCount = 0;
			lastFpsTime = now;
		}

		if (material?.uniforms.audioData && analyser && audioData) {
			analyser.getFloatFrequencyData(audioData);
			material.uniforms.audioData.value = audioData;
		}
		if (material?.uniforms.time) {
			material.uniforms.time.value += performance.now() - lastTime;
			lastTime = performance.now();
		}
		renderer.render(scene, camera);
		animationFrameId = requestAnimationFrame(animate);
	}

	function setupScene() {
		if (!renderer || !scene || !camera) return;

		// Clean up existing mesh
		if (mesh) {
			scene.remove(mesh);
			mesh = null;
		}

		geometry = new THREE.PlaneGeometry(16, 9);
		
		if (mediaElement) {
			texture = createTextureFromElement(mediaElement);
		} else {
			texture = new THREE.Texture();
		}

		material = new THREE.ShaderMaterial({
			uniforms: {
				...UniformsUtils.clone(shader.uniforms),
				audioData: { value: audioData || new Float32Array(512) }
			},
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader
		});
		material.uniforms.tDiffuse.value = texture;

		mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);
	}

	onMount(async () => {
		await initAudio();

		renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.domElement.style.position = 'fixed';
		renderer.domElement.style.top = '0';
		renderer.domElement.style.left = '0';
		renderer.domElement.style.zIndex = '0';
		document.body.appendChild(renderer.domElement);

		scene = new THREE.Scene();
		
		// Calculate the appropriate field of view to make the content fill the window
		const updateCamera = () => {
			const windowAspect = window.innerWidth / window.innerHeight;
			const contentAspect = 16/9;
			let fov = 45;
			
			if (windowAspect > contentAspect) {
				// Window is wider than content - adjust horizontal FOV
				fov = 2 * Math.atan(Math.tan(45 * Math.PI / 360) * (windowAspect / contentAspect)) * 360 / Math.PI;
			} else {
				// Window is taller than content - adjust vertical FOV
				fov = 2 * Math.atan(Math.tan(45 * Math.PI / 360) * (contentAspect / windowAspect)) * 360 / Math.PI;
			}
			
			const zoomFactor = windowAspect > contentAspect 
				? windowAspect / contentAspect 
				: contentAspect / windowAspect;
			
			const distance = Math.abs(9 / (2 * Math.tan(fov * Math.PI / 360))) / zoomFactor;
			
			if (!camera) {
				camera = new THREE.PerspectiveCamera(fov, windowAspect, 0.1, 1000);
				camera.position.z = distance;
			} else {
				camera.fov = fov;
				camera.aspect = windowAspect;
				camera.position.z = distance;
				camera.updateProjectionMatrix();
			}
		};

		updateCamera();
		setupScene();

		resizeHandler = () => {
			if (renderer) {
				renderer.setSize(window.innerWidth, window.innerHeight);
				updateCamera();
			}
		};
		window.addEventListener('resize', resizeHandler);

		animationFrameId = requestAnimationFrame(animate);
	});

	$: materialInitialized = material !== null;
	let appliedMediaElement: typeof mediaElement = null;

	$: if (mediaElement && materialInitialized && mediaElement !== appliedMediaElement) {
		appliedMediaElement = mediaElement;
		cleanupTexture();

		if (mediaElement instanceof HTMLVideoElement) {
			texture = createTextureFromElement(mediaElement);
		} else if (mediaElement instanceof HTMLImageElement) {
			texture = mediaElement.src.endsWith('.gif')
				? new THREE.Texture()
				: createTextureFromElement(mediaElement);
			if (texture) texture.needsUpdate = true;
		}

		if (texture && material) {
			material.uniforms.tDiffuse.value = texture;
			material.needsUpdate = true;
		}
	}

	onDestroy(async () => {
		console.log('Destroying Three.js scene')

		// Remove resize listener
		if (resizeHandler) {
			window.removeEventListener('resize', resizeHandler);
			resizeHandler = null;
		}

		// Stop animation
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		// Clean up Three.js resources
		cleanupThreeJS();

		// Clean up audio
		await cleanupAudio();
	});
</script>

<Stepper bind:this={stepper} onParamsChange={handleParamsChanged} p0={shader?.uniforms.p0?.value || 0.5} p1={shader?.uniforms.p1?.value || 0.5} p2={shader?.uniforms.p2?.value || 0.5} p3={shader?.uniforms.p3?.value || 0.5} />

{#if showFps}
	<div class="fps-counter" class:high-fps={fpsStatus === 'high'} class:medium-fps={fpsStatus === 'medium'} class:low-fps={fpsStatus === 'low'}>
		<div class="fps-value">{fps}</div>
		<div class="fps-label">FPS</div>
	</div>
{/if}

<style>
	.fps-counter {
		position: fixed;
		top: 20px;
		left: 20px;
		background: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 10px 15px;
		border-radius: 8px;
		font-family: monospace;
		z-index: 10000;
		backdrop-filter: blur(10px);
	}
	
	.fps-value {
		font-size: 24px;
		font-weight: bold;
		margin-bottom: 2px;
	}
	
	.fps-label {
		font-size: 12px;
		opacity: 0.8;
		margin-bottom: 5px;
	}
	
	.fps-counter.high-fps {
		border-left: 3px solid #4CAF50;
	}
	
	.fps-counter.medium-fps {
		border-left: 3px solid #FFC107;
	}
	
	.fps-counter.low-fps {
		border-left: 3px solid #F44336;
	}
</style>
