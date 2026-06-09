export interface Shader {
	name: string;
	uniforms: { [key: string]: { value: any; min?: number; max?: number } };
	vertexShader: string;
	fragmentShader: string;
}

export const CRT = {
	name: 'CRT',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.1 }, // scanline density
		p1: { value: 1.0 }, // scanline speed
		p2: { value: 0.1 }, // scanline intensity
		p3: { value: 1.0 } // colour tint
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
				float scanline = sin(uv.y * (p0 * 2000.0) + time * 0.1 * (p1 - 0.5)) * p2;
				vec4 color = texture2D(tDiffuse, uv);
				color.rgb += scanline;
				color.rgb *= vec3(1.0, 0.9 + p3 * 0.2, 0.8 - p3 * 0.2);
				gl_FragColor = color;
			}
		`
};

export const ColorGrading = {
	name: 'ColorGrading',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.0 }, // Contrast (0=none, 1=max)
		p1: { value: 0.0 }, // Hue Shift (0=none, 1=max)
		p2: { value: 0.0 }, // Saturation (0=none, 1=max)
		p3: { value: 0.0 } // Tint (0=none, 1=max)
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
				// 0 and 1 = original, 0.5 = max contrast
				float effect = 4.0 * contrast * (1.0 - contrast);
				return mix(color, 0.5 + (color - 0.5) * 2.0, effect);
			}

			vec3 applyHueShift(vec3 color, float hue) {
				// 0 and 1 = original (360°), 0.5 = 180° shift
				float angle = hue * 6.28318;
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
				// 0 and 1 = original, 0.5 = max boost
				float effect = saturation * (1.0 - saturation) * 4.0;
				float luma = dot(color, vec3(0.299, 0.587, 0.114));
				return luma + (color - vec3(luma)) * (1.0 + effect);
			}

			vec3 applyTint(vec3 color, float tint) {
				// 0 and 1 = original, 0.5 = max tint
				float tSin = sin(tint * 3.14159265359);
				vec3 tintColor = vec3(1.0 + tSin, 1.0, 1.0 - tSin);
				return mix(color, tintColor * color, tint);
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
	name: 'Pixelation',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.5 }, // Pixelation amount
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
      float p00 = mix(0.001, 0.1, p0);
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
	name: 'ChromaticAberration',
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
	name: 'Edge Detection',
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
      float edgeThreshold = mix(0.01, 1.0, 1.0 - p0);
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

export const WaveformRipple = {
	name: 'WaveformRipple',
	uniforms: {
		tDiffuse: { value: null },
		audioData: { value: new Float32Array(512) },
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
		uniform float audioData[512];
		uniform float time;

		void main() {
			vec2 uv = vUv;
			vec4 color = texture2D(tDiffuse, uv);

			// Create ripples based on audio intensity
			float centerX = 0.5;
			float centerY = 0.5;
			float dist = distance(uv, vec2(centerX, centerY));

			// Get audio intensity from multiple frequency bands
			float intensity = 0.0;
			for(int i = 0; i < 8; i++) {
				int binIndex = int(floor(float(i) * 64.0));
				float dbValue = audioData[binIndex];
				float normalizedValue = clamp((dbValue + 140.0) / 140.0, 0.0, 1.0);
				intensity += normalizedValue;
			}
			intensity /= 8.0;

			// Apply non-linear response to intensity
			// Using power function to make it less sensitive at low volumes
			// but more dramatic at high volumes
			float threshold = 0.05; // Lower threshold for earlier effect
			float power = 1.5;    // Less aggressive power for more linear response
			float scaledIntensity = max(0.0, (intensity - threshold) / (1.0 - threshold));
			float nonLinearIntensity = pow(scaledIntensity, power);

			// Create rippling effect with non-linear intensity
			float ripple = sin(dist * 20.0 - time * 2.0) * nonLinearIntensity * 0.8; // Increased ripple intensity
			vec2 distortedUV = uv + vec2(ripple, ripple);

			// Mix original color with distorted version using non-linear intensity
			vec4 distortedColor = texture2D(tDiffuse, distortedUV);
			color = mix(color, distortedColor, nonLinearIntensity); // Increased color mix intensity

			gl_FragColor = color;
		}
	`
};

// RGB Split Glitch Effect
export const Glitch = {
	name: 'Glitch',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.5 }, // RGB Split Intensity (0-1)
		p1: { value: 0.5 }, // Block Glitch Frequency (0-1)
		p2: { value: 0.5 }, // Color Chaos / Noise (0-1)
		p3: { value: 0.5 } // Scanline / Artifact Intensity (0-1)
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

		// Better pseudo-random with time variation
		float rand(vec2 co) {
			return fract(sin(dot(co.xy, vec2(12.9898, 78.233) + time * 0.1)) * 43758.5453);
		}

		// 2D noise for more organic patterns
		float noise(vec2 st) {
			vec2 i = floor(st);
			vec2 f = fract(st);
			
			// Four corners in unit square
			float a = rand(i);
			float b = rand(i + vec2(1.0, 0.0));
			float c = rand(i + vec2(0.0, 1.0));
			float d = rand(i + vec2(1.0, 1.0));
			
			vec2 u = f * f * (3.0 - 2.0 * f);
			return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
		}

		void main() {
			vec2 uv = vUv;
			
			// Base color
			vec4 color = texture2D(tDiffuse, uv);
			vec4 finalColor = color;
			
			// Time-based seed - use fract to prevent accumulation issues
			float t = fract(time * 0.1);
			
			// === RGB Split (p0) ===
			// Controls channel separation - the primary glitch effect
			float splitScale = p0 * p0; // Quadratic for finer control at low values
			
			// Horizontal RGB offsets
			float offsetR = (rand(uv + t * 1.3) - 0.5) * 0.05 * splitScale;
			float offsetG = (rand(uv + t * 1.7) - 0.5) * 0.04 * splitScale;
			float offsetB = (rand(uv + t * 2.1) - 0.5) * 0.06 * splitScale;
			
			// Vertical RGB offsets
			float offsetRY = (rand(uv + t * 0.7) - 0.5) * 0.03 * splitScale;
			float offsetGY = (rand(uv + t * 1.1) - 0.5) * 0.02 * splitScale;
			float offsetBY = (rand(uv + t * 1.5) - 0.5) * 0.04 * splitScale;
			
			// Sample each channel with offsets
			float r = texture2D(tDiffuse, uv + vec2(offsetR, offsetRY)).r;
			float g = texture2D(tDiffuse, uv + vec2(offsetG, offsetGY)).g;
			float b = texture2D(tDiffuse, uv + vec2(offsetB, offsetBY)).b;
			finalColor.rgb = vec3(r, g, b);
			
			// === Block Glitch (p1) ===
			// Controls frequency and intensity of block-based artifacts
			// Shows rectangles from different parts of the scene with partial opacity
			float blockIntensity = p1 * p1;
			
			if (blockIntensity > 0.001) {
				// Number of blocks across screen (higher = smaller blocks)
				float blockDensity = 5.0 + p1 * 25.0;
				vec2 blockCoord = floor(uv * blockDensity);
				
				// Random value for this block - use fract time
				float blockRand = rand(blockCoord + vec2(fract(t * 0.3)));
				
				// Trigger block glitch based on p1
				if (blockRand < 0.15 * blockIntensity) {
					// Sample from a different rectangular region of the scene
					// Use rand of blockCoord to get consistent but different source region
					vec2 sourceOffset = vec2(
						fract(rand(blockCoord) * 0.7 + 0.1),
						fract(rand(blockCoord + vec2(1.0, 0.0)) * 0.7 + 0.1)
					);
					
					// Define the size of the source rectangle (as fraction of screen)
					vec2 blockSize = vec2(0.05, 0.1) * (0.3 + blockIntensity * 0.7);
					
					// Map current UV within block to source rectangle UV
					vec2 uvInBlock = fract(uv * blockDensity);
					vec2 glitchUV = sourceOffset + uvInBlock * blockSize;
					
					// Clamp to valid texture coordinates
					glitchUV = clamp(glitchUV, 0.0, 1.0);
					
					// Sample from the source rectangle
					vec4 glitchSample = texture2D(tDiffuse, glitchUV);
					
					// Apply color chaos (p2) to the glitch rectangle
					float rectChaos = p2 * p2;
					if (rectChaos > 0.01) {
						// Add RGB split to the glitch sample based on p2
						float chaosOffsetR = (rand(glitchUV + vec2(t * 1.3)) - 0.5) * 0.03 * rectChaos;
						float chaosOffsetG = (rand(glitchUV + vec2(t * 1.7)) - 0.5) * 0.03 * rectChaos;
						float chaosOffsetB = (rand(glitchUV + vec2(t * 2.1)) - 0.5) * 0.03 * rectChaos;
						glitchSample.r = texture2D(tDiffuse, glitchUV + vec2(chaosOffsetR, 0.0)).r;
						glitchSample.g = texture2D(tDiffuse, glitchUV + vec2(chaosOffsetG, 0.0)).g;
						glitchSample.b = texture2D(tDiffuse, glitchUV + vec2(chaosOffsetB, 0.0)).b;
						
						// Random color tint on rectangle based on p2
						if (rand(blockCoord + vec2(2.0)) < rectChaos * 0.5) {
							glitchSample.rgb *= vec3(1.0, 0.7, 0.3);
						}
					}
					
					// Partial opacity - blend with original, controlled by p1
					float opacity = 0.3 + p1 * 0.7;
					finalColor = mix(finalColor, glitchSample, opacity);
				}
				
				// Color inversion in blocks (less frequent)
				if (blockRand < 0.05 * blockIntensity) {
					finalColor.rgb = 1.0 - finalColor.rgb;
				}
			}
			
			// === Color Chaos / Noise (p2) ===
			// Controls color channel manipulation and noise
			float chaos = p2 * p2;
			
			// Chromatic aberration at edges
			vec2 center = vec2(0.5);
			float distFromCenter = distance(uv, center);
			float edgeBoost = smoothstep(0.3, 0.8, distFromCenter);
			
			finalColor.r += offsetR * edgeBoost * chaos * 2.0;
			finalColor.g += offsetG * edgeBoost * chaos * 2.0;
			finalColor.b += offsetB * edgeBoost * chaos * 2.0;
			
			// Global color noise
			float globalNoise = (noise(uv * 10.0 + fract(t * 0.3)) - 0.5) * 0.08 * chaos;
			finalColor.rgb += vec3(globalNoise);
			
			// Color channel swapping based on chaos
			if (chaos > 0.1) {
				float swapProb = chaos * 0.5;
				if (rand(uv + vec2(fract(t * 2.0))) < swapProb) {
					finalColor.rgb = finalColor.gbr; // Swap R and B
				}
				if (rand(uv + vec2(fract(t * 3.0))) < swapProb * 0.5) {
					finalColor.rgb = finalColor.bgr; // Full rotation
				}
			}
			
			// === Scanline / Artifact Intensity (p3) ===
			// Controls horizontal artifacts and scanline effects
			float artifactIntensity = p3 * p3;
			
			// Scanline effect - horizontal lines
			float scanlinePos = fract(uv.y * 200.0 + fract(t * 10.0));
			float scanline = smoothstep(0.0, 0.02, scanlinePos) * artifactIntensity * 2.0;
			if (scanline > 0.0) {
				finalColor.rgb *= vec3(1.0 - scanline, 0.9, 0.8);
			}
			
			// Random pixel artifacts
			if (rand(uv + vec2(fract(t * 5.0))) < 0.01 * artifactIntensity) {
				finalColor.rgb *= vec3(1.0, 0.5, 0.0) * (0.5 + 0.5 * sin(fract(t * 20.0) * 6.28318));
			}
			
			// Vertical stripe artifacts
			if (rand(vec2(uv.x * 0.1, fract(t))) < 0.02 * artifactIntensity) {
				finalColor.rgb = mix(finalColor.rgb, vec3(0.0), 0.3 * artifactIntensity);
			}
			
			gl_FragColor = finalColor;
		}
	`
};

export const NeonGrid = {
	name: 'Neon Grid',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.001 }, // grid scale / perspective
		p1: { value: 0.3 }, // scroll speed
		p2: { value: 1.0 }, // vanishing point height
		p3: { value: 1.0 } // neon hue intensity
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

    const vec3 NEON_PINK   = vec3(1.0, 0.4, 0.85);
    const vec3 NEON_PURPLE = vec3(0.6, 0.4, 0.9);

    void main() {
      vec2 uv = vUv;
      float horizon = (1.0 - p3);
      
      // Get base color from texture
      vec4 baseColor = texture2D(tDiffuse, uv);

      float depth = (horizon - uv.y);
      float persp = 1.0 / (depth + 0.04);
      float gx = (uv.x - 0.5) * persp * (4.0 + p0 * 8.0);
      float gz = persp * (2.0 + p0 * 4.0) + time * p1 * 0.008;
      vec2 g = vec2(gx, gz);

      // distance to nearest line in each axis, in cells
      vec2 grids = abs(fract(g) - 0.5);
      // Fixed line width instead of fwidth
      vec2 lineW = vec2(0.015);

      // sharp line core
      vec2 core2 = 1.0 - smoothstep(vec2(0.0), lineW * 1.5, grids);
      float core = clamp(core2.x + core2.y, 0.0, 1.0);

      // soft bright glow falloff around the lines
      vec2 glow2 = 1.0 - smoothstep(vec2(0.0), lineW * 6.0 + 0.03, grids);
      float glow = clamp(glow2.x + glow2.y, 0.0, 1.0);

      vec3 gcol = mix(NEON_PURPLE, NEON_PINK, clamp(uv.y / horizon, 0.0, 1.0));
      // Apply neon as subtle hue on grid, mix with base
      float gridMask = core + glow * 0.4;
      vec3 neonGlow = gcol * gridMask * p2 * 0.7;
      
      vec3 outCol = baseColor.rgb + neonGlow;
      outCol = min(outCol, vec3(1.0));

      gl_FragColor = vec4(outCol, 1.0);
    }
  `
};

export const Feedback = {
	name: 'Feedback',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.5 }, // Feedback amount (0-1)
		p1: { value: 0.5 }, // Zoom factor
		p2: { value: 0.0 }, // Rotation angle
		p3: { value: 0.5 } // Distortion amount
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

		// 2D rotation matrix
		mat2 rotate2D(float angle) {
			float s = sin(angle);
			float c = cos(angle);
			return mat2(c, -s, s, c);
		}

		void main() {
			vec2 uv = vUv;
			vec2 center = vec2(0.5);
			
			// Calculate vector from center
			vec2 dir = uv - center;
			
			// Apply rotation based on p2 - use fract to prevent accumulation
			float rotation = p2 * 6.28318; // 0-1 -> 0-2π
			mat2 rotationMatrix = rotate2D(rotation * fract(time * 0.1) * 0.1);
			vec2 rotatedDir = dir * rotationMatrix;
			
			// Apply zoom
			float zoom = 1.0 + p1 * 0.5;
			vec2 zoomedDir = rotatedDir * zoom;
			
			// Calculate feedback UV
			vec2 feedbackUV = center + zoomedDir;
			
			// Add distortion
			if (p3 > 0.0) {
				// Wave distortion - use fract to prevent accumulation
				feedbackUV.x += sin(feedbackUV.y * 20.0 + fract(time * 0.5)) * p3 * 0.05;
				feedbackUV.y += cos(feedbackUV.x * 20.0 + fract(time * 0.5)) * p3 * 0.05;
				
				// Clip to [0,1] range
				feedbackUV = clamp(feedbackUV, 0.0, 1.0);
			}
			
			// Get original color
			vec4 originalColor = texture2D(tDiffuse, uv);
			
			// Get feedback color (recursive texture lookup)
			vec4 feedbackColor = texture2D(tDiffuse, feedbackUV);
			
			// Blend based on feedback amount
			vec4 color = mix(originalColor, feedbackColor, p0);
			
			// Invert feedback for interesting effect
			feedbackColor.rgb = 1.0 - feedbackColor.rgb;
			
			// Add inverted feedback
			color = mix(color, feedbackColor, p0 * 0.5);
			
			// Add time-based pulsing - use fract to prevent accumulation
			float pulse = sin(fract(time * 0.1) * 20.0) * 0.5 + 0.5;
			color.rgb *= mix(vec3(1.0), vec3(1.0, 0.8, 0.6), p0 * pulse * 0.3);
			
			gl_FragColor = color;
		}
	`
};
