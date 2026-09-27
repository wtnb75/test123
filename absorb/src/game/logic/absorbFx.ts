import {
    ABSORB_PULSE_DURATION, ABSORB_PULSE_WIDTH, ABSORB_RING_DURATION, ABSORB_RING_MAX_RADIUS, ABSORB_SUCK_DURATION,
    ABSORB_TRAIL_ALPHA_STEP, ABSORB_TRAIL_INTERVAL, ENEMY_BULLET_RADIUS, FIELD_EDGE_ALPHA, FIELD_EDGE_WIDTH, FIELD_RADIUS
} from './constants';
import { effectProgress } from './effects';
import { removeWhere, type Point } from './geometry';

/** One absorbed bullet being pulled into the player, from where it was absorbed. */
export interface Suck {
    x: number;
    y: number;
    age: number;
}

const isSuckOver = (s: Suck): boolean => s.age >= ABSORB_SUCK_DURATION;

/**
 * The absorb effects in play: a pull per absorbed bullet, plus one outline pulse and one outer ring
 * that restart whenever anything is absorbed. Drawing only; the rules never read this.
 */
export class AbsorbEffects {
    readonly sucks: Suck[] = [];
    /** Seconds since the last pulse / ring started; Infinity when none is playing. */
    pulseAge = Infinity;
    ringAge = Infinity;

    /**
     * Ages every effect by dt, then starts new ones for the bullets absorbed this frame. Effects
     * only live while playing: any other phase (including the frame the run ends) clears them all.
     */
    update(dt: number, absorbed: readonly Point[], playing: boolean): void {
        if (!playing) {
            this.clear();
            return;
        }
        this.pulseAge += dt;
        this.ringAge += dt;
        for (const s of this.sucks) s.age += dt;
        removeWhere(this.sucks, isSuckOver);
        if (absorbed.length === 0) return;
        this.pulseAge = 0;
        this.ringAge = 0;
        for (const p of absorbed) this.sucks.push({ x: p.x, y: p.y, age: 0 });
    }

    clear(): void {
        this.sucks.length = 0;
        this.pulseAge = Infinity;
        this.ringAge = Infinity;
    }
}

/** Progress of a pull t seconds after the absorb; -1 when not showing. */
export function suckProgress(t: number): number {
    return effectProgress(t, ABSORB_SUCK_DURATION);
}

/**
 * Progress of afterimage k (1-based) of a pull that is t seconds old: the main pull's progress
 * k trail intervals earlier. -1 before it has started, and once the main pull itself is gone.
 */
export function trailProgress(t: number, k: number): number {
    if (suckProgress(t) < 0) return -1;
    return suckProgress(t - k * ABSORB_TRAIL_INTERVAL);
}

export function trailAlpha(k: number): number {
    return 1 - k * ABSORB_TRAIL_ALPHA_STEP;
}

/** One coordinate of a pull: slow at first, quickest as it reaches the player. */
export function suckCoord(start: number, target: number, progress: number): number {
    return start + (target - start) * progress * progress;
}

export function suckRadius(progress: number): number {
    return ENEMY_BULLET_RADIUS * (1 - progress);
}

/** Blends two 0xRRGGBB colors channel by channel; progress 0 gives `from`. */
export function lerpColor(from: number, to: number, progress: number): number {
    let out = 0;
    for (let shift = 16; shift >= 0; shift -= 8) {
        const a = (from >> shift) & 0xff;
        const b = (to >> shift) & 0xff;
        out |= Math.round(a + (b - a) * progress) << shift;
    }
    return out;
}

/** Field outline width `age` seconds after a pulse started (the resting width when none is playing). */
export function edgeWidth(age: number): number {
    const p = effectProgress(age, ABSORB_PULSE_DURATION);
    return p < 0 ? FIELD_EDGE_WIDTH : ABSORB_PULSE_WIDTH + (FIELD_EDGE_WIDTH - ABSORB_PULSE_WIDTH) * p;
}

export function edgeAlpha(age: number): number {
    const p = effectProgress(age, ABSORB_PULSE_DURATION);
    return p < 0 ? FIELD_EDGE_ALPHA : 1 + (FIELD_EDGE_ALPHA - 1) * p;
}

/** Progress of the outer ring `age` seconds after it started; -1 when not showing. */
export function absorbRingProgress(age: number): number {
    return effectProgress(age, ABSORB_RING_DURATION);
}

export function absorbRingRadius(progress: number): number {
    return FIELD_RADIUS + (ABSORB_RING_MAX_RADIUS - FIELD_RADIUS) * progress;
}
