<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from "three";
	import Stepper from '$lib/Stepper.svelte';
	import { ColorGrading, CRT, type Shader } from '$lib/Shaders';
	import SwitchPro from '$lib/Controllers';
	import { UniformsUtils } from 'three';

	export let videoElement: HTMLVideoElement | null = null;

	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let material: THREE.ShaderMaterial;
	let animationFrameId: number;
	let texture: THREE.Texture | null = null;
	let stepper: Stepper;
	const shaders: Shader[] = [CRT, ColorGrading];
	let shaderIndex = 0;

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

		material.uniforms.p0.value = p0;
		material.uniforms.p1.value = p1;
		material.uniforms.p2.value = p2;
		material.uniforms.p3.value = p3;
	}

	onMount(async () => {
		renderer = new THREE.WebGLRenderer({ alpha: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		document.body.appendChild(renderer.domElement);

		scene = new THREE.Scene();
		camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
		camera.position.z = 1;

		const geometry = new THREE.PlaneGeometry(16, 9);
		texture = videoElement ? new THREE.VideoTexture(videoElement) : new THREE.Texture();
		texture.minFilter = THREE.LinearFilter;
		texture.magFilter = THREE.LinearFilter;

		material = new THREE.ShaderMaterial({
			uniforms: UniformsUtils.clone(shader.uniforms),
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader
		});
		material.uniforms.tDiffuse.value = texture;

		const mesh = new THREE.Mesh(geometry, material);
		scene.add(mesh);

		function animate() {
			animationFrameId = requestAnimationFrame(animate);
			material.uniforms.time.value += 0.02;
			renderer!.render(scene, camera);
		}
		animate();

		window.addEventListener('resize', () => {
			renderer!.setSize(window.innerWidth, window.innerHeight);
			camera.aspect = window.innerWidth / window.innerHeight;
			camera.updateProjectionMatrix();
		});
	});

	$: if (videoElement && texture) {
		texture.image = videoElement;
		texture.needsUpdate = true;
		if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0 && renderer) {
			const aspectRatio = window.innerWidth / window.innerHeight;
			renderer.setSize(window.innerWidth, window.innerHeight);
			camera.aspect = aspectRatio;
			camera.updateProjectionMatrix();
		}
	}

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			cancelAnimationFrame(animationFrameId);
		}
		if (renderer) {
			renderer.dispose();
		}
	});
</script>

<Stepper bind:this={stepper} onParamsChange={handleParamsChanged} p0={shader.uniforms.p0.value} p1={shader.uniforms.p1.value} p2={shader.uniforms.p2.value} p3={shader.uniforms.p3.value} />
