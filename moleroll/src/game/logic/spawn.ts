// Spawning (docs/spec.md "ルール" 出現判定・出現の選び方).
import { BACK_SPAWN_RATIO, CAT_RATIO, MAX_ACTIVE, SPAWN_INTERVAL_SEC } from '../params';
import { isHiddenSide, type Mat3 } from './math';
import type { Kind } from './pop';
import type { Hole } from './shape';

export interface SpawnPick {
    hole: Hole;
    kind: Kind;
}

/**
 * Picks the hole and kind of a new Pop, or null when no hole is free (then no random number is drawn).
 * Otherwise draws exactly three: (a) back side or visible side, (b) the hole among that side's free holes
 * (all free holes when that side has none), (c) cat or mole.
 */
export function pickSpawn(
    holes: readonly Hole[],
    occupied: ReadonlySet<number>,
    m: Mat3,
    rng: () => number,
): SpawnPick | null {
    const free = holes.filter((h) => !occupied.has(h.id));
    if (free.length === 0) return null;
    const wantBack = rng() < BACK_SPAWN_RATIO;
    const side = free.filter((h) => isHiddenSide(m, h) === wantBack);
    const pool = side.length > 0 ? side : free;
    const hole = pool[Math.floor(rng() * pool.length)];
    const kind: Kind = rng() < CAT_RATIO ? 'cat' : 'mole';
    return { hole, kind };
}

export interface SpawnTick {
    timer: number;
    /** True when a Pop should come out now. */
    spawn: boolean;
}

/**
 * Counts the spawn timer down by dt. At or below 0 with a free slot it spawns (one per update) and restarts
 * at SPAWN_INTERVAL_SEC; without a free slot it keeps waiting (the timer stays at or below 0).
 */
export function tickSpawnTimer(timer: number, dt: number, activeCount: number): SpawnTick {
    const next = timer - dt;
    if (next <= 0 && activeCount < MAX_ACTIVE) return { timer: SPAWN_INTERVAL_SEC, spawn: true };
    return { timer: next, spawn: false };
}
