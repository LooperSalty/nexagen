precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 modelMatrix;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewPos;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;

    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPos = viewPosition.xyz;

    gl_Position = projectionMatrix * viewPosition;
}
