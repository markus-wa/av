export interface Shader {
	name: string;
	uniforms: { [key: string]: { value: any, min?: number, max?: number } };
	vertexShader: string;
	fragmentShader: string;
}

export const CRT = {
	name: 'CRT',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.1 }, // scanline density
		p1: { value: 0 }, // scanline speed
		p2: { value: 0.1 }, // scanline intensity
		p3: { value: 1 } // colour tint
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
}

export const ColorGrading = {
	name: 'ColorGrading',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 1.0, min: 0.2 }, // Contrast (0-1)
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
	name: 'Pixelation',
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
		p0: { value: 0.5 },   // Glitch intensity (0-1)
		p1: { value: 0.5 },   // Glitch frequency (0-1)
		p2: { value: 0.5 },   // Color chaos (0-1)
		p3: { value: 0.3 }    // Block distortion (0-1)
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
			
			// Global glitch parameters
			float intensity = p0;
			float frequency = 0.2 + p1 * 2.0;
			float chaos = p2;
			float blockDistort = p3;

			// Time-based seed for randomness
			float t = time * frequency;
			
			// Create per-pixel random values that change over time
			float seed = rand(uv + t);
			
			// RGB split with time-varying chaotic offsets
			float offsetR = (rand(uv + t * 1.3) - 0.5) * 0.05 * intensity * (0.5 + chaos);
			float offsetG = (rand(uv + t * 1.7) - 0.5) * 0.04 * intensity * (0.6 + chaos * 0.4);
			float offsetB = (rand(uv + t * 2.1) - 0.5) * 0.06 * intensity * (0.4 + chaos * 0.6);
			
			// Also add vertical offsets for more distortion
			float offsetRY = (rand(uv + t * 0.7) - 0.5) * 0.03 * intensity * chaos;
			float offsetGY = (rand(uv + t * 1.1) - 0.5) * 0.02 * intensity * chaos;
			float offsetBY = (rand(uv + t * 1.5) - 0.5) * 0.04 * intensity * chaos;
			
			// Sample each channel with different offsets
			float r = texture2D(tDiffuse, uv + vec2(offsetR, offsetRY)).r;
			float g = texture2D(tDiffuse, uv + vec2(offsetG, offsetGY)).g;
			float b = texture2D(tDiffuse, uv + vec2(offsetB, offsetBY)).b;
			
			// Block distortion - random rectangular blocks that glitch
			vec4 finalColor = vec4(r, g, b, 1.0);
			
			if (blockDistort > 0.0) {
				// Divide screen into blocks of random size
				float blockDensity = 3.0 + p1 * 20.0;
				vec2 blockCoord = floor(uv * blockDensity);
				
				// Add time-based randomness to block positions
				float blockRand = rand(blockCoord + vec2(t * 0.3));
				
				// Occasionally create a glitch block
				if (blockRand < 0.05 * blockDistort) {
					// Random offset for this block
					float blockOffsetX = (rand(blockCoord + vec2(t, 0.0)) - 0.5) * 0.2 * blockDistort;
					float blockOffsetY = (rand(blockCoord + vec2(0.0, t)) - 0.5) * 0.2 * blockDistort;
					
					// Sample from a random position
					vec2 glitchUV = uv + vec2(blockOffsetX, blockOffsetY);
					vec4 glitchSample = texture2D(tDiffuse, glitchUV);
					
					// Mix with original
					float mixAmount = 0.3 + rand(blockCoord + vec2(t * 0.5)) * 0.7;
					finalColor = mix(finalColor, glitchSample, mixAmount * blockDistort);
				}
				
				// Sometimes invert colors in a block
				if (rand(blockCoord + vec2(t * 0.7)) < 0.02 * blockDistort) {
					finalColor.rgb = 1.0 - finalColor.rgb;
				}
				
				// Add scanline-like artifacts
				if (rand(vec2(uv.x, t * 0.5)) < 0.03 * blockDistort) {
					finalColor.rgb *= vec3(1.0, 0.7, 0.3) * (0.5 + 0.5 * sin(t * 10.0));
				}
			}
			
			// Add chromatic aberration at edges with time variation
			vec2 center = vec2(0.5);
			float distFromCenter = distance(uv, center);
			float edgeBoost = smoothstep(0.3, 0.8, distFromCenter) * 2.0;
			
			finalColor.r += offsetR * edgeBoost * chaos * 0.5;
			finalColor.g += offsetG * edgeBoost * chaos * 0.5;
			finalColor.b += offsetB * edgeBoost * chaos * 0.5;
			
			// Add subtle noise across the entire image
			float globalNoise = (noise(uv * 5.0 + t * 0.2) - 0.5) * 0.05 * intensity * chaos;
			finalColor.rgb += vec3(globalNoise);
			
			gl_FragColor = finalColor;
		}
	`
};

// Feedback / Mirror Effect
export const NeonGrid = {
	name: 'Neon Grid',
	uniforms: {
		tDiffuse: { value: null },
		audioData: { value: new Float32Array(512) },
		time: { value: 0.0 },
		p0: { value: 0.5 },   // Perspective depth (0-1)
		p1: { value: 0.5 },   // Neon intensity (0-1)
		p2: { value: 0.5 },   // Rotation speed (0-1)
		p3: { value: 0.5 }    // Color mode (0-1)
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
		uniform float p0, p1, p2, p3;

		// Vaporwave synthwave color palettes
		vec3 getNeonColor(float t, float intensity) {
			float r, g, b;
			
			// Classic vaporwave: pink, teal, purple
			float hue = fract(t * 0.1 + 0.5);
			r = sin(hue * 6.28318 + 0.0) * 0.5 + 0.5;
			g = sin(hue * 6.28318 + 2.094) * 0.5 + 0.5;
			b = sin(hue * 6.28318 + 4.188) * 0.5 + 0.5;
			
			// Boost saturation and add glow
			vec3 color = vec3(r, g, b);
			float glow = pow(intensity, 1.5) * 2.0;
			return color * (0.6 + glow);
		}

		// Audio analysis - weighted towards bass
		float getAudioIntensity() {
			float intensity = 0.0;
			for(int i = 0; i < 16; i++) {
				int binIndex = i * 4;
				float dbValue = audioData[binIndex];
				float normalizedValue = clamp((dbValue + 140.0) / 140.0, 0.0, 1.0);
				intensity += normalizedValue * (1.0 - float(i) / 16.0);
			}
			intensity /= 16.0;
			return pow(intensity * 2.0, 0.33);
		}

		// Random hash for grid variation
		float hash(vec2 p) {
			p = 50.0 * fract(p * 0.3183099 + vec2(0.71, 0.113));
			return -1.0 + 2.0 * fract(p.x * p.y * (p.x + p.y));
		}

		// Noise for organic feel
		float noise(vec2 st) {
			vec2 i = floor(st);
			vec2 f = fract(st);
			vec2 u = f * f * (3.0 - 2.0 * f);
			return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
			           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
		}

		void main() {
			vec2 uv = vUv;
			vec2 center = vec2(0.5);
			
			// Get base color from texture
			vec4 baseColor = texture2D(tDiffuse, uv);
			
			// Calculate audio intensity
			float audioIntensity = getAudioIntensity();
			
			// Map parameters
			float depth = mix(0.1, 2.0, p0);
			float neonIntensity = p1;
			float rotationSpeed = p2;
			float colorMode = p3;
			
			// Center coordinates
			vec2 dir = uv - center;
			
			// Apply rotation based on time and audio
			float rotation = time * rotationSpeed * 0.5 + audioIntensity * 0.2;
			float s = sin(rotation);
			float c = cos(rotation);
			mat2 rot = mat2(c, -s, s, c);
			vec2 rotatedDir = dir * rot;
			
			// Perspective projection - plane going outward
			float perspective = 1.0 / (1.0 + length(rotatedDir) * depth);
			vec2 perspectiveUV = rotatedDir * perspective * 0.5 + center;
			
			// Create grid lines radiating from center
			// Use perspectiveUV for the grid so it follows the perspective
			vec2 gridUV = perspectiveUV;
			
			// Grid spacing - increases with distance from center
			float gridScale = mix(5.0, 20.0, p0) * perspective;
			
			// Grid lines
			vec2 grid = gridUV * gridScale;
			
			// Create thicker grid lines with smooth edges
			float lineWidth = mix(0.02, 0.08, 1.0 - p0 * 0.5) * (0.5 + audioIntensity * 0.5);
			
			// Vertical lines
			float lineX = abs(fract(grid.x + 0.5) - 0.5);
			float verticalLine = smoothstep(lineWidth, 0.0, lineX);
			
			// Horizontal lines
			float lineY = abs(fract(grid.y + 0.5) - 0.5);
			float horizontalLine = smoothstep(lineWidth, 0.0, lineY);
			
			// Combine - use max for grid effect
			float gridPattern = max(verticalLine, horizontalLine);
			
			// Add radial lines from center (vaporware style)
			float angle = atan(rotatedDir.y, rotatedDir.x) + time * 0.1;
			float radialLines = 0.0;
			float numRadialLines = mix(4.0, 16.0, p0);
			for(int i = 0; i < 8; i++) {
				float lineAngle = float(i) * 6.28318 / numRadialLines - rotation;
				float angleDiff = abs(angle - lineAngle);
				float minDiff = min(angleDiff, 6.28318 - angleDiff);
				radialLines += smoothstep(0.1, 0.05, minDiff * numRadialLines) * 0.5;
			}
			
			// Combine patterns
			float neonMask = max(gridPattern, radialLines * 1.5);
			
			// Distance from center for glow effect
			float distFromCenter = length(dir) * 2.0;
			float centerGlow = smoothstep(0.3, 0.0, distFromCenter) * (0.5 + audioIntensity);
			
			// Get neon color based on position and time
			float colorTime = time * 0.3 + length(rotatedDir) * 2.0 + audioIntensity * 10.0;
			vec3 neonColor = getNeonColor(colorTime, neonIntensity);
			
			// Apply perspective distortion to color
			neonColor *= perspective * 2.0;
			
			// Combine everything
			vec3 gridGlow = neonColor * neonMask * neonIntensity * (1.0 + centerGlow);
			
			// Add horizon line (vaporware staple) - horizontal line at center
			float horizon = smoothstep(0.02, 0.0, abs(rotatedDir.y)) * 2.0;
			vec3 horizonColor = getNeonColor(time * 0.2, neonIntensity * 1.5);
			horizonColor.b *= 2.0; // More blue in horizon
			gridGlow += horizonColor * horizon * (0.3 + audioIntensity * 0.5);
			
			// Mix with base color
			vec3 finalColor = mix(baseColor.rgb, gridGlow, neonIntensity);
			
			// Add fog/distance effect
			float fog = perspective * 0.3;
			finalColor = mix(finalColor, neonColor * 0.3, fog * neonIntensity);
			
			// Add subtle noise for texture
			float n = noise(uv * 50.0 + time * 0.1) * 0.03 * audioIntensity;
			finalColor += vec3(n);
			
			// Final brightness boost from audio
			finalColor *= mix(1.0, 1.8, audioIntensity * neonIntensity);
			
			gl_FragColor = vec4(finalColor, baseColor.a);
		}
	`
};

export const Feedback = {
	name: 'Feedback',
	uniforms: {
		tDiffuse: { value: null },
		time: { value: 0.0 },
		p0: { value: 0.5 },   // Feedback amount (0-1)
		p1: { value: 0.5 },   // Zoom factor
		p2: { value: 0.0 },   // Rotation angle
		p3: { value: 0.5 }    // Distortion amount
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
			
			// Apply rotation based on p2
			float rotation = p2 * 6.28318; // 0-1 -> 0-2π
			mat2 rotationMatrix = rotate2D(rotation * time * 0.1);
			vec2 rotatedDir = dir * rotationMatrix;
			
			// Apply zoom
			float zoom = 1.0 + p1 * 0.5;
			vec2 zoomedDir = rotatedDir * zoom;
			
			// Calculate feedback UV
			vec2 feedbackUV = center + zoomedDir;
			
			// Add distortion
			if (p3 > 0.0) {
				// Wave distortion
				feedbackUV.x += sin(feedbackUV.y * 20.0 + time) * p3 * 0.05;
				feedbackUV.y += cos(feedbackUV.x * 20.0 + time) * p3 * 0.05;
				
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
			
			// Add time-based pulsing
			float pulse = sin(time * 2.0) * 0.5 + 0.5;
			color.rgb *= mix(1.0, vec3(1.0, 0.8, 0.6), p0 * pulse * 0.3);
			
			gl_FragColor = color;
		}
	`
};
