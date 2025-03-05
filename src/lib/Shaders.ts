import { Vector2 } from 'three';

export interface Shader {
	uniforms: { [key: string]: { value: any } };
	vertexShader: string;
	fragmentShader: string;
}

export const CRT = {
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.1 }, // scanline density
		p1: { value: 0.01 }, // scanline speed
		p2: { value: 0.1 }, // scanline intensity
		p3: { value: 0 } // colour tint
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
			uniform float p0, p1, p2, p3;

			void main() {
				vec2 uv = vUv;
				float scanline = sin(uv.y * (p0 * 20000.0) + time * (3.0 + p1 * 160.0)) * p2;
				vec4 color = texture2D(tDiffuse, uv);
				color.rgb += scanline;
				color.rgb *= vec3(1.0, 0.9 + p3 * 0.2, 0.8 - p3 * 0.2);
				gl_FragColor = color;
			}
		`
}

export const ColorGrading = {
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 1.0 }, // Contrast (0-1)
		p1: { value: 0.5 }, // Hue Shift (0-1)
		p2: { value: 1.0 }, // Saturation (0-1)
		p3: { value: 0.5 }  // Tint (0-1, neutral at 0.5)
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
			uniform float p0, p1, p2, p3;

			vec3 applyContrast(vec3 color, float contrast) {
				float c = contrast * 2.0;
				return 0.5 + (color - 0.5) * c;
			}

			vec3 applyHueShift(vec3 color, float hue) {
				float angle = (hue - 0.5) * 6.28318; // Scale to 0-2π
				float cosA = cos(angle);
				float sinA = sin(angle);
				mat3 hueRotation = mat3(
					vec3(0.299, 0.587, 0.114) + vec3(0.701, -0.587, -0.114) * cosA + vec3(0.168, -0.328, 1.250) * sinA,
					vec3(0.299, 0.587, 0.114) + vec3(-0.299, 0.413, -0.114) * cosA + vec3(0.325, 0.088, -0.329) * sinA,
					vec3(0.299, 0.587, 0.114) + vec3(-0.300, -0.588, 0.886) * cosA + vec3(-1.250, 1.130, 0.114) * sinA
				);
				return color * hueRotation;
			}

			vec3 applySaturation(vec3 color, float saturation) {
				float luma = dot(color, vec3(0.299, 0.587, 0.114));
				return mix(vec3(luma), color, pow(saturation, 2.0));
			}

			vec3 applyTint(vec3 color, float tint) {
				float t = (tint - 0.5) * 2.0;
				vec3 tintColor = vec3(1.0 + t, 1.0, 1.0 - t);
				return mix(color, tintColor * color, abs(t));
			}

			void main() {
				vec4 color = texture2D(tDiffuse, vUv);
				color.rgb = applyContrast(color.rgb, p0);
				color.rgb = applyHueShift(color.rgb, p1);
				color.rgb = applySaturation(color.rgb, p2);
				color.rgb = applyTint(color.rgb, p3);
				gl_FragColor = color;
			}
		`
};
