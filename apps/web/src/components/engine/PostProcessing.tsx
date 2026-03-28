"use client";

import {
  EffectComposer,
  Bloom,
  SSAO,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";

interface PostProcessingProps {
  readonly bloomEnabled?: boolean;
  readonly ssaoEnabled?: boolean;
  readonly bloomIntensity?: number;
  readonly bloomThreshold?: number;
  readonly ssaoRadius?: number;
  readonly ssaoIntensity?: number;
}

export default function PostProcessing({
  bloomEnabled = true,
  ssaoEnabled = true,
  bloomIntensity = 0.5,
  bloomThreshold = 0.8,
  ssaoRadius = 0.5,
  ssaoIntensity = 15,
}: PostProcessingProps) {
  return (
    <EffectComposer multisampling={0}>
      {bloomEnabled && (
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={bloomThreshold}
          luminanceSmoothing={0.9}
          mipmapBlur
          blendFunction={BlendFunction.ADD}
        />
      )}

      {ssaoEnabled && (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={16}
          radius={ssaoRadius}
          intensity={ssaoIntensity}
          luminanceInfluence={0.6}
          worldDistanceThreshold={20}
          worldDistanceFalloff={5}
          worldProximityThreshold={0.5}
          worldProximityFalloff={0.3}
        />
      )}

      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
