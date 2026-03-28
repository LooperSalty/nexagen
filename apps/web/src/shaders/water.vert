precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 modelMatrix;
uniform float time;
uniform float waveAmplitude;
uniform float waveFrequency;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewPos;
varying vec4 vScreenPos;

void main() {
    vUv = uv;

    // Sum of 3 sine waves at different frequencies and directions
    vec3 displaced = position;

    float wave1 = sin(position.x * waveFrequency + time * 1.2) * waveAmplitude;
    float wave2 = sin(position.z * waveFrequency * 0.8 + time * 0.9) * waveAmplitude * 0.6;
    float wave3 = sin((position.x + position.z) * waveFrequency * 0.5 + time * 1.5) * waveAmplitude * 0.3;

    displaced.y += wave1 + wave2 + wave3;

    // Approximate displaced normal from wave derivatives
    float dx = cos(position.x * waveFrequency + time * 1.2) * waveFrequency * waveAmplitude
             + cos((position.x + position.z) * waveFrequency * 0.5 + time * 1.5) * waveFrequency * 0.5 * waveAmplitude * 0.3;
    float dz = cos(position.z * waveFrequency * 0.8 + time * 0.9) * waveFrequency * 0.8 * waveAmplitude * 0.6
             + cos((position.x + position.z) * waveFrequency * 0.5 + time * 1.5) * waveFrequency * 0.5 * waveAmplitude * 0.3;

    vec3 displacedNormal = normalize(vec3(-dx, 1.0, -dz));
    vNormal = normalize(normalMatrix * displacedNormal);

    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPosition.xyz;

    vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPos = viewPosition.xyz;

    vec4 clipPos = projectionMatrix * viewPosition;
    vScreenPos = clipPos;

    gl_Position = clipPos;
}
