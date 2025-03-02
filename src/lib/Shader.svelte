<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from "three";

	export let videoElement: HTMLVideoElement | null = null;

	let container: HTMLDivElement | null = null;
	let renderer: THREE.WebGLRenderer | null = null;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let material: THREE.ShaderMaterial;
	let animationFrameId: number;
	let texture: THREE.Texture | null = null;

	const crtShader = {
		uniforms: {
			tDiffuse: { value: null },
			time: { value: 0.0 }
		},
		vertexShader: `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			varying vec2 vUv;
			uniform sampler2D tDiffuse;
			uniform float time;
			void main() {
				vec2 uv = vUv;
				float scanline = sin(uv.y * 800.0 + time * 5.0) * 0.1;
				vec4 color = texture2D(tDiffuse, uv);
				color.rgb += scanline;
				color.rgb *= vec3(1.0, 0.9, 0.8); // Slight tint
				gl_FragColor = color;
			}
		`
	};

	onMount(async () => {
		if (!container) return;

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
			uniforms: { tDiffuse: { value: texture }, time: { value: 0 } },
			vertexShader: crtShader.vertexShader,
			fragmentShader: crtShader.fragmentShader
		});

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

	// Watch for videoElement updates
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

<style>
    .crt-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        z-index: 1;
        pointer-events: none;
    }
</style>

<div bind:this={container} class="crt-container"></div>
