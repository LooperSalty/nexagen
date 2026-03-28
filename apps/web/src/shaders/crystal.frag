precision highp float;

uniform float time;
uniform vec3 emissiveColor;
uniform float emissiveIntensity;
uniform float pulseSpeed;
uniform sampler2D envMap;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewPos;

// Simple noise for distortion
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(-vViewPos);

    // Fresnel rim lighting
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);

    // Pulsing animation
    float pulse = 0.7 + 0.3 * sin(time * pulseSpeed);
    float pulse2 = 0.8 + 0.2 * sin(time * pulseSpeed * 1.7 + 1.5);

    // Inner glow: emissive color modulated by pulse
    vec3 innerGlow = emissiveColor * emissiveIntensity * pulse;

    // Refraction-like distortion using noise on UVs
    vec2 distortedUv = vUv;
    distortedUv.x += noise(vUv * 5.0 + time * 0.3) * 0.05;
    distortedUv.y += noise(vUv * 5.0 - time * 0.2) * 0.05;

    // Simulate internal refraction patterns
    float refraction1 = noise(distortedUv * 8.0 + time * 0.4);
    float refraction2 = noise(distortedUv * 12.0 - time * 0.3);
    float refractionPattern = (refraction1 + refraction2) * 0.5;
    refractionPattern = pow(refractionPattern, 1.5);

    vec3 refractionColor = emissiveColor * refractionPattern * 0.4 * pulse2;

    // Crystal surface: slightly transparent, bright at edges
    vec3 rimColor = emissiveColor * fresnel * 2.0;

    // Sparkle highlights
    float sparkle = noise(vWorldPos.xy * 20.0 + time * 2.0);
    sparkle = pow(sparkle, 8.0) * 1.5;
    vec3 sparkleColor = vec3(1.0) * sparkle * pulse;

    // Combine all effects
    vec3 baseColor = emissiveColor * 0.15;
    vec3 finalColor = baseColor + innerGlow + refractionColor + rimColor + sparkleColor;

    // Alpha: more opaque at edges (fresnel), semi-transparent in center
    float alpha = 0.6 + fresnel * 0.4;

    gl_FragColor = vec4(finalColor, alpha);
}
