import type { Vector3Like } from '@nexagen/shared';

interface SoundBuffer {
  readonly buffer: AudioBuffer;
  readonly name: string;
}

export class AudioManager {
  private _context: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _musicGain: GainNode | null = null;
  private _sfxGain: GainNode | null = null;

  private _masterVolume: number = 1.0;
  private _musicVolume: number = 0.5;
  private _sfxVolume: number = 0.8;

  private _soundBuffers: Map<string, AudioBuffer> = new Map();
  private _currentMusic: AudioBufferSourceNode | null = null;
  private _initialized: boolean = false;

  get masterVolume(): number {
    return this._masterVolume;
  }

  set masterVolume(value: number) {
    this._masterVolume = Math.max(0, Math.min(1, value));
    if (this._masterGain) {
      this._masterGain.gain.setValueAtTime(this._masterVolume, this._context!.currentTime);
    }
  }

  get musicVolume(): number {
    return this._musicVolume;
  }

  set musicVolume(value: number) {
    this._musicVolume = Math.max(0, Math.min(1, value));
    if (this._musicGain) {
      this._musicGain.gain.setValueAtTime(this._musicVolume, this._context!.currentTime);
    }
  }

  get sfxVolume(): number {
    return this._sfxVolume;
  }

  set sfxVolume(value: number) {
    this._sfxVolume = Math.max(0, Math.min(1, value));
    if (this._sfxGain) {
      this._sfxGain.gain.setValueAtTime(this._sfxVolume, this._context!.currentTime);
    }
  }

  init(): void {
    if (this._initialized) {
      return;
    }

    // AudioContext creation may be deferred until user interaction
    // We create it here but it may start in 'suspended' state
    this._context = new AudioContext();

    this._masterGain = this._context.createGain();
    this._masterGain.gain.setValueAtTime(this._masterVolume, this._context.currentTime);
    this._masterGain.connect(this._context.destination);

    this._musicGain = this._context.createGain();
    this._musicGain.gain.setValueAtTime(this._musicVolume, this._context.currentTime);
    this._musicGain.connect(this._masterGain);

    this._sfxGain = this._context.createGain();
    this._sfxGain.gain.setValueAtTime(this._sfxVolume, this._context.currentTime);
    this._sfxGain.connect(this._masterGain);

    this._initialized = true;
  }

  private _ensureResumed(): void {
    if (this._context && this._context.state === 'suspended') {
      this._context.resume().catch(() => {
        // Silently handle — will retry on next user interaction
      });
    }
  }

  playSound(name: string, position?: Vector3Like, volume: number = 1.0): void {
    if (!this._context || !this._sfxGain) {
      return;
    }

    this._ensureResumed();

    const buffer = this._soundBuffers.get(name);
    if (!buffer) {
      return;
    }

    const source = this._context.createBufferSource();
    source.buffer = buffer;

    // If position provided, use panner for 3D audio
    if (position) {
      const panner = this._context.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 1;
      panner.maxDistance = 50;
      panner.rolloffFactor = 1;
      panner.positionX.setValueAtTime(position.x, this._context.currentTime);
      panner.positionY.setValueAtTime(position.y, this._context.currentTime);
      panner.positionZ.setValueAtTime(position.z, this._context.currentTime);

      const gainNode = this._context.createGain();
      gainNode.gain.setValueAtTime(volume, this._context.currentTime);

      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(this._sfxGain);
    } else {
      const gainNode = this._context.createGain();
      gainNode.gain.setValueAtTime(volume, this._context.currentTime);

      source.connect(gainNode);
      gainNode.connect(this._sfxGain);
    }

    source.start(0);
  }

  playMusic(name: string, loop: boolean = true): void {
    if (!this._context || !this._musicGain) {
      return;
    }

    this._ensureResumed();

    // Stop current music
    this.stopMusic();

    const buffer = this._soundBuffers.get(name);
    if (!buffer) {
      return;
    }

    const source = this._context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(this._musicGain);
    source.start(0);

    this._currentMusic = source;

    source.onended = () => {
      if (this._currentMusic === source) {
        this._currentMusic = null;
      }
    };
  }

  stopMusic(): void {
    if (this._currentMusic) {
      try {
        this._currentMusic.stop();
      } catch {
        // Already stopped
      }
      this._currentMusic = null;
    }
  }

  setListenerPosition(pos: Vector3Like, forward: Vector3Like): void {
    if (!this._context) {
      return;
    }

    const listener = this._context.listener;

    if (listener.positionX) {
      listener.positionX.setValueAtTime(pos.x, this._context.currentTime);
      listener.positionY.setValueAtTime(pos.y, this._context.currentTime);
      listener.positionZ.setValueAtTime(pos.z, this._context.currentTime);
    }

    if (listener.forwardX) {
      listener.forwardX.setValueAtTime(forward.x, this._context.currentTime);
      listener.forwardY.setValueAtTime(forward.y, this._context.currentTime);
      listener.forwardZ.setValueAtTime(forward.z, this._context.currentTime);
      listener.upX.setValueAtTime(0, this._context.currentTime);
      listener.upY.setValueAtTime(1, this._context.currentTime);
      listener.upZ.setValueAtTime(0, this._context.currentTime);
    }
  }

  async preloadSounds(urls: Record<string, string>): Promise<void> {
    if (!this._context) {
      return;
    }

    const entries = Object.entries(urls);
    const loadPromises = entries.map(async ([name, url]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} fetching ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this._context!.decodeAudioData(arrayBuffer);
        this._soundBuffers.set(name, audioBuffer);
      } catch (error) {
        console.error(`Failed to preload sound "${name}" from ${url}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  dispose(): void {
    this.stopMusic();

    if (this._context) {
      this._context.close().catch(() => {
        // Ignore close errors
      });
    }

    this._soundBuffers.clear();
    this._context = null;
    this._masterGain = null;
    this._musicGain = null;
    this._sfxGain = null;
    this._currentMusic = null;
    this._initialized = false;
  }
}
