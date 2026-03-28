import * as THREE from 'three';

export interface SkyUniforms {
  readonly sunDirection: { x: number; y: number; z: number };
  readonly sunColor: { r: number; g: number; b: number };
  readonly ambientIntensity: number;
  readonly fogColor: { r: number; g: number; b: number };
  readonly fogDensity: number;
  readonly fogStart: number;
  readonly fogEnd: number;
}

const TERRAIN_VERTEX_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    vFogDepth = length(worldPosition.xyz - cameraPosition);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D atlas;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float ambientIntensity;
  uniform vec3 fogColor;
  uniform float fogDensity;
  uniform float fogStart;
  uniform float fogEnd;
  uniform float time;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  void main() {
    vec4 texColor = texture2D(atlas, vUv);

    if (texColor.a < 0.1) {
      discard;
    }

    // Directional light (sun)
    float NdotL = max(dot(vNormal, normalize(sunDirection)), 0.0);
    vec3 directional = sunColor * NdotL;

    // Ambient light
    vec3 ambient = vec3(ambientIntensity);

    // Combine
    vec3 lighting = ambient + directional;
    vec3 litColor = texColor.rgb * lighting;

    // Distance fog (linear)
    float fogFactor = clamp((fogEnd - vFogDepth) / (fogEnd - fogStart), 0.0, 1.0);
    vec3 finalColor = mix(fogColor, litColor, fogFactor);

    gl_FragColor = vec4(finalColor, texColor.a);
  }
`;

const WATER_VERTEX_SHADER = /* glsl */ `
  precision highp float;

  uniform float time;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  void main() {
    vUv = uv;

    // Animated vertex displacement: sum of sine waves
    vec3 displaced = position;
    float wave1 = sin(position.x * 0.8 + time * 1.5) * 0.08;
    float wave2 = sin(position.z * 1.2 + time * 1.1) * 0.06;
    float wave3 = sin((position.x + position.z) * 0.5 + time * 0.8) * 0.04;
    displaced.y += wave1 + wave2 + wave3;

    // Recompute normals from wave derivatives
    float dWave_dx = 0.8 * cos(position.x * 0.8 + time * 1.5) * 0.08
                   + 0.5 * cos((position.x + position.z) * 0.5 + time * 0.8) * 0.04;
    float dWave_dz = 1.2 * cos(position.z * 1.2 + time * 1.1) * 0.06
                   + 0.5 * cos((position.x + position.z) * 0.5 + time * 0.8) * 0.04;
    vec3 waveNormal = normalize(vec3(-dWave_dx, 1.0, -dWave_dz));
    vNormal = normalize(normalMatrix * waveNormal);

    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPosition.xyz;
    vFogDepth = length(worldPosition.xyz - cameraPosition);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float time;
  uniform vec3 waterColor;
  uniform vec3 sunDirection;
  uniform vec3 sunColor;
  uniform float ambientIntensity;
  uniform vec3 fogColor;
  uniform float fogStart;
  uniform float fogEnd;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vFogDepth;

  void main() {
    // Base water color
    vec3 baseColor = waterColor;

    // Directional light
    float NdotL = max(dot(vNormal, normalize(sunDirection)), 0.0);
    vec3 directional = sunColor * NdotL;
    vec3 ambient = vec3(ambientIntensity);

    vec3 litColor = baseColor * (ambient + directional);

    // Fresnel-like transparency
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = 1.0 - max(dot(viewDir, vNormal), 0.0);
    fresnel = pow(fresnel, 2.0);
    float alpha = mix(0.5, 0.9, fresnel);

    // Specular highlight for sun reflection
    vec3 halfDir = normalize(normalize(sunDirection) + viewDir);
    float spec = pow(max(dot(vNormal, halfDir), 0.0), 64.0);
    litColor += sunColor * spec * 0.6;

    // Fog
    float fogFactor = clamp((fogEnd - vFogDepth) / (fogEnd - fogStart), 0.0, 1.0);
    vec3 finalColor = mix(fogColor, litColor, fogFactor);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export function createTerrainMaterial(
  atlas: THREE.Texture,
  skyUniforms: SkyUniforms,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      atlas: { value: atlas },
      sunDirection: {
        value: new THREE.Vector3(
          skyUniforms.sunDirection.x,
          skyUniforms.sunDirection.y,
          skyUniforms.sunDirection.z,
        ),
      },
      sunColor: {
        value: new THREE.Color(
          skyUniforms.sunColor.r,
          skyUniforms.sunColor.g,
          skyUniforms.sunColor.b,
        ),
      },
      ambientIntensity: { value: skyUniforms.ambientIntensity },
      fogColor: {
        value: new THREE.Color(
          skyUniforms.fogColor.r,
          skyUniforms.fogColor.g,
          skyUniforms.fogColor.b,
        ),
      },
      fogDensity: { value: skyUniforms.fogDensity },
      fogStart: { value: skyUniforms.fogStart },
      fogEnd: { value: skyUniforms.fogEnd },
      time: { value: 0 },
    },
    vertexShader: TERRAIN_VERTEX_SHADER,
    fragmentShader: TERRAIN_FRAGMENT_SHADER,
    side: THREE.FrontSide,
    transparent: true,
  });
}

export function createWaterMaterial(skyUniforms?: SkyUniforms): THREE.ShaderMaterial {
  const sunDir = skyUniforms?.sunDirection ?? { x: 0.5, y: 0.8, z: 0.3 };
  const sunCol = skyUniforms?.sunColor ?? { r: 1.0, g: 0.95, b: 0.8 };
  const fogCol = skyUniforms?.fogColor ?? { r: 0.7, g: 0.8, b: 0.9 };

  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      waterColor: { value: new THREE.Color(0.1, 0.3, 0.5) },
      sunDirection: { value: new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z) },
      sunColor: { value: new THREE.Color(sunCol.r, sunCol.g, sunCol.b) },
      ambientIntensity: { value: skyUniforms?.ambientIntensity ?? 0.4 },
      fogColor: { value: new THREE.Color(fogCol.r, fogCol.g, fogCol.b) },
      fogStart: { value: skyUniforms?.fogStart ?? 50 },
      fogEnd: { value: skyUniforms?.fogEnd ?? 200 },
    },
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
}
