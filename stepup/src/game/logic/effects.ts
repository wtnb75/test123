import {
    BAR_BOTTOM_MARGIN,
    BAR_TOP,
    CONFETTI_COUNT,
    CONFETTI_GRAVITY,
    CONFETTI_S,
    CONFETTI_SPEED,
    CONFETTI_SPEED_STEP,
    DANGER_MAX_ALPHA,
    DANGER_RANGE,
    ENDING_BLINK_S,
    GOAL_BLINK_ALPHA,
    GOAL_METERS,
    LAND_PUFF_MIN_VY,
    PLATFORM_BLINK_ALPHA,
    PLATFORM_BLINK_S,
    PLATFORM_BLINK_WARN_S,
    PLATFORM_GROW_S,
    PLATFORM_LIFE,
    PLATFORM_W,
    PUFF_ALPHA,
    PUFF_COUNT,
    PUFF_R0,
    PUFF_R1,
    PUFF_S,
    PUFF_SPACING,
    SCREEN_WIDTH,
    WARN_PULSE_PERIOD,
    WARN_PULSE_S,
    WARN_PULSE_SCALE,
    WARN_Y,
} from '../params';
import { warnTriangle } from './bullets';
import { type Platform, platformAlpha } from './physics';
import type { Outcome } from './sim';

// Pure decisions behind the effects (docs/spec.md "演出・UI（Game）"). The Scene only draws what these return.
// "t" is the time in seconds since the effect's trigger frame (t = 0), unless a name says otherwise.

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Which interval of the shared ending blink t falls in: even = the first (bright / red) look. */
const blinkIsEven = (t: number): boolean => Math.floor(t / ENDING_BLINK_S) % 2 === 0;

/** Opacity of the red band at the bottom edge: 0 when the feet are DANGER_RANGE above the edge, max at the edge. */
export function dangerAlpha(feetY: number, viewBottom: number): number {
    return DANGER_MAX_ALPHA * clamp((feetY - (viewBottom - DANGER_RANGE)) / DANGER_RANGE, 0, 1);
}

/** The band after a `left-behind`: max and half of max in turn, every ENDING_BLINK_S. */
export function endingDangerAlpha(t: number): number {
    return blinkIsEven(t) ? DANGER_MAX_ALPHA : DANGER_MAX_ALPHA / 2;
}

/** Centre y of the progress-bar marker for a (real) height in metres and the screen height. */
export function barMarkerY(m: number, height: number): number {
    const bottom = height - BAR_BOTTOM_MARGIN;
    return bottom - (clamp(m, 0, GOAL_METERS) / GOAL_METERS) * (bottom - BAR_TOP);
}

export type PlayerLook = 'normal' | 'red';

/** The player's colour: red and normal in turn after a `hit`; normal otherwise. */
export function playerLook(outcome: Outcome | null, t: number): PlayerLook {
    return outcome === 'hit' && blinkIsEven(t) ? 'red' : 'normal';
}

/** Opacity of the goal platform while it blinks after a `clear`. */
export function goalBlinkAlpha(t: number): number {
    return blinkIsEven(t) ? 1 : GOAL_BLINK_ALPHA;
}

export interface ConfettiParticle {
    /** Offset from the start point. */
    x: number;
    y: number;
    alpha: number;
}

/** The i-th confetti piece (0-based) after t seconds, from the start point (0, 0); y grows downward. */
export function confettiParticle(i: number, t: number): ConfettiParticle {
    const angle = -Math.PI + (Math.PI * (i + 0.5)) / CONFETTI_COUNT;
    const speed = CONFETTI_SPEED + CONFETTI_SPEED_STEP * (i % 3);
    return {
        x: speed * Math.cos(angle) * t,
        y: speed * Math.sin(angle) * t + 0.5 * CONFETTI_GRAVITY * t * t,
        alpha: Math.max(0, 1 - t / CONFETTI_S),
    };
}

export type MoveEvent = 'jump' | 'land';

export interface MoveSample {
    onGround: boolean;
    vy: number;
}

/**
 * The jump / landing of one frame from the player before and after it (the vy of `before` is the speed the
 * frame started with). A landing needs a fall of LAND_PUFF_MIN_VY or more; walking off an edge is neither.
 */
export function moveEvents(before: MoveSample, after: MoveSample): MoveEvent | null {
    if (before.onGround && !after.onGround && after.vy < 0) return 'jump';
    if (!before.onGround && after.onGround && before.vy >= LAND_PUFF_MIN_VY) return 'land';
    return null;
}

export interface PuffLook {
    radius: number;
    alpha: number;
}

/** One dust circle after t seconds; null once PUFF_S has passed (nothing is drawn). */
export function puffParams(t: number): PuffLook | null {
    if (t >= PUFF_S) return null;
    const k = Math.max(0, t) / PUFF_S;
    return { radius: PUFF_R0 + (PUFF_R1 - PUFF_R0) * k, alpha: PUFF_ALPHA * (1 - k) };
}

/** Offsets in x of the PUFF_COUNT dust circles from the feet. */
export const puffOffsets = (): number[] =>
    Array.from({ length: PUFF_COUNT }, (_, k) => (k - (PUFF_COUNT - 1) / 2) * PUFF_SPACING);

/** Drawn width of a platform: a built one grows from 0 to PLATFORM_W over PLATFORM_GROW_S (its hit box doesn't). */
export function platformDrawWidth(age: number): number {
    return PLATFORM_W * Math.min(1, Math.max(0, age) / PLATFORM_GROW_S);
}

/** Opacity of a platform: the life fade, with a blink over the last PLATFORM_BLINK_WARN_S of a built one. */
export function platformEffectAlpha(p: Platform): number {
    const base = platformAlpha(p);
    if (p.kind !== 'built') return base;
    const start = PLATFORM_LIFE - PLATFORM_BLINK_WARN_S;
    if (p.age < start) return base;
    return Math.floor((p.age - start) / PLATFORM_BLINK_S) % 2 === 1 ? PLATFORM_BLINK_ALPHA : base;
}

/** Scale of a warning mark with `remaining` seconds left: a pulse over the last WARN_PULSE_S. */
export function warnPulseScale(remaining: number): number {
    if (remaining > WARN_PULSE_S) return 1;
    const phase = (WARN_PULSE_S - Math.max(0, remaining)) / WARN_PULSE_PERIOD;
    return 1 + (WARN_PULSE_SCALE / 2) * (1 - Math.cos(2 * Math.PI * phase));
}

/**
 * The corners of a warning triangle scaled about its centre, then shifted sideways by the least amount that
 * keeps it inside the screen (the bullet's own x is not changed).
 */
export function pulsedWarnTriangle(x: number, tilt: number, scale: number): [number, number][] {
    const pts = warnTriangle(x, tilt).map(([px, py]): [number, number] => [
        x + (px - x) * scale,
        WARN_Y + (py - WARN_Y) * scale,
    ]);
    const xs = pts.map((p) => p[0]);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    const shift = lo < 0 ? -lo : hi > SCREEN_WIDTH ? SCREEN_WIDTH - hi : 0;
    return pts.map(([px, py]): [number, number] => [px + shift, py]);
}
