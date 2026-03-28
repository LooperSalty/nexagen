precision highp float;

uniform sampler2D atlas;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float ambientIntensity;
uniform vec3 fogColor;
uniform float fogDensity;
uniform float fogStart;
uniform float fogEnd;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewPos;

void main() {
    vec4 texColor = texture2D(atlas, vUv);

    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(sunDirection);

    // Directional sunlight
    float diffuse = max(dot(normal, lightDir), 0.0);
    vec3 directLight = diffuse * sunColor;

    // Ambient sky light
    vec3 ambient = ambientIntensity * vec3(0.6, 0.7, 1.0);

    // Combined lighting
    vec3 litColor = texColor.rgb * (directLight + ambient);

    // Linear fog based on view distance
    float distance = length(vViewPos);
    float fogFactor = clamp((fogEnd - distance) / (fogEnd - fogStart), 0.0, 1.0);

    vec3 finalColor = mix(fogColor, litColor, fogFactor);

    gl_FragColor = vec4(finalColor, texColor.a);
}
