export interface Shader {
	uniforms: { [key: string]: { value: any } };
	vertexShader: string;
	fragmentShader: string;
}

export const CRT = {
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.05 }, // scanline density
		p1: { value: 0.01 }, // scanline speed
		p2: { value: 0.05 }, // scanline intensity
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
				float scanline = sin(uv.y * (p0 * 2000.0) + time * (3.0 + p1 * 160.0)) * p2;
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

export const Pixelation = {
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.5 },
		p1: { value: 0.5 },
		p2: { value: 0.5 },
		p3: { value: 0.5 }
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
    uniform float p0;

    void main() {
      vec2 uv = vUv;
      float p00 = mix(0.001, 0.02, p0);
      vec2 resolution = vec2(textureSize(tDiffuse, 0));
      float aspectRatio = resolution.x / resolution.y;
      vec2 pixelSize = vec2(p00 / aspectRatio, p00);
      vec2 pixel = floor(uv / pixelSize) * pixelSize;
      vec4 color = texture2D(tDiffuse, pixel);
      gl_FragColor = color;
    }
  `
};

export const ChromaticAberration = {
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.015 },
		p1: { value: 0.5 },
		p2: { value: 0.5 },
		p3: { value: 0.5 }
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
    uniform float p0;

    void main() {
      vec2 uv = vUv;
      float offset = p0;
      // Offset red and blue channels in opposite directions
      float r = texture2D(tDiffuse, uv + vec2(offset, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(offset, 0.0)).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};

export const EdgeDetection = {
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.1 },
		p1: { value: 0.5 },
		p2: { value: 0.5 },
		p3: { value: 0.5 }
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
    uniform float p0;

    void main() {
      float edgeThreshold = mix(0.01, 1.0, p0);
      vec2 resolution = vec2(textureSize(tDiffuse, 0));
      vec2 texel = vec2(1.0) / resolution;
      float Gx = 0.0;
      float Gy = 0.0;
      mat3 sobel_x = mat3(-1, 0, 1, -2, 0, 2, -1, 0, 1);
      mat3 sobel_y = mat3(-1, -2, -1, 0, 0, 0, 1, 2, 1);

      for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
          vec3 colorSample = texture2D(tDiffuse, vUv + vec2(i, j) * texel).rgb;
          float intensity = dot(colorSample, vec3(0.299, 0.587, 0.114));
          Gx += intensity * sobel_x[i+1][j+1];
          Gy += intensity * sobel_y[i+1][j+1];
        }
      }
      float edge = length(vec2(Gx, Gy));
      gl_FragColor = edge > edgeThreshold ? vec4(vec3(1.0), 1.0) : texture2D(tDiffuse, vUv);
    }
  `
};