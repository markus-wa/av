<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from "three";
	import Stepper from '$lib/Stepper.svelte';
	import {
		ChromaticAberration,
		ColorGrading,
		CRT,
		EdgeDetection,
		Pixelation,
		WaveformRipple,
		type Shader
	} from '$lib/shaders/Shaders';
	import SwitchPro from '$lib/Controllers';
	import { UniformsUtils } from 'three';
	import { settings, updateShaderSettings } from '$lib/stores/settings';

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
	const shaders: Shader[] = [WaveformRipple, CRT, ColorGrading, EdgeDetection, ChromaticAberration, Pixelation];

	// Get settings from store
	$: shaderSettings = $settings.shader;
	let shaderIndex = shaderSettings.shaderIndex;
	let paused = shaderSettings.paused;

	$: {
		if (shaderIndex < 0) shaderIndex = shaders.length - 1;
		if (shaderIndex >= shaders.length) shaderIndex = 0;
	}

	$: shader = shaders[shaderIndex];

	export function setPaused(p: boolean): void {
		paused = p;
		updateShaderSettings({ paused });
	}

	// Update store when settings change
	function updateShaderIndex(newIndex: number) {
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

		cleanupTexture();

		material.fragmentShader = shader.fragmentShader;
		material.vertexShader = shader.vertexShader;
		material.uniforms = Object.assign(material.uniforms, UniformsUtils.clone(shader.uniforms));
		material.uniforms.tDiffuse.value = texture;
		material.needsUpdate = true;
	}

	$: {
		if (shader) {
			setShader(shader);
		}
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
		if (!renderer || !scene || !camera || !material) return;

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

	$: if (mediaElement && materialInitialized) {
			cleanupTexture();
			
			if (mediaElement instanceof HTMLVideoElement) {
				texture = createTextureFromElement(mediaElement);
			} else if (mediaElement instanceof HTMLImageElement) {
				if (mediaElement.src.endsWith('.gif')) {
					texture = new THREE.Texture();
				} else {
					texture = createTextureFromElement(mediaElement);
					if (texture) {
						texture.needsUpdate = true;
					}
				}
			}
			
			if (texture && material) {
				material.uniforms.tDiffuse.value = texture;
				material.needsUpdate = true;
			}
		}

	onDestroy(async () => {
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
