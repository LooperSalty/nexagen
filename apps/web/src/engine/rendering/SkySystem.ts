import type { Vector3Like } from '@nexagen/shared';
import { DAY_DURATION, lerp, clamp } from '@nexagen/shared';
import type { SkyUniforms } from './ShaderManager';

interface ColorRGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface SkyKeyframe {
  readonly time: number;        // 0..1
  readonly topColor: ColorRGB;
  readonly horizonColor: ColorRGB;
  readonly sunColor: ColorRGB;
  readonly ambientIntensity: number;
  readonly directionalIntensity: number;
}

const SKY_KEYFRAMES: readonly SkyKeyframe[] = [
  {
    // Midnight (0.0)
    time: 0.0,
    topColor: { r: 0.01, g: 0.01, b: 0.05 },
    horizonColor: { r: 0.02, g: 0.02, b: 0.08 },
    sunColor: { r: 0.1, g: 0.1, b: 0.2 },
    ambientIntensity: 0.08,
    directionalIntensity: 0.02,
  },
  {
    // Pre-dawn (0.2)
    time: 0.2,
    topColor: { r: 0.05, g: 0.05, b: 0.15 },
    horizonColor: { r: 0.15, g: 0.1, b: 0.2 },
    sunColor: { r: 0.4, g: 0.2, b: 0.1 },
    ambientIntensity: 0.15,
    directionalIntensity: 0.1,
  },
  {
    // Sunrise (0.25)
    time: 0.25,
    topColor: { r: 0.2, g: 0.3, b: 0.6 },
    horizonColor: { r: 1.0, g: 0.6, b: 0.3 },
    sunColor: { r: 1.0, g: 0.7, b: 0.4 },
    ambientIntensity: 0.3,
    directionalIntensity: 0.5,
  },
  {
    // Morning (0.35)
    time: 0.35,
    topColor: { r: 0.3, g: 0.5, b: 0.9 },
    horizonColor: { r: 0.6, g: 0.7, b: 0.95 },
    sunColor: { r: 1.0, g: 0.95, b: 0.85 },
    ambientIntensity: 0.45,
    directionalIntensity: 0.8,
  },
  {
    // Noon (0.5)
    time: 0.5,
    topColor: { r: 0.3, g: 0.55, b: 1.0 },
    horizonColor: { r: 0.6, g: 0.8, b: 1.0 },
    sunColor: { r: 1.0, g: 0.98, b: 0.9 },
    ambientIntensity: 0.5,
    directionalIntensity: 1.0,
  },
  {
    // Afternoon (0.65)
    time: 0.65,
    topColor: { r: 0.3, g: 0.5, b: 0.9 },
    horizonColor: { r: 0.6, g: 0.7, b: 0.95 },
    sunColor: { r: 1.0, g: 0.95, b: 0.85 },
    ambientIntensity: 0.45,
    directionalIntensity: 0.8,
  },
  {
    // Sunset (0.75)
    time: 0.75,
    topColor: { r: 0.15, g: 0.15, b: 0.4 },
    horizonColor: { r: 1.0, g: 0.4, b: 0.15 },
    sunColor: { r: 1.0, g: 0.5, b: 0.2 },
    ambientIntensity: 0.25,
    directionalIntensity: 0.4,
  },
  {
    // Dusk (0.85)
    time: 0.85,
    topColor: { r: 0.05, g: 0.05, b: 0.15 },
    horizonColor: { r: 0.2, g: 0.1, b: 0.15 },
    sunColor: { r: 0.3, g: 0.15, b: 0.1 },
    ambientIntensity: 0.12,
    directionalIntensity: 0.08,
  },
  {
    // Midnight wrap (1.0 = 0.0)
    time: 1.0,
    topColor: { r: 0.01, g: 0.01, b: 0.05 },
    horizonColor: { r: 0.02, g: 0.02, b: 0.08 },
    sunColor: { r: 0.1, g: 0.1, b: 0.2 },
    ambientIntensity: 0.08,
    directionalIntensity: 0.02,
  },
] as const;

function lerpColor(a: ColorRGB, b: ColorRGB, t: number): ColorRGB {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}

function findKeyframePair(time: number): { from: SkyKeyframe; to: SkyKeyframe; t: number } {
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    const from = SKY_KEYFRAMES[i];
    const to = SKY_KEYFRAMES[i + 1];
    if (time >= from.time && time <= to.time) {
      const range = to.time - from.time;
      const t = range > 0 ? (time - from.time) / range : 0;
      return { from, to, t };
    }
  }

  // Fallback: wrap around
  const from = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1];
  const to = SKY_KEYFRAMES[0];
  return { from, to, t: 0 };
}

export class SkySystem {
  private _timeOfDay: number = 0.35; // Start at morning
  private _dayDuration: number = DAY_DURATION;
  private _paused: boolean = false;

  private _currentTop: ColorRGB = { r: 0.3, g: 0.5, b: 0.9 };
  private _currentHorizon: ColorRGB = { r: 0.6, g: 0.7, b: 0.95 };
  private _currentSunColor: ColorRGB = { r: 1.0, g: 0.95, b: 0.85 };
  private _currentAmbient: number = 0.45;
  private _currentDirectional: number = 0.8;

  get timeOfDay(): number {
    return this._timeOfDay;
  }

  set timeOfDay(value: number) {
    this._timeOfDay = ((value % 1) + 1) % 1;
  }

  get dayDuration(): number {
    return this._dayDuration;
  }

  set dayDuration(value: number) {
    this._dayDuration = Math.max(1, value);
  }

  get paused(): boolean {
    return this._paused;
  }

  set paused(value: boolean) {
    this._paused = value;
  }

  update(deltaTime: number): void {
    if (this._paused) {
      return;
    }

    this._timeOfDay += deltaTime / this._dayDuration;
    this._timeOfDay = ((this._timeOfDay % 1) + 1) % 1;

    const { from, to, t } = findKeyframePair(this._timeOfDay);

    this._currentTop = lerpColor(from.topColor, to.topColor, t);
    this._currentHorizon = lerpColor(from.horizonColor, to.horizonColor, t);
    this._currentSunColor = lerpColor(from.sunColor, to.sunColor, t);
    this._currentAmbient = lerp(from.ambientIntensity, to.ambientIntensity, t);
    this._currentDirectional = lerp(from.directionalIntensity, to.directionalIntensity, t);
  }

  getSunPosition(): Vector3Like {
    // Sun orbits in a circle: 0 = below horizon (midnight), 0.5 = zenith (noon)
    const angle = this._timeOfDay * Math.PI * 2 - Math.PI / 2;
    return {
      x: Math.cos(angle) * 0.3,
      y: Math.sin(angle),
      z: Math.cos(angle) * 0.7,
    };
  }

  getSkyUniforms(): SkyUniforms {
    const sunPos = this.getSunPosition();
    const sunLen = Math.sqrt(sunPos.x * sunPos.x + sunPos.y * sunPos.y + sunPos.z * sunPos.z);

    return {
      sunDirection: {
        x: sunLen > 0 ? sunPos.x / sunLen : 0,
        y: sunLen > 0 ? sunPos.y / sunLen : 1,
        z: sunLen > 0 ? sunPos.z / sunLen : 0,
      },
      sunColor: {
        r: this._currentSunColor.r * this._currentDirectional,
        g: this._currentSunColor.g * this._currentDirectional,
        b: this._currentSunColor.b * this._currentDirectional,
      },
      ambientIntensity: this._currentAmbient,
      fogColor: {
        r: lerp(this._currentHorizon.r, this._currentTop.r, 0.3),
        g: lerp(this._currentHorizon.g, this._currentTop.g, 0.3),
        b: lerp(this._currentHorizon.b, this._currentTop.b, 0.3),
      },
      fogDensity: 0.015,
      fogStart: 50,
      fogEnd: 200,
    };
  }

  getAmbientColor(): ColorRGB {
    return {
      r: this._currentTop.r * this._currentAmbient,
      g: this._currentTop.g * this._currentAmbient,
      b: this._currentTop.b * this._currentAmbient,
    };
  }

  getDirectionalColor(): ColorRGB {
    return {
      r: this._currentSunColor.r * this._currentDirectional,
      g: this._currentSunColor.g * this._currentDirectional,
      b: this._currentSunColor.b * this._currentDirectional,
    };
  }

  getFogColor(): ColorRGB {
    return {
      r: lerp(this._currentHorizon.r, this._currentTop.r, 0.3),
      g: lerp(this._currentHorizon.g, this._currentTop.g, 0.3),
      b: lerp(this._currentHorizon.b, this._currentTop.b, 0.3),
    };
  }

  getTopColor(): ColorRGB {
    return { ...this._currentTop };
  }

  getHorizonColor(): ColorRGB {
    return { ...this._currentHorizon };
  }
}
