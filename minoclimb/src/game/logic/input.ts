// Turns raw keyboard / pointer state into game input. Pure logic, no Phaser.
import type { MoveInput } from './player';

export interface PointerState {
    id: number;
    /** Current position, logical px. */
    x: number;
    y: number;
    /** Where this press started, logical px. */
    downX: number;
    downY: number;
    isDown: boolean;
}

export interface RawInput {
    /** `KeyboardEvent.code` values currently held (pressed fresh, not carried over from before). */
    keys: ReadonlySet<string>;
    pointers: readonly PointerState[];
    /** Keys pressed since the previous read, even if they were released again before this one. */
    pressedKeys: ReadonlySet<string>;
    /** A primary button or finger went down since the previous read. */
    pointerPressed: boolean;
}

export interface StickView {
    /** Where the ring is: the touch point, moved along by the finger (see `InputArbiter`). */
    anchorX: number;
    anchorY: number;
    /** Pointer offset from the anchor, clamped to the ring. */
    knobDx: number;
    knobDy: number;
}

export interface ReadResult {
    move: MoveInput;
    /** Null when no finger is driving the stick. */
    stick: StickView | null;
}

export const LEFT_KEYS: readonly string[] = ['ArrowLeft', 'KeyA'];
export const RIGHT_KEYS: readonly string[] = ['ArrowRight', 'KeyD'];
export const JUMP_KEYS: readonly string[] = ['ArrowUp', 'KeyW', 'Space'];
export const START_KEYS: readonly string[] = ['Space', 'Enter'];
export const RETRY_KEYS: readonly string[] = ['KeyR', 'Space'];

type Role = 'ignored' | 'stick' | 'jump';

const clamp = (v: number, limit: number): number => Math.max(-limit, Math.min(limit, v));

/**
 * Only inputs that began after `blockHeld` count: keys and fingers already down at that moment are
 * ignored until released. Left-half fingers drive a floating stick (move sideways, flick up to jump),
 * right-half fingers jump. The stick's anchor starts at the touch point and follows the finger: sideways
 * both ways, downwards only, so it never trails the finger by more than `ringRadius`.
 * `read` returns the same result object every call (it is overwritten by the next call).
 */
export class InputArbiter {
    private readonly blockedKeys = new Set<string>();
    private readonly roles = new Map<number, Role>();
    private readonly live = new Set<number>();
    private stickId: number | null = null;
    private anchorX = 0;
    private anchorY = 0;
    /** Jump state of the stick (with hysteresis). Off whenever a new finger takes the stick. */
    private flicked = false;
    private readonly offset = { dx: 0, dy: 0 };
    private readonly move: MoveInput = { left: false, right: false, jump: false };
    private readonly stickView: StickView = { anchorX: 0, anchorY: 0, knobDx: 0, knobDy: 0 };
    private readonly result: ReadResult = { move: this.move, stick: null };

    constructor(
        private readonly halfWidth: number,
        private readonly deadzone: number,
        private readonly ringRadius: number,
        private readonly jumpFlick: number,
        private readonly jumpRelease: number,
    ) {}

    /** Everything held right now is ignored until it is released. */
    blockHeld(raw: RawInput): void {
        this.blockedKeys.clear();
        for (const k of raw.keys) this.blockedKeys.add(k);
        this.roles.clear();
        this.stickId = null;
        for (const p of raw.pointers) {
            if (p.isDown) this.roles.set(p.id, 'ignored');
        }
    }

    read(raw: RawInput): ReadResult {
        for (const k of this.blockedKeys) {
            if (!raw.keys.has(k)) this.blockedKeys.delete(k);
        }
        let left = this.keyDown(raw, LEFT_KEYS);
        let right = this.keyDown(raw, RIGHT_KEYS);
        let jump = this.keyDown(raw, JUMP_KEYS);
        let stick: StickView | null = null;

        this.live.clear();
        for (const p of raw.pointers) {
            if (!p.isDown) continue;
            this.live.add(p.id);
            if (!this.roles.has(p.id)) this.roles.set(p.id, this.classify(p));
        }
        for (const id of this.roles.keys()) {
            if (this.live.has(id)) continue;
            this.roles.delete(id);
            if (this.stickId === id) this.stickId = null;
        }

        for (const p of raw.pointers) {
            if (!p.isDown) continue;
            const role = this.roles.get(p.id);
            if (role === 'jump') jump = true;
            if (role !== 'stick') continue;
            const { dx, dy } = this.follow(p);
            if (dx < -this.deadzone) left = true;
            else if (dx > this.deadzone) right = true;
            this.flicked = this.flicked ? dy < -this.jumpRelease : dy < -this.jumpFlick;
            if (this.flicked) jump = true;
            this.stickView.anchorX = this.anchorX;
            this.stickView.anchorY = this.anchorY;
            this.stickView.knobDx = dx;
            this.stickView.knobDy = clamp(dy, this.ringRadius);
            stick = this.stickView;
        }
        this.move.left = left && !right;
        this.move.right = right && !left;
        this.move.jump = jump;
        this.result.stick = stick;
        return this.result;
    }

    private keyDown(raw: RawInput, codes: readonly string[]): boolean {
        for (const k of codes) {
            if (raw.keys.has(k) && !this.blockedKeys.has(k)) return true;
        }
        return false;
    }

    /** Moves the anchor after the finger (sideways both ways, downwards only) and returns the offset. */
    private follow(p: PointerState): { dx: number; dy: number } {
        this.anchorX = p.x - clamp(p.x - this.anchorX, this.ringRadius);
        if (p.y - this.anchorY > this.ringRadius) this.anchorY = p.y - this.ringRadius;
        this.offset.dx = p.x - this.anchorX;
        this.offset.dy = p.y - this.anchorY;
        return this.offset;
    }

    private classify(p: PointerState): Role {
        if (p.downX >= this.halfWidth) return 'jump';
        if (this.stickId === null) {
            this.stickId = p.id;
            this.anchorX = p.downX;
            this.anchorY = p.downY;
            this.flicked = false;
            return 'stick';
        }
        return 'ignored';
    }
}

/**
 * True when one of `codes` (or any pointer) was pressed since the previous read. Presses are latched by
 * the input layer, so a tap shorter than a frame still counts and a held key never counts again.
 */
export const wasPressed = (raw: RawInput, codes: readonly string[]): boolean => {
    if (raw.pointerPressed) return true;
    for (const code of codes) {
        if (raw.pressedKeys.has(code)) return true;
    }
    return false;
};
