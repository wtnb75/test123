// Play flow that doesn't depend on Phaser: the `playing` / `ending` phases, the walk queue and the
// press session (first finger only, button presses, discard on relayout). Time is passed in, so tests
// can drive it with a fake clock.
import { PARAMS } from '../params';
import { buttonAt, classifyGesture, type Layout } from './layout';
import type { Dir, Pt } from './types';

export type Phase = 'playing' | 'ending';

export type PointerAction =
    | { kind: 'undo' }
    | { kind: 'quit' }
    | { kind: 'tap'; x: number; y: number }
    | { kind: 'swipe'; dir: Dir }
    | { kind: 'none' };

export interface Tick {
    /** The next walking step that is due now, if any. */
    readonly walkStep: Dir | null;
    /** True once, when the `ending` wait is over and the Result Scene should start. */
    readonly ended: boolean;
}

const IDLE: Tick = Object.freeze({ walkStep: null, ended: false });

export class Flow {
    phase: Phase = 'playing';
    private endAt: number | null = null;
    private walkQueue: Dir[] = [];
    private nextWalkAt = 0;
    private pointerId: number | null = null;
    private pressStart: Pt | null = null;
    private discarded = false;

    constructor(
        private readonly endingMs: number = PARAMS.endingMs,
        private readonly walkStepMs: number = PARAMS.walkStepMs,
    ) {}

    // ---- pointer session ---------------------------------------------------------------------

    /**
     * A press. Only the first finger is followed; a press on a button is that button's action only.
     * A new press by the finger already being followed replaces the old one (its release was lost).
     * `isDown` tells whether a pointer is still pressed, to recover from a followed pointer that never
     * reported its release.
     */
    pointerDown(
        id: number,
        x: number,
        y: number,
        layout: Layout,
        isDown: (pointerId: number) => boolean = () => true,
    ): PointerAction {
        // A followed finger that is no longer down never reported its release (a cancelled touch): let go of it.
        if (this.pointerId !== null && this.pointerId !== id && !isDown(this.pointerId)) this.releasePointer();
        if (this.phase !== 'playing' || (this.pointerId !== null && this.pointerId !== id)) return { kind: 'none' };
        this.pointerId = id;
        this.discarded = false;
        this.pressStart = null;
        const button = buttonAt(layout, x, y);
        if (button) {
            this.discarded = true;
            return { kind: button };
        }
        this.pressStart = { x, y };
        return { kind: 'none' };
    }

    /** A release: a tap at the release position, or a swipe, unless the press was discarded. */
    pointerUp(id: number, x: number, y: number): PointerAction {
        if (id !== this.pointerId) return { kind: 'none' };
        const start = this.pressStart;
        const discarded = this.discarded;
        this.pointerId = null;
        this.pressStart = null;
        if (discarded || !start || this.phase !== 'playing') return { kind: 'none' };
        const gesture = classifyGesture(x - start.x, y - start.y);
        return gesture.kind === 'swipe' ? { kind: 'swipe', dir: gesture.dir } : { kind: 'tap', x, y };
    }

    /** The pointer whose press is being followed, if any. */
    get activePointerId(): number | null {
        return this.pointerId;
    }

    /** Forgets the followed pointer (its release was never reported, e.g. a cancelled touch). */
    releasePointer(): void {
        this.pointerId = null;
        this.pressStart = null;
        this.discarded = false;
    }

    /** The window changed orientation under a finger: that input does nothing. */
    discardPress(): void {
        if (this.pointerId !== null) this.discarded = true;
    }

    // ---- walking -----------------------------------------------------------------------------

    startWalk(path: Dir[], now: number): void {
        this.walkQueue = path.slice();
        this.nextWalkAt = now;
    }

    cancelWalk(): void {
        this.walkQueue = [];
    }

    get walking(): boolean {
        return this.walkQueue.length > 0;
    }

    get walkRemaining(): readonly Dir[] {
        return this.walkQueue;
    }

    // ---- ending ------------------------------------------------------------------------------

    beginEnding(now: number): void {
        if (this.phase === 'ending') return;
        this.phase = 'ending';
        this.endAt = now + this.endingMs;
        this.cancelWalk();
    }

    // ---- clock -------------------------------------------------------------------------------

    /**
     * Advances time: returns the walking step due at `now` and whether the ending wait is over.
     * Called every frame, so the common "nothing due" answer is a shared frozen object, not a new one.
     */
    tick(now: number): Tick {
        if (this.phase === 'ending') {
            if (this.endAt === null || now < this.endAt) return IDLE;
            this.endAt = null;
            return { walkStep: null, ended: true };
        }
        if (this.walkQueue.length > 0 && now >= this.nextWalkAt) {
            const walkStep = this.walkQueue.shift() ?? null;
            this.nextWalkAt = now + this.walkStepMs;
            return { walkStep, ended: false };
        }
        return IDLE;
    }
}

/** Result's input guard: input counts only after `guardMs` since the Scene was entered. */
export const guardOpen = (enteredAt: number, now: number, guardMs: number = PARAMS.resultGuardMs): boolean =>
    now - enteredAt >= guardMs;

/**
 * The two-tap Quit button: the first press arms it, a second press within `windowMs` confirms.
 * Time is passed in. Other actions do not disarm it; only the window running out (or `reset`) does.
 */
export class QuitConfirm {
    private armedAt: number | null = null;

    constructor(private readonly windowMs: number = PARAMS.quitConfirmMs) {}

    /** A press of the Quit button; returns true when it confirms (a second press in time). */
    press(now: number): boolean {
        if (this.armed(now)) {
            this.armedAt = null;
            return true;
        }
        this.armedAt = now;
        return false;
    }

    /** Whether a press right now would confirm. */
    armed(now: number): boolean {
        return this.armedAt !== null && now - this.armedAt <= this.windowMs;
    }

    reset(): void {
        this.armedAt = null;
    }
}
