import type { Vector3Like, InputState } from '@nexagen/shared';
import {
  PLAYER_SPEED,
  SPRINT_MULTIPLIER,
  JUMP_FORCE,
  GRAVITY,
  PLAYER_REACH,
  clamp,
  vec3Add,
  vec3Scale,
  vec3Normalize,
  vec3Length,
} from '@nexagen/shared';
import { sweepAABB, getPlayerAABB } from '../physics/PhysicsWorld';

export type BlockGetter = (x: number, y: number, z: number) => number;

export interface PlayerControllerState {
  readonly position: Vector3Like;
  readonly velocity: Vector3Like;
  readonly pitch: number;
  readonly yaw: number;
  readonly isGrounded: boolean;
  readonly isSprinting: boolean;
  readonly isFlying: boolean;
}

export interface RaycastHit {
  readonly position: Vector3Like;
  readonly normal: Vector3Like;
  readonly blockPos: Vector3Like;
}

const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;
const MOUSE_SENSITIVITY = 0.15;
const DEG_TO_RAD = Math.PI / 180;
const MAX_PITCH = 89;

export class PlayerController {
  private _position: Vector3Like = { x: 0, y: 80, z: 0 };
  private _velocity: Vector3Like = { x: 0, y: 0, z: 0 };
  private _pitch: number = 0;
  private _yaw: number = 0;
  private _isGrounded: boolean = false;
  private _isSprinting: boolean = false;
  private _isFlying: boolean = false;

  private readonly _speed: number = PLAYER_SPEED;
  private readonly _sprintMultiplier: number = SPRINT_MULTIPLIER;
  private readonly _jumpForce: number = JUMP_FORCE;
  private readonly _gravity: number = GRAVITY;

  get position(): Vector3Like {
    return this._position;
  }

  get velocity(): Vector3Like {
    return this._velocity;
  }

  get pitch(): number {
    return this._pitch;
  }

  get yaw(): number {
    return this._yaw;
  }

  get isGrounded(): boolean {
    return this._isGrounded;
  }

  get isSprinting(): boolean {
    return this._isSprinting;
  }

  get isFlying(): boolean {
    return this._isFlying;
  }

  set isFlying(value: boolean) {
    this._isFlying = value;
  }

  setPosition(pos: Vector3Like): void {
    this._position = { ...pos };
  }

  update(deltaTime: number, input: InputState, getBlock: BlockGetter): PlayerControllerState {
    // Mouse look
    const newPitch = clamp(
      this._pitch - input.mouseDelta.y * MOUSE_SENSITIVITY,
      -MAX_PITCH,
      MAX_PITCH,
    );
    const newYaw = (this._yaw + input.mouseDelta.x * MOUSE_SENSITIVITY) % 360;

    this._pitch = newPitch;
    this._yaw = newYaw;

    // Movement direction from input + yaw
    const yawRad = newYaw * DEG_TO_RAD;
    const sinYaw = Math.sin(yawRad);
    const cosYaw = Math.cos(yawRad);

    let moveX = 0;
    let moveZ = 0;

    if (input.forward) {
      moveX -= sinYaw;
      moveZ -= cosYaw;
    }
    if (input.backward) {
      moveX += sinYaw;
      moveZ += cosYaw;
    }
    if (input.left) {
      moveX -= cosYaw;
      moveZ += sinYaw;
    }
    if (input.right) {
      moveX += cosYaw;
      moveZ -= sinYaw;
    }

    // Normalize horizontal movement
    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    // Sprint
    this._isSprinting = input.sprint && input.forward;
    const speedMultiplier = this._isSprinting ? this._sprintMultiplier : 1.0;
    const speed = this._speed * speedMultiplier;

    let vx = moveX * speed;
    let vy = this._velocity.y;
    let vz = moveZ * speed;

    if (this._isFlying) {
      // Flying mode: no gravity, vertical movement via jump/sprint
      vy = 0;
      if (input.jump) {
        vy = speed;
      }
      if (input.sprint && !input.forward) {
        vy = -speed;
      }
    } else {
      // Apply gravity
      if (!this._isGrounded) {
        vy -= this._gravity * deltaTime;
      }

      // Jump
      if (this._isGrounded && input.jump) {
        vy = this._jumpForce;
        this._isGrounded = false;
      }
    }

    const newVelocity: Vector3Like = { x: vx, y: vy, z: vz };

    // Resolve collisions
    const aabb = getPlayerAABB(this._position);
    const result = sweepAABB(aabb, newVelocity, getBlock, deltaTime);

    this._position = result.position;
    this._velocity = result.velocity;
    this._isGrounded = result.grounded;

    return {
      position: this._position,
      velocity: this._velocity,
      pitch: this._pitch,
      yaw: this._yaw,
      isGrounded: this._isGrounded,
      isSprinting: this._isSprinting,
      isFlying: this._isFlying,
    };
  }

  getForwardDirection(): Vector3Like {
    const pitchRad = this._pitch * DEG_TO_RAD;
    const yawRad = this._yaw * DEG_TO_RAD;

    return {
      x: -Math.sin(yawRad) * Math.cos(pitchRad),
      y: Math.sin(pitchRad),
      z: -Math.cos(yawRad) * Math.cos(pitchRad),
    };
  }

  getRaycastTarget(getBlock: BlockGetter, maxDistance: number = PLAYER_REACH): RaycastHit | null {
    const forward = this.getForwardDirection();
    const eyePos: Vector3Like = {
      x: this._position.x,
      y: this._position.y + PLAYER_HEIGHT - 0.2, // Eye level
      z: this._position.z,
    };

    const step = 0.05;
    const steps = Math.ceil(maxDistance / step);

    let prevBlockX = -Infinity;
    let prevBlockY = -Infinity;
    let prevBlockZ = -Infinity;

    for (let i = 0; i <= steps; i++) {
      const dist = i * step;
      const x = eyePos.x + forward.x * dist;
      const y = eyePos.y + forward.y * dist;
      const z = eyePos.z + forward.z * dist;

      const bx = Math.floor(x);
      const by = Math.floor(y);
      const bz = Math.floor(z);

      // Skip if same block as previous step
      if (bx === prevBlockX && by === prevBlockY && bz === prevBlockZ) {
        continue;
      }

      const blockId = getBlock(bx, by, bz);

      if (blockId !== 0) {
        // Calculate hit normal from the direction we entered the block
        const normal = calculateHitNormal(
          x, y, z,
          bx, by, bz,
          forward,
        );

        return {
          position: { x, y, z },
          normal,
          blockPos: { x: bx, y: by, z: bz },
        };
      }

      prevBlockX = bx;
      prevBlockY = by;
      prevBlockZ = bz;
    }

    return null;
  }
}

function calculateHitNormal(
  hitX: number,
  hitY: number,
  hitZ: number,
  blockX: number,
  blockY: number,
  blockZ: number,
  direction: Vector3Like,
): Vector3Like {
  // Calculate which face of the block was hit based on the
  // fractional position within the block
  const fx = hitX - blockX;
  const fy = hitY - blockY;
  const fz = hitZ - blockZ;

  // Distance to each face
  const distPosX = 1 - fx;
  const distNegX = fx;
  const distPosY = 1 - fy;
  const distNegY = fy;
  const distPosZ = 1 - fz;
  const distNegZ = fz;

  // Find the closest face that aligns with the incoming direction
  let minDist = Infinity;
  let normal: Vector3Like = { x: 0, y: 1, z: 0 };

  if (direction.x > 0 && distNegX < minDist) {
    minDist = distNegX;
    normal = { x: -1, y: 0, z: 0 };
  }
  if (direction.x < 0 && distPosX < minDist) {
    minDist = distPosX;
    normal = { x: 1, y: 0, z: 0 };
  }
  if (direction.y > 0 && distNegY < minDist) {
    minDist = distNegY;
    normal = { x: 0, y: -1, z: 0 };
  }
  if (direction.y < 0 && distPosY < minDist) {
    minDist = distPosY;
    normal = { x: 0, y: 1, z: 0 };
  }
  if (direction.z > 0 && distNegZ < minDist) {
    minDist = distNegZ;
    normal = { x: 0, y: 0, z: -1 };
  }
  if (direction.z < 0 && distPosZ < minDist) {
    minDist = distPosZ;
    normal = { x: 0, y: 0, z: 1 };
  }

  return normal;
}
