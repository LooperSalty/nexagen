precision highp float;

uniform float time;
uniform vec3 waterColor;
uniform float transparency;
uniform vec3 fogColor;
uniform float fogDensity;
uniform vec3 sunDirection;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewPos;
varying vec4 vScreenPos;

// Simple pseudo-noise for caustics
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
    vec3 lightDir = normalize(sunDirection);

    // Animated normal perturbation for wave reflections
    vec2 distortedUv = vUv * 8.0;
    distortedUv.x += sin(time * 0.3 + vUv.y * 6.0) * 0.1;
    distortedUv.y += cos(time * 0.4 + vUv.x * 5.0) * 0.1;

    float n1 = noise(distortedUv + time * 0.2);
    float n2 = noise(distortedUv * 2.0 - time * 0.15);
    vec3 perturbedNormal = normalize(normal + vec3(n1 - 0.5, 0.0, n2 - 0.5) * 0.3);

    // Fresnel approximation: more opaque at grazing angles
    float fresnel = pow(1.0 - max(dot(viewDir, perturbedNormal), 0.0), 3.0);
    float alpha = mix(transparency, 1.0, fresnel);

    // Specular highlight from sun
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(perturbedNormal, halfDir), 0.0), 128.0);
    vec3 specularColor = vec3(1.0) * specular * 1.5;

    // Diffuse lighting
    float diffuse = max(dot(perturbedNormal, lightDir), 0.0);

    // Caustic pattern: animated UV distortion
    vec2 causticUv = vWorldPos.xz * 0.5;
    causticUv += vec2(
        sin(time * 0.5 + causticUv.y * 3.0) * 0.15,
        cos(time * 0.6 + causticUv.x * 2.5) * 0.15
    );
    float caustic = noise(causticUv * 4.0 + time * 0.3);
    caustic = pow(caustic, 2.0) * 0.3;

    // Combine
    vec3 baseColor = waterColor * (0.3 + diffuse * 0.7);
    vec3 finalColor = baseColor + specularColor + caustic * waterColor;

    // Fog blending at distance
    float distance = length(vViewPos);
    float fogFactor = 1.0 - exp(-fogDensity * distance * distance);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    finalColor = mix(finalColor, fogColor, fogFactor);

    gl_FragColor = vec4(finalColor, alpha);
}
