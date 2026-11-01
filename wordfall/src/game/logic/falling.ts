// Spawn timing and fall motion of the letters (docs/spec.md "文字").

/**
 * Letters due after `dtMs` more milliseconds, given `accMs` carried over: one per `intervalMs`, however
 * long the frame was. Returns how many to spawn and the new carry-over (always below `intervalMs`).
 */
export function stepSpawn(accMs: number, dtMs: number, intervalMs: number): { count: number; accMs: number } {
    const total = accMs + dtMs;
    const count = Math.floor(total / intervalMs);
    return { count, accMs: total - count * intervalMs };
}

/** How far a letter moves in `dtSec`: speed is in field heights per second. */
export const fallDistance = (speed: number, fieldHeight: number, dtSec: number): number => speed * fieldHeight * dtSec;

/** A letter disappears in the frame its centre reaches `removeY` (its bottom edge reaches the floor). */
export const hasLanded = (y: number, removeY: number): boolean => y >= removeY;
