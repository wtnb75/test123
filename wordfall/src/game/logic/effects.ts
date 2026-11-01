// Values behind the effects (docs/spec.md "演出・UI"). The Scenes hand these to Phaser tweens/timers; the
// numbers live here so they can be tested without Phaser.
import {
    BEST_BLINK_ALPHA,
    BEST_BLINK_COUNT,
    BEST_BLINK_MS,
    COMPLETE_GHOST_ALPHA,
    COMPLETE_GHOST_MS,
    COMPLETE_GHOST_SCALE,
    COUNT_UP_MS,
    FIELD_TOP,
    FLY_MS,
    LETTER_SIZE,
    POP_MS,
    POP_RISE,
    POP_STACK_DY,
    POP_STAGGER_MS,
    POP_START_BELOW,
    TIME_BUMP_MS,
    TIME_BUMP_SCALE,
    TRAY_SLOT_H,
    WARN_SEC,
} from '../params';
import { traySlotRect } from './layout';
import type { PickResult } from './round';
import { bonusFor, scoreFor } from './scoring';

/** Linear value between `from` and `to` after `t` of `duration` (clamped to the ends). */
export function valueAt(from: number, to: number, t: number, duration: number): number {
    const p = duration > 0 ? Math.min(1, Math.max(0, t / duration)) : 1;
    return from + (to - from) * p;
}

/** The pop-up text for a completed word of `length` letters: `+170  +7s`. */
export const popText = (length: number): string => `+${scoreFor(length)}  +${bonusFor(length)}s`;

export interface PopTween {
    /** Wait before it starts (ms); nothing is shown until then. */
    delayMs: number;
    fromY: number;
    toY: number;
    alphaFrom: number;
    alphaTo: number;
    durationMs: number;
}

/** The k-th pop-up of one pick (0-based): later ones start later and lower, so they don't overlap. */
export function popTween(k: number): PopTween {
    const fromY = FIELD_TOP + POP_START_BELOW + POP_STACK_DY * k;
    return { delayMs: POP_STAGGER_MS * k, fromY, toY: fromY - POP_RISE, alphaFrom: 1, alphaTo: 0, durationMs: POP_MS };
}

/** TIME shows `shown` seconds (rounded up): red at WARN_SEC and below. */
export const isLowTime = (shown: number): boolean => shown <= WARN_SEC;

/**
 * Whether the TIME text pulses this frame: after a completion, or when the display dropped while in the
 * warning range — but not for the drop that ends the play (the frame entering `ending`).
 */
export function shouldBumpTime(a: { completed: boolean; prevShown: number; shown: number; entersEnding: boolean }): boolean {
    if (a.completed) return true;
    return a.shown < a.prevShown && isLowTime(a.shown) && !a.entersEnding;
}

export interface BumpTween {
    /** One way (up) in ms: the pulse goes up and back down. */
    halfMs: number;
    scaleTo: number;
}

export const bumpTween = (): BumpTween => ({ halfMs: TIME_BUMP_MS / 2, scaleTo: TIME_BUMP_SCALE });

export interface GhostTween {
    durationMs: number;
    scaleTo: number;
    alphaFrom: number;
    alphaTo: number;
}

/** The completed-row highlight: grows and fades out. */
export const ghostTween = (): GhostTween => ({
    durationMs: COMPLETE_GHOST_MS,
    scaleTo: COMPLETE_GHOST_SCALE,
    alphaFrom: COMPLETE_GHOST_ALPHA,
    alphaTo: 0,
});

export interface FlyPlan {
    /** Destination slot: the tray length before the pick. */
    slot: number;
    toX: number;
    toY: number;
    durationMs: number;
    scaleTo: number;
}

/** A picked letter's flight from where it was to the tray slot it lands in (screen height `height`). */
export function flyPlan(trayLengthBefore: number, height: number): FlyPlan {
    const r = traySlotRect(trayLengthBefore, height);
    return {
        slot: trayLengthBefore,
        toX: r.x + r.w / 2,
        toY: r.y + r.h / 2,
        durationMs: FLY_MS,
        scaleTo: TRAY_SLOT_H / LETTER_SIZE,
    };
}

export interface EffectCounts {
    /** The white screen flash (at most once per pick). */
    flash: number;
    /** Completed-row highlights and pop-ups: one per completed word. */
    ghosts: number;
    pops: number;
    /** The letter's flight to the tray (only when it was picked). */
    fly: number;
    /** The red tray rim and the screen shake (only when refused because the tray is full). */
    fullHint: number;
    shake: number;
}

/** Which effects one pick triggers, and how many of each. */
export function effectCounts(result: PickResult): EffectCounts {
    const none = { flash: 0, ghosts: 0, pops: 0, fly: 0, fullHint: 0, shake: 0 };
    if (result.kind === 'full') return { ...none, fullHint: 1, shake: 1 };
    if (result.kind === 'ignored') return none;
    const n = result.completed.length;
    return { ...none, flash: n > 0 ? 1 : 0, ghosts: n, pops: n, fly: 1 };
}

/** The Result score shown `t` ms after Result started: counts up to `score` over COUNT_UP_MS. */
export function countUpValue(t: number, score: number): number {
    return Math.round(valueAt(0, score, t, COUNT_UP_MS));
}

export interface BlinkTween {
    /** Wait before blinking: the count-up has to finish first. */
    delayMs: number;
    alphaTo: number;
    halfMs: number;
    /** Extra repeats after the first blink. */
    repeat: number;
}

/** The NEW BEST! blink: BEST_BLINK_COUNT dips to BEST_BLINK_ALPHA, then stays at full opacity. */
export const blinkTween = (): BlinkTween => ({
    delayMs: COUNT_UP_MS,
    alphaTo: BEST_BLINK_ALPHA,
    halfMs: BEST_BLINK_MS / 2,
    repeat: BEST_BLINK_COUNT - 1,
});
