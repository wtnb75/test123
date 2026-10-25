import { BG_COLORS } from './constants';

// Presentation only: the backdrop stage, star motion and the ship shapes. Hit tests stay circles.

// Same stage boundaries as getDifficultyParams: 10, 20, 30, 60, 120 seconds.
const STAGE_START_SEC = [10, 20, 30, 60, 120];

/** Backdrop stage index (0–5) for an elapsed time. A boundary belongs to the later stage. */
export function backdropStageIndex(elapsedSec: number): number {
    return STAGE_START_SEC.filter((start) => elapsedSec >= start).length;
}

/** Backdrop colour for an elapsed time. */
export function backdropColorOf(elapsedSec: number): number {
    return BG_COLORS[backdropStageIndex(elapsedSec)];
}

/**
 * Next y of a falling star. A star that passes the bottom edge re-enters just above the top
 * (y = -1, outside the screen).
 */
export function advanceStar(y: number, speed: number, dt: number, height: number): number {
    const next = y + speed * dt;
    return next > height ? -1 : next;
}

// Triangle ship (vertex up) and diamond enemy, as offsets from the centre.
// Every vertex lies within its hit radius (PLAYER_RADIUS 12, ENEMY_RADIUS 14).
export const PLAYER_SHAPE: ReadonlyArray<readonly [number, number]> = [[0, -12], [9, 7.5], [-9, 7.5]];
export const ENEMY_SHAPE: ReadonlyArray<readonly [number, number]> = [[0, -14], [14, 0], [0, 14], [-14, 0]];
