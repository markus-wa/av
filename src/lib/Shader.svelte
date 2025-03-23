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
	} from '$lib/Shaders';
	import SwitchPro from '$lib/Controllers';
	import { UniformsUtils } from 'three';

	export let mediaElement: HTMLVideoElement | HTMLImageElement | null = null;

	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let material: THREE.ShaderMaterial;
	let animationFrameId: number;
	let texture: THREE.Texture | null = null;
	let stepper: Stepper;
	const shaders: Shader[] = [WaveformRipple, CRT, ColorGrading, EdgeDetection, ChromaticAberration, Pixelation];
	let shaderIndex = 0;
	let audioContext: AudioContext;
	let analyser: AnalyserNode;
	let audioData: Float32Array;
	let lastTime: number = performance.now();

	$: {
		if (shaderIndex < 0) shaderIndex = shaders.length - 1;
		if (shaderIndex >= shaders.length) shaderIndex = 0;
	}

	$: shader = shaders[shaderIndex];

	function setShader(shader: Shader): void {
		if (!material) return;

		material.fragmentShader = shader.fragmentShader;
		material.vertexShader = shader.vertexShader;
		material.uniforms = Object.assign(material.uniforms, UniformsUtils.clone(shader.uniforms));
		material.uniforms.tDiffuse.value = texture;
		material.needsUpdate = true;
	}

	$: {
		console.log("Shader:", shader);

		setShader(shader);
	}

	export function onAxesStateChange(axes: ReadonlyArray<number>): void {
		stepper.onAxesStateChange(axes);
	}

	export function onButtonStateChange(buttonIndex: number, isPressed: boolean): void {
		stepper.onButtonStateChange(buttonIndex, isPressed);

		if (buttonIndex == SwitchPro.LT) {
			if (!isPressed) return;

			shaderIndex--;
		} else if (buttonIndex == SwitchPro.RT) {
			if (!isPressed) return;

			shaderIndex++;
		}
	}

	function handleParamsChanged(p0: number, p1: number, p2: number, p3: number) {
		if (!material) return;

		if (material.uniforms.p0)	material.uniforms.p0.value = p0;
		if (material.uniforms.p1)	material.uniforms.p1.value = p1;
		if (material.uniforms.p2)	material.uniforms.p2.value = p2;
		if (material.uniforms.p3)	material.uniforms.p3.value = p3;
	}

	async function initAudio() {
		audioContext = new AudioContext();
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		const source = audioContext.createMediaStreamSource(stream);
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 1024;
		source.connect(analyser);
		audioData = new Float32Array(analyser.frequencyBinCount);
	}

	function animate() {
		if (material.uniforms.audioData) {
			analyser.getFloatFrequencyData(audioData);
			material.uniforms.audioData.value = audioData;
		}
		if (material.uniforms.time) {
			material.uniforms.time.value += lastTime - performance.now();
			lastTime = performance.now();
		}
		renderer!.render(scene, camera);
		animationFrameId = requestAnimationFrame(animate);
	}

	onMount(async () => {
		await initAudio();

		renderer = new THREE.WebGLRenderer({ alpha: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		document.body.appendChild(renderer.domElement);

		scene = new THREE.Scene();
		
		// Calculate the appropriate field of view to make the content fill the window
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
		
		camera = new THREE.PerspectiveCamera(fov, windowAspect, 0.1, 1000);
		
		// Calculate the exact zoom factor needed based on aspect ratios
		const zoomFactor = windowAspect > contentAspect 
			? windowAspect / contentAspect  // Window is wider - zoom based on width ratio
			: contentAspect / windowAspect; // Window is taller - zoom based on height ratio
		
		// Apply the zoom factor to the camera distance
		const distance = Math.abs(9 / (2 * Math.tan(fov * Math.PI / 360))) / zoomFactor;
		camera.position.z = distance;

		const geometry = new THREE.PlaneGeometry(16, 9);
		if (mediaElement) {
			if (mediaElement instanceof HTMLVideoElement) {
				texture = new THREE.VideoTexture(mediaElement);
			} else {
				texture = new THREE.Texture(mediaElement);
			}
		} else {
			texture = new THREE.Texture();
		}
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;

		material = new THREE.ShaderMaterial({
			uniforms: {
				...UniformsUtils.clone(shader.uniforms),
				audioData: { value: audioData }
			},
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader
		});
		material.uniforms.tDiffuse.value = texture;

		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		animate();
		console.log(audioData);

		window.addEventListener('resize', () => {
			renderer!.setSize(window.innerWidth, window.innerHeight);
			
			// Recalculate FOV on resize
			const windowAspect = window.innerWidth / window.innerHeight;
			const contentAspect = 16/9;
			let fov = 45;
			
			if (windowAspect > contentAspect) {
				fov = 2 * Math.atan(Math.tan(45 * Math.PI / 360) * (windowAspect / contentAspect)) * 360 / Math.PI;
			} else {
				fov = 2 * Math.atan(Math.tan(45 * Math.PI / 360) * (contentAspect / windowAspect)) * 360 / Math.PI;
			}
			
			camera.fov = fov;
			camera.aspect = windowAspect;
			
			// Recalculate zoom factor and camera distance on resize
			const zoomFactor = windowAspect > contentAspect 
				? windowAspect / contentAspect
				: contentAspect / windowAspect;
			
			const distance = Math.abs(9 / (2 * Math.tan(fov * Math.PI / 360))) / zoomFactor;
			camera.position.z = distance;
			
			camera.updateProjectionMatrix();
		});
	});

	$: materialInitialized = material !== undefined;

	$: if (mediaElement && materialInitialized) {
			if (mediaElement instanceof HTMLVideoElement) {
				texture = new THREE.VideoTexture(mediaElement);
				texture.minFilter = THREE.LinearFilter;
				texture.magFilter = THREE.LinearFilter;
				material.uniforms.tDiffuse.value = texture;
				material.needsUpdate = true;
			} else if (mediaElement instanceof HTMLImageElement) {
				console.log(mediaElement.src);
				if (mediaElement.src.endsWith('.gif')) {
					texture = new THREE.Texture();
					material.uniforms.tDiffuse.value = texture;
					material.needsUpdate = true;
				} else {
					mediaElement.onload = () => {
						texture = new THREE.Texture(mediaElement);
						texture.needsUpdate = true;
						texture.minFilter = THREE.LinearFilter;
						texture.magFilter = THREE.LinearFilter;
						texture.generateMipmaps = false; // Avoid generating mipmaps for non-power-of-two textures
						material.uniforms.tDiffuse.value = texture;
						material.needsUpdate = true;
					};
				}
			}
	}

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			cancelAnimationFrame(animationFrameId);
		}
		if (renderer) {
			renderer.dispose();
		}
		if (audioContext) {
			audioContext.close();
		}
	});
</script>

<Stepper bind:this={stepper} onParamsChange={handleParamsChanged} p0={shader.uniforms.p0?.value || 0.5} p1={shader.uniforms.p1?.value || 0.5} p2={shader.uniforms.p2?.value || 0.5} p3={shader.uniforms.p3?.value || 0.5} />