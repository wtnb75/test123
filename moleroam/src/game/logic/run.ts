import { PARAMS } from '../params';

/**
 * Remaining play time in game milliseconds (never negative). `bonusMs` is the time clocks have added so far
 * (docs/spec/items.md); there is no cap, so the total can pass the starting time.
 */
export const remainingMs = (elapsedMs: number, bonusMs = 0): number =>
    Math.max(0, PARAMS.gameSeconds * 1000 + bonusMs - elapsedMs);

/** True once the displayed seconds are `lowTimeSeconds` or fewer: the clock is shown red and pulsing. */
export const isLowTime = (remaining: number): boolean => displaySeconds(remaining) <= PARAMS.lowTimeSeconds;

/**
 * Size of the remaining-time text: while low, it jumps to 1 + lowTimePulse at each second change and
 * shrinks back to 1 by the next one; otherwise 1.
 */
export const timePulseScale = (remaining: number): number =>
    isLowTime(remaining) ? 1 + PARAMS.lowTimePulse * ((remaining % 1000) / 1000) : 1;

/** Whole seconds shown on the HUD: rounded up, so the clock reads 0 only when time is up. */
export const displaySeconds = (remaining: number): number => Math.max(0, Math.ceil(remaining / 1000));
