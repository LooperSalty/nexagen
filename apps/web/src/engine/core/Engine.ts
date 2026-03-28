import type { Vector3Like, InputState, PlayerState } from '@nexagen/shared';
import { ChunkManager } from '../world/ChunkManager';
import { EntityManager } from '../entities/EntityManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { AudioManager } from '../audio/AudioManager';
import { InputManager } from '../input/InputManager';
import { PlayerController } from '../entities/PlayerController';
import { SkySystem } from '../rendering/SkySystem';
import { TerrainGenerator } from '../world/TerrainGenerator';
import type { WorldSeed } from '@nexagen/shared';

export interface EngineState {
  readonly initialized: boolean;
  readonly running: boolean;
  readonly playerPosition: Vector3Like;
  readonly chunkCount: number;
  readonly entityCount: number;
  readonly timeOfDay: number;
  readonly fps: number;
}

export interface EngineConfig {
  readonly worldSeed: WorldSeed;
}

export class Engine {
  private _initialized: boolean = false;
  private _running: boolean = false;
  private _canvas: HTMLCanvasElement | null = null;

  private _chunkManager: ChunkManager | null = null;
  private _entityManager: EntityManager | null = null;
  private _physicsWorld: PhysicsWorld | null = null;
  private _audioManager: AudioManager | null = null;
  private _inputManager: InputManager | null = null;
  private _playerController: PlayerController | null = null;
  private _skySystem: SkySystem | null = null;
  private _fps: number = 0;

  get chunkManager(): ChunkManager {
    if (!this._chunkManager) {
      throw new Error('Engine not initialized: ChunkManager unavailable');
    }
    return this._chunkManager;
  }

  get entityManager(): EntityManager {
    if (!this._entityManager) {
      throw new Error('Engine not initialized: EntityManager unavailable');
    }
    return this._entityManager;
  }

  get physicsWorld(): PhysicsWorld {
    if (!this._physicsWorld) {
      throw new Error('Engine not initialized: PhysicsWorld unavailable');
    }
    return this._physicsWorld;
  }

  get audioManager(): AudioManager {
    if (!this._audioManager) {
      throw new Error('Engine not initialized: AudioManager unavailable');
    }
    return this._audioManager;
  }

  get inputManager(): InputManager {
    if (!this._inputManager) {
      throw new Error('Engine not initialized: InputManager unavailable');
    }
    return this._inputManager;
  }

  get playerController(): PlayerController {
    if (!this._playerController) {
      throw new Error('Engine not initialized: PlayerController unavailable');
    }
    return this._playerController;
  }

  get skySystem(): SkySystem {
    if (!this._skySystem) {
      throw new Error('Engine not initialized: SkySystem unavailable');
    }
    return this._skySystem;
  }

  get initialized(): boolean {
    return this._initialized;
  }

  get running(): boolean {
    return this._running;
  }

  async init(canvas: HTMLCanvasElement, config: EngineConfig): Promise<void> {
    if (this._initialized) {
      throw new Error('Engine is already initialized');
    }

    this._canvas = canvas;

    const terrainGenerator = new TerrainGenerator(config.worldSeed);

    this._physicsWorld = new PhysicsWorld();
    this._inputManager = new InputManager();
    this._audioManager = new AudioManager();
    this._entityManager = new EntityManager();
    this._chunkManager = new ChunkManager(terrainGenerator);
    this._playerController = new PlayerController();
    this._skySystem = new SkySystem();

    this._inputManager.init(canvas);
    this._audioManager.init();

    this._initialized = true;
  }

  update(deltaTime: number): void {
    if (!this._initialized) {
      return;
    }

    const inputManager = this._inputManager!;
    const chunkManager = this._chunkManager!;
    const entityManager = this._entityManager!;
    const playerController = this._playerController!;
    const skySystem = this._skySystem!;
    const audioManager = this._audioManager!;

    inputManager.update();

    const currentInput = inputManager.currentState;
    const blockGetter = (x: number, y: number, z: number): number =>
      chunkManager.getBlock(x, y, z);

    const playerState = playerController.update(deltaTime, currentInput, blockGetter);

    chunkManager.update(playerState.position);

    entityManager.update(deltaTime, playerState.position);

    skySystem.update(deltaTime);

    audioManager.setListenerPosition(
      playerState.position,
      playerController.getForwardDirection(),
    );
  }

  setFps(fps: number): void {
    this._fps = fps;
  }

  dispose(): void {
    if (!this._initialized) {
      return;
    }

    if (this._inputManager) {
      this._inputManager.dispose();
      this._inputManager = null;
    }

    if (this._audioManager) {
      this._audioManager.dispose();
      this._audioManager = null;
    }

    this._chunkManager = null;
    this._entityManager = null;
    this._physicsWorld = null;
    this._playerController = null;
    this._skySystem = null;
    this._canvas = null;

    this._initialized = false;
    this._running = false;
  }

  getState(): EngineState {
    return {
      initialized: this._initialized,
      running: this._running,
      playerPosition: this._playerController
        ? { ...this._playerController.position }
        : { x: 0, y: 0, z: 0 },
      chunkCount: this._chunkManager ? this._chunkManager.chunkCount : 0,
      entityCount: this._entityManager ? this._entityManager.entityCount : 0,
      timeOfDay: this._skySystem ? this._skySystem.timeOfDay : 0,
      fps: this._fps,
    };
  }
}
