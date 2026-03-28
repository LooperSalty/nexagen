import type { InputState } from '@nexagen/shared';

const EMPTY_INPUT: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  sprint: false,
  interact: false,
  inventory: false,
  attack: false,
  placeBlock: false,
  mouseDelta: { x: 0, y: 0 },
  selectedSlot: 0,
};

// Key code sets for AZERTY/QWERTY dual support
const FORWARD_KEYS = new Set(['KeyW', 'KeyZ']);
const BACKWARD_KEYS = new Set(['KeyS']);
const LEFT_KEYS = new Set(['KeyA', 'KeyQ']);
const RIGHT_KEYS = new Set(['KeyD']);
const JUMP_KEYS = new Set(['Space']);
const SPRINT_KEYS = new Set(['ShiftLeft', 'ShiftRight']);
const INTERACT_KEYS = new Set(['KeyE']);
const INVENTORY_KEYS = new Set(['Tab']);

const HOTBAR_KEYS: ReadonlyMap<string, number> = new Map([
  ['Digit1', 0],
  ['Digit2', 1],
  ['Digit3', 2],
  ['Digit4', 3],
  ['Digit5', 4],
  ['Digit6', 5],
  ['Digit7', 6],
  ['Digit8', 7],
  ['Digit9', 8],
]);

export class InputManager {
  private _currentState: InputState = EMPTY_INPUT;
  private _previousState: InputState = EMPTY_INPUT;
  private _isPointerLocked: boolean = false;
  private _canvas: HTMLCanvasElement | null = null;

  // Raw input accumulators (mutable internally, exposed immutably)
  private _keys: Set<string> = new Set();
  private _mouseDeltaX: number = 0;
  private _mouseDeltaY: number = 0;
  private _mouseLeft: boolean = false;
  private _mouseRight: boolean = false;
  private _selectedSlot: number = 0;

  // Bound handler references for cleanup
  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _boundKeyUp: ((e: KeyboardEvent) => void) | null = null;
  private _boundMouseMove: ((e: MouseEvent) => void) | null = null;
  private _boundMouseDown: ((e: MouseEvent) => void) | null = null;
  private _boundMouseUp: ((e: MouseEvent) => void) | null = null;
  private _boundPointerLockChange: (() => void) | null = null;
  private _boundContextMenu: ((e: Event) => void) | null = null;

  get currentState(): InputState {
    return this._currentState;
  }

  get previousState(): InputState {
    return this._previousState;
  }

  get isPointerLocked(): boolean {
    return this._isPointerLocked;
  }

  init(canvas: HTMLCanvasElement): void {
    this._canvas = canvas;

    this._boundKeyDown = (e: KeyboardEvent) => {
      // Prevent default for game keys
      if (
        FORWARD_KEYS.has(e.code) ||
        BACKWARD_KEYS.has(e.code) ||
        LEFT_KEYS.has(e.code) ||
        RIGHT_KEYS.has(e.code) ||
        JUMP_KEYS.has(e.code) ||
        INTERACT_KEYS.has(e.code) ||
        INVENTORY_KEYS.has(e.code) ||
        HOTBAR_KEYS.has(e.code)
      ) {
        e.preventDefault();
      }

      this._keys.add(e.code);

      const hotbarSlot = HOTBAR_KEYS.get(e.code);
      if (hotbarSlot !== undefined) {
        this._selectedSlot = hotbarSlot;
      }
    };

    this._boundKeyUp = (e: KeyboardEvent) => {
      this._keys.delete(e.code);
    };

    this._boundMouseMove = (e: MouseEvent) => {
      if (this._isPointerLocked) {
        this._mouseDeltaX += e.movementX;
        this._mouseDeltaY += e.movementY;
      }
    };

    this._boundMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        this._mouseLeft = true;

        // Request pointer lock on first click
        if (!this._isPointerLocked && this._canvas) {
          this.requestPointerLock();
        }
      }
      if (e.button === 2) {
        this._mouseRight = true;
      }
    };

    this._boundMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        this._mouseLeft = false;
      }
      if (e.button === 2) {
        this._mouseRight = false;
      }
    };

    this._boundPointerLockChange = () => {
      this._isPointerLocked = document.pointerLockElement === this._canvas;
    };

    this._boundContextMenu = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('keydown', this._boundKeyDown);
    document.addEventListener('keyup', this._boundKeyUp);
    document.addEventListener('mousemove', this._boundMouseMove);
    canvas.addEventListener('mousedown', this._boundMouseDown);
    document.addEventListener('mouseup', this._boundMouseUp);
    document.addEventListener('pointerlockchange', this._boundPointerLockChange);
    canvas.addEventListener('contextmenu', this._boundContextMenu);
  }

  update(): void {
    this._previousState = this._currentState;

    const hasAnyForward = setHasAny(this._keys, FORWARD_KEYS);
    const hasAnyBackward = setHasAny(this._keys, BACKWARD_KEYS);
    const hasAnyLeft = setHasAny(this._keys, LEFT_KEYS);
    const hasAnyRight = setHasAny(this._keys, RIGHT_KEYS);
    const hasAnyJump = setHasAny(this._keys, JUMP_KEYS);
    const hasAnySprint = setHasAny(this._keys, SPRINT_KEYS);
    const hasAnyInteract = setHasAny(this._keys, INTERACT_KEYS);
    const hasAnyInventory = setHasAny(this._keys, INVENTORY_KEYS);

    this._currentState = {
      forward: hasAnyForward,
      backward: hasAnyBackward,
      left: hasAnyLeft,
      right: hasAnyRight,
      jump: hasAnyJump,
      sprint: hasAnySprint,
      interact: hasAnyInteract,
      inventory: hasAnyInventory,
      attack: this._mouseLeft,
      placeBlock: this._mouseRight,
      mouseDelta: { x: this._mouseDeltaX, y: this._mouseDeltaY },
      selectedSlot: this._selectedSlot,
    };

    // Reset mouse delta accumulator after reading
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
  }

  requestPointerLock(): void {
    if (this._canvas && !this._isPointerLocked) {
      this._canvas.requestPointerLock();
    }
  }

  isKeyJustPressed(keyCode: string): boolean {
    return this._keys.has(keyCode) && !wasPreviouslyPressed(this._previousState, keyCode);
  }

  dispose(): void {
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
    }
    if (this._boundKeyUp) {
      document.removeEventListener('keyup', this._boundKeyUp);
    }
    if (this._boundMouseMove) {
      document.removeEventListener('mousemove', this._boundMouseMove);
    }
    if (this._boundMouseDown && this._canvas) {
      this._canvas.removeEventListener('mousedown', this._boundMouseDown);
    }
    if (this._boundMouseUp) {
      document.removeEventListener('mouseup', this._boundMouseUp);
    }
    if (this._boundPointerLockChange) {
      document.removeEventListener('pointerlockchange', this._boundPointerLockChange);
    }
    if (this._boundContextMenu && this._canvas) {
      this._canvas.removeEventListener('contextmenu', this._boundContextMenu);
    }

    if (this._isPointerLocked) {
      document.exitPointerLock();
    }

    this._keys.clear();
    this._currentState = EMPTY_INPUT;
    this._previousState = EMPTY_INPUT;
    this._canvas = null;
    this._isPointerLocked = false;

    this._boundKeyDown = null;
    this._boundKeyUp = null;
    this._boundMouseMove = null;
    this._boundMouseDown = null;
    this._boundMouseUp = null;
    this._boundPointerLockChange = null;
    this._boundContextMenu = null;
  }
}

function setHasAny(source: Set<string>, targets: Set<string>): boolean {
  for (const key of targets) {
    if (source.has(key)) {
      return true;
    }
  }
  return false;
}

function wasPreviouslyPressed(state: InputState, keyCode: string): boolean {
  // Map key codes back to input state fields
  if (FORWARD_KEYS.has(keyCode)) return state.forward;
  if (BACKWARD_KEYS.has(keyCode)) return state.backward;
  if (LEFT_KEYS.has(keyCode)) return state.left;
  if (RIGHT_KEYS.has(keyCode)) return state.right;
  if (JUMP_KEYS.has(keyCode)) return state.jump;
  if (SPRINT_KEYS.has(keyCode)) return state.sprint;
  if (INTERACT_KEYS.has(keyCode)) return state.interact;
  if (INVENTORY_KEYS.has(keyCode)) return state.inventory;
  return false;
}
