import { PHYSICS_STEP } from '@nexagen/shared';

export type UpdateCallback = (deltaTime: number) => void;
export type RenderCallback = (deltaTime: number, interpolation: number) => void;

const FPS_SAMPLE_COUNT = 60;
const MAX_FRAME_TIME = 0.25; // Cap to prevent spiral of death

export class GameLoop {
  private _isRunning: boolean = false;
  private _animationFrameId: number = 0;
  private _previousTime: number = 0;
  private _accumulator: number = 0;
  private _elapsed: number = 0;
  private _frameCount: number = 0;
  private _fps: number = 0;
  private _deltaTime: number = 0;

  private readonly _frameTimes: Float64Array = new Float64Array(FPS_SAMPLE_COUNT);
  private _frameTimeIndex: number = 0;
  private _frameTimeFilled: boolean = false;

  private _onUpdate: UpdateCallback | null = null;
  private _onRender: RenderCallback | null = null;

  get isRunning(): boolean {
    return this._isRunning;
  }

  get fps(): number {
    return this._fps;
  }

  get deltaTime(): number {
    return this._deltaTime;
  }

  get elapsed(): number {
    return this._elapsed;
  }

  get frameCount(): number {
    return this._frameCount;
  }

  set onUpdate(callback: UpdateCallback | null) {
    this._onUpdate = callback;
  }

  set onRender(callback: RenderCallback | null) {
    this._onRender = callback;
  }

  start(): void {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;
    this._previousTime = performance.now() / 1000;
    this._accumulator = 0;
    this._frameCount = 0;
    this._elapsed = 0;
    this._frameTimeIndex = 0;
    this._frameTimeFilled = false;
    this._frameTimes.fill(0);

    this._animationFrameId = requestAnimationFrame(this._loop);
  }

  stop(): void {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;

    if (this._animationFrameId !== 0) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = 0;
    }
  }

  private readonly _loop = (timestamp: number): void => {
    if (!this._isRunning) {
      return;
    }

    const currentTime = timestamp / 1000;
    let frameTime = currentTime - this._previousTime;
    this._previousTime = currentTime;

    // Clamp max frame time to prevent death spiral
    if (frameTime > MAX_FRAME_TIME) {
      frameTime = MAX_FRAME_TIME;
    }

    this._deltaTime = frameTime;
    this._elapsed += frameTime;
    this._frameCount += 1;

    // Track frame times for rolling FPS average
    this._frameTimes[this._frameTimeIndex] = frameTime;
    this._frameTimeIndex = (this._frameTimeIndex + 1) % FPS_SAMPLE_COUNT;
    if (this._frameTimeIndex === 0) {
      this._frameTimeFilled = true;
    }

    this._fps = this._calculateFps();

    // Fixed timestep physics updates
    this._accumulator += frameTime;

    while (this._accumulator >= PHYSICS_STEP) {
      if (this._onUpdate) {
        this._onUpdate(PHYSICS_STEP);
      }
      this._accumulator -= PHYSICS_STEP;
    }

    // Variable timestep render
    const interpolation = this._accumulator / PHYSICS_STEP;
    if (this._onRender) {
      this._onRender(frameTime, interpolation);
    }

    this._animationFrameId = requestAnimationFrame(this._loop);
  };

  private _calculateFps(): number {
    const count = this._frameTimeFilled ? FPS_SAMPLE_COUNT : this._frameTimeIndex;
    if (count === 0) {
      return 0;
    }

    let totalTime = 0;
    for (let i = 0; i < count; i++) {
      totalTime += this._frameTimes[i];
    }

    const avgFrameTime = totalTime / count;
    return avgFrameTime > 0 ? Math.round(1 / avgFrameTime) : 0;
  }
}
