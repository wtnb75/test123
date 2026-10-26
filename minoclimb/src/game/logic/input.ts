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

/** A press that began and ended between two reads (shorter than a frame): it is never seen as down. */
export interface QuickTap {
    id: number;
    /** Where it began and where it ended, logical px. */
    downX: number;
    downY: number;
    x: number;
    y: number;
}

export interface RawInput {
    /** `KeyboardEvent.code` values currently held (pressed fresh, not carried over from before). */
    keys: ReadonlySet<string>;
    pointers: readonly PointerState[];
    /** Keys pressed since the previous read, even if they were released again before this one. */
    pressedKeys: ReadonlySet<string>;
    /** A primary button or finger went down since the previous read. */
    pointerPressed: boolean;
    /** Where each of those presses began, logical px (one entry per press, in arrival order). */
    pressPoints: readonly { x: number; y: number }[];
    /** Presses that began and ended since the previous read without being seen down. */
    quickTaps: readonly QuickTap[];
    /** Fingers that vanished since the previous read without a normal release (cancel, lost). */
    cancelled: ReadonlySet<number>;
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

export interface ArbiterConfig {
    deadzone: number;
    ringRadius: number;
    jumpFlick: number;
    jumpRelease: number;
    tapMaxTime: number;
    tapSlop: number;
    tapJumpHold: number;
}

export const LEFT_KEYS: readonly string[] = ['ArrowLeft', 'KeyA'];
export const RIGHT_KEYS: readonly string[] = ['ArrowRight', 'KeyD'];
export const JUMP_KEYS: readonly string[] = ['ArrowUp', 'KeyW', 'Space'];
export const START_KEYS: readonly string[] = ['Space', 'Enter'];
export const RETRY_KEYS: readonly string[] = ['KeyR', 'Space'];

type Role = 'ignored' | 'stick' | 'jump';

/** Slack for comparing sums of frame times with the exact limits of the spec. */
const EPS = 1e-9;

const clamp = (v: number, limit: number): number => Math.max(-limit, Math.min(limit, v));

/**
 * Only inputs that began after `blockHeld` count: keys and fingers already down at that moment are
 * ignored until released. The whole screen is one pad. The first finger (while no finger drives the stick)
 * drives a floating stick (move sideways, flick up to jump); a later finger jumps while it touches. A
 * finger that is lifted soon, without moving and without a second finger, is a tap: a short jump pulse.
 * The stick's anchor starts at the touch point and follows the finger: sideways both ways, downwards
 * only, so it never trails the finger by more than `ringRadius`.
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
    /** Where the stick finger began, and how it has behaved so far (the tap conditions). */
    private downX = 0;
    private downY = 0;
    private heldFor = 0;
    private moved = false;
    private joined = false;
    /** Seconds the tap's jump pulse still has to run (<= 0: no pulse). */
    private pulseLeft = 0;
    private readonly offset = { dx: 0, dy: 0 };
    private readonly move: MoveInput = { left: false, right: false, jump: false };
    private readonly stickView: StickView = { anchorX: 0, anchorY: 0, knobDx: 0, knobDy: 0 };
    private readonly result: ReadResult = { move: this.move, stick: null };

    constructor(private readonly cfg: ArbiterConfig) {}

    /** Everything held right now is ignored until it is released. */
    blockHeld(raw: RawInput): void {
        this.blockedKeys.clear();
        for (const k of raw.keys) this.blockedKeys.add(k);
        this.roles.clear();
        this.stickId = null;
        this.pulseLeft = 0;
        for (const p of raw.pointers) {
            if (p.isDown) this.roles.set(p.id, 'ignored');
        }
    }

    /** `dt` is the frame time in seconds, capped like the round's clock. */
    read(raw: RawInput, dt: number): ReadResult {
        for (const k of this.blockedKeys) {
            if (!raw.keys.has(k)) this.blockedKeys.delete(k);
        }
        let left = this.keyDown(raw, LEFT_KEYS);
        let right = this.keyDown(raw, RIGHT_KEYS);
        let jump = this.keyDown(raw, JUMP_KEYS);
        let stick: StickView | null = null;

        if (this.stickId !== null) this.heldFor += dt;
        if (this.pulseLeft > 0) this.pulseLeft -= dt;

        this.live.clear();
        for (const p of raw.pointers) {
            if (p.isDown) this.live.add(p.id);
        }
        for (const id of this.roles.keys()) {
            if (this.live.has(id)) continue;
            this.roles.delete(id);
            if (this.stickId === id) this.release(raw, id);
        }
        for (const q of raw.quickTaps) jump = this.quickTap(q) || jump;
        for (const p of raw.pointers) {
            if (p.isDown && !this.roles.has(p.id)) this.roles.set(p.id, this.classify(p));
        }

        for (const p of raw.pointers) {
            if (!p.isDown) continue;
            const role = this.roles.get(p.id);
            if (role === 'jump') jump = true;
            if (role !== 'stick') continue;
            const { dx, dy } = this.follow(p);
            if (dx < -this.cfg.deadzone) left = true;
            else if (dx > this.cfg.deadzone) right = true;
            this.flicked = this.flicked ? dy < -this.cfg.jumpRelease : dy < -this.cfg.jumpFlick;
            if (this.flicked) jump = true;
            this.noteMove(p.x, p.y);
            this.stickView.anchorX = this.anchorX;
            this.stickView.anchorY = this.anchorY;
            this.stickView.knobDx = dx;
            this.stickView.knobDy = clamp(dy, this.cfg.ringRadius);
            stick = this.stickView;
        }
        if (this.pulseLeft > EPS) jump = true;
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
        const r = this.cfg.ringRadius;
        this.anchorX = p.x - clamp(p.x - this.anchorX, r);
        if (p.y - this.anchorY > r) this.anchorY = p.y - r;
        this.offset.dx = p.x - this.anchorX;
        this.offset.dy = p.y - this.anchorY;
        return this.offset;
    }

    /** A position read for the stick finger: once it is further than the tap slop from where it began, it is no tap. */
    private noteMove(x: number, y: number): void {
        if (Math.hypot(x - this.downX, y - this.downY) > this.cfg.tapSlop) this.moved = true;
    }

    /** The stick finger is gone: a quick, still, lone finger that was not cancelled starts the jump pulse. */
    private release(raw: RawInput, id: number): void {
        this.stickId = null;
        const end = raw.pointers.find((p) => p.id === id);
        if (end) this.noteMove(end.x, end.y);
        const tap = !raw.cancelled.has(id) && !this.moved && !this.joined && this.heldFor <= this.cfg.tapMaxTime + EPS;
        if (tap) this.pulseLeft = this.cfg.tapJumpHold;
    }

    /**
     * A press shorter than a frame. With no stick finger it is a whole tap (if it stayed within the slop);
     * with one it is a second finger that touched and left: a one-frame jump, and the stick finger is no tap.
     * Returns true when it jumps in this read.
     */
    private quickTap(q: QuickTap): boolean {
        if (this.stickId !== null) {
            this.joined = true;
            return true;
        }
        if (Math.hypot(q.x - q.downX, q.y - q.downY) > this.cfg.tapSlop) return false;
        this.pulseLeft = this.cfg.tapJumpHold;
        return false;
    }

    private classify(p: PointerState): Role {
        if (this.stickId !== null) {
            this.joined = true;
            return 'jump';
        }
        this.stickId = p.id;
        this.anchorX = p.downX;
        this.anchorY = p.downY;
        this.flicked = false;
        this.downX = p.downX;
        this.downY = p.downY;
        this.heldFor = 0;
        this.moved = false;
        this.joined = false;
        return 'stick';
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
