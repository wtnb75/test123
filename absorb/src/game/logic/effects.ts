import {
    BOSS_ANNOUNCE_FADE, BOSS_DEFEAT_RING_DELAY, BOSS_DEFEAT_RING_DURATION, BOSS_DEFEAT_RING_MAX_RADIUS, BOSS_HIT_FLASH,
    BOSS_RADIUS, BOSS_SCORE_POPUP_DURATION, BOSS_SCORE_POPUP_RISE
} from './constants';

/**
 * How far an effect of the given length is after t seconds, from 0 to just under 1.
 * Returns -1 when it hasn't started (t < 0) or has already ended (t >= duration).
 */
export function effectProgress(t: number, duration: number): number {
    return t >= 0 && t < duration ? t / duration : -1;
}

/** Opacity of the "BOSS" announcement with `left` seconds of it remaining. */
export function announceAlpha(left: number): number {
    if (left <= 0) return 0;
    return Math.min(1, left / BOSS_ANNOUNCE_FADE);
}

export function hitFlashVisible(t: number): boolean {
    return effectProgress(t, BOSS_HIT_FLASH) >= 0;
}

/** Progress of defeat ring `index` (0 or 1) t seconds after the kill; -1 when not showing. */
export function defeatRingProgress(t: number, index: number): number {
    return effectProgress(t - index * BOSS_DEFEAT_RING_DELAY, BOSS_DEFEAT_RING_DURATION);
}

export function defeatRingRadius(progress: number): number {
    return BOSS_RADIUS + (BOSS_DEFEAT_RING_MAX_RADIUS - BOSS_RADIUS) * progress;
}

/** Progress of the "+score" popup t seconds after the kill; -1 when not showing. */
export function scorePopupProgress(t: number): number {
    return effectProgress(t, BOSS_SCORE_POPUP_DURATION);
}

export function scorePopupRise(progress: number): number {
    return BOSS_SCORE_POPUP_RISE * progress;
}

/** Linear fade used by every effect: fully opaque at the start, transparent at the end. */
export function fadeAlpha(progress: number): number {
    return 1 - progress;
}
