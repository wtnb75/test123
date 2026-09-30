import {
    FIELD_RADIUS, PLAYER_RADIUS, READY_DURATION, START_DIGIT_REST_ALPHA, START_FADE_IN, START_GO_DURATION,
    START_GO_RING_MAX_RADIUS, START_GO_RING_WIDTH, START_GO_SCALE, START_HUD_FADE, START_POP_DURATION, START_POP_SCALE,
    START_RING_DURATION, START_RING_WIDTH
} from './constants';
import { effectProgress } from './effects';
import { removeWhere } from './geometry';
import type { Phase } from './world';

// The start effects: everything is drawing only and hangs off the ready clock T (World.phaseTime) and the
// ready -> playing change. `s` below is the seconds into the current countdown digit, 0 <= s < 1.

const DIGITS = 3;

/** Which digit is up: 0, 1, 2 for "3", "2", "1" (T = 1 exactly is already the next digit). */
export function digitIndex(readyTime: number): number {
    return Math.min(DIGITS - 1, Math.max(0, Math.floor(readyTime)));
}

/** The number shown at ready time T. */
export function digitLabel(readyTime: number): string {
    return String(DIGITS - digitIndex(readyTime));
}

/** Seconds into the current digit. */
export function digitTime(readyTime: number): number {
    return readyTime - Math.floor(readyTime);
}

/** A digit pops in large and eases down to its normal size. */
export function digitScale(s: number): number {
    const p = effectProgress(s, START_POP_DURATION);
    if (p < 0) return 1;
    return 1 + (START_POP_SCALE - 1) * (1 - p) ** 3;
}

/** Fades in over START_FADE_IN, then slowly dims towards START_DIGIT_REST_ALPHA until the next digit. */
export function digitAlpha(s: number): number {
    if (s < START_FADE_IN) return s / START_FADE_IN;
    return 1 - ((1 - START_DIGIT_REST_ALPHA) * (s - START_FADE_IN)) / (1 - START_FADE_IN);
}

/** Radius the field is drawn at while readying: grows from nothing to FIELD_RADIUS, easing out. */
export function chargeRadius(readyTime: number): number {
    const u = Math.min(1, Math.max(0, readyTime / READY_DURATION));
    return FIELD_RADIUS * (1 - (1 - u) ** 3);
}

/** Opacity of the HUD: rises from 0 to 1 over the first START_HUD_FADE seconds of ready. */
export function hudAlpha(readyTime: number): number {
    return Math.min(1, Math.max(0, readyTime / START_HUD_FADE));
}

/** Progress of the "GO!" text `age` seconds after the start; -1 when not showing. */
export function goProgress(age: number): number {
    return effectProgress(age, START_GO_DURATION);
}

export function goScale(progress: number): number {
    return 1 + (START_GO_SCALE - 1) * progress;
}

export function goAlpha(progress: number): number {
    return 1 - progress;
}

/** A ring left where the player was when it started: a small one per countdown digit, a big one at the start. */
export interface StartRing {
    x: number;
    y: number;
    age: number;
    big: boolean;
}

const isRingOver = (r: StartRing): boolean => r.age >= START_RING_DURATION;

/** Progress of a start ring `age` seconds after it started; -1 when not showing. */
export function startRingProgress(age: number): number {
    return effectProgress(age, START_RING_DURATION);
}

export function startRingRadius(big: boolean, progress: number): number {
    const max = big ? START_GO_RING_MAX_RADIUS : FIELD_RADIUS;
    return PLAYER_RADIUS + (max - PLAYER_RADIUS) * progress;
}

export function startRingWidth(big: boolean): number {
    return big ? START_GO_RING_WIDTH : START_RING_WIDTH;
}

/**
 * The start effects in play: a ring at each new countdown digit, and the "GO!" text with its big ring on
 * the frame the phase changes from ready to playing. Drawing only: the rules never read this.
 */
export class StartEffects {
    readonly rings: StartRing[] = [];
    /** Seconds since "GO!" started; Infinity when it is not playing. */
    goAge = Infinity;
    private lastPhase: Phase = 'ready';
    private lastDigit = -1;

    /** Ages the effects by dt, then starts what this frame calls for. (x, y) is the player's centre after the frame's move. */
    update(dt: number, phase: Phase, readyTime: number, x: number, y: number): void {
        for (const r of this.rings) r.age += dt;
        removeWhere(this.rings, isRingOver);
        this.goAge += dt;
        if (phase === 'ready') {
            const digit = digitIndex(readyTime);
            if (digit > this.lastDigit) {
                this.lastDigit = digit;
                this.rings.push({ x, y, age: 0, big: false });
            }
        } else if (this.lastPhase === 'ready' && phase === 'playing') {
            this.goAge = 0;
            this.rings.push({ x, y, age: 0, big: true });
        }
        this.lastPhase = phase;
    }

    clear(): void {
        this.rings.length = 0;
        this.goAge = Infinity;
        this.lastPhase = 'ready';
        this.lastDigit = -1;
    }
}
