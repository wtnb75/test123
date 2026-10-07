import { PARAMS } from '../params';

/** Remaining play time in game milliseconds (never negative). */
export const remainingMs = (elapsedMs: number): number => Math.max(0, PARAMS.gameSeconds * 1000 - elapsedMs);

/** Whole seconds shown on the HUD: rounded up, so the clock reads 0 only when time is up. */
export const displaySeconds = (remaining: number): number => Math.max(0, Math.ceil(remaining / 1000));
