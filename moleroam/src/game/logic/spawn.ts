import { PARAMS } from '../params';
import { HOLE_COUNT } from './board';

export type Kind = 'mole' | 'cat';

export interface SpawnPlan {
    hole: number;
    kind: Kind;
}

/** Time of the first spawn check, measured from the start of play. */
export const firstSpawnAt = (): number => PARAMS.firstSpawnDelayMs;

/** A spawn check is due once the game time reaches the scheduled time (at most one check per update). */
export const isSpawnDue = (elapsedMs: number, scheduledAt: number): boolean => elapsedMs >= scheduledAt;

/**
 * One update's worth of spawning: when a check is due, plan the spawn and schedule the next check from
 * now (never from the old schedule, and never more than one check per update, however big the time jump).
 */
export const stepSpawn = (
    elapsedMs: number,
    scheduledAt: number,
    usedHoles: readonly number[],
    rand: () => number,
): { plan: SpawnPlan[]; scheduledAt: number } =>
    isSpawnDue(elapsedMs, scheduledAt)
        ? { plan: planSpawn(usedHoles, rand), scheduledAt: nextSpawnAt(elapsedMs) }
        : { plan: [], scheduledAt };

/** The next check is `spawnIntervalMs` after the check that just ran, whether or not it spawned. */
export const nextSpawnAt = (checkedAt: number): number => checkedAt + PARAMS.spawnIntervalMs;

/** Index into a list of `length` items from a random value in [0, 1) (1 is tolerated). */
const pick = (length: number, rand: () => number): number => Math.min(length - 1, Math.floor(rand() * length));

/** The holes around `hole` (8-neighbourhood), never outside the board. */
export const neighborHoles = (hole: number): number[] => {
    const col = hole % PARAMS.boardCols;
    const row = Math.floor(hole / PARAMS.boardCols);
    const result: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;
            const r = row + dr;
            const inside = c >= 0 && c < PARAMS.boardCols && r >= 0 && r < PARAMS.boardRows;
            if (inside && (dr !== 0 || dc !== 0)) result.push(r * PARAMS.boardCols + c);
        }
    }
    return result;
};

const freeHoles = (used: readonly number[]): number[] => {
    const taken = new Set(used);
    const free: number[] = [];
    for (let i = 0; i < HOLE_COUNT; i++) if (!taken.has(i)) free.push(i);
    return free;
};

const toKind = (rand: () => number): Kind => (rand() < PARAMS.friendRate ? 'cat' : 'mole');

/** Anchor hole plus free neighbours, at most `comboSize` holes in all. */
const comboHoles = (free: readonly number[], rand: () => number): number[] => {
    const anchor = free[pick(free.length, rand)];
    const near = neighborHoles(anchor).filter((h) => free.includes(h));
    const holes = [anchor];
    while (holes.length < PARAMS.comboSize && near.length > 0) {
        holes.push(near.splice(pick(near.length, rand), 1)[0]);
    }
    return holes;
};

/**
 * What to spawn at one spawn check, given the holes in use (telegraph and up pops).
 * Random draws in order: combo roll (only when there is room for a combo), anchor hole,
 * neighbour holes, then one kind roll per spawned pop.
 */
export const planSpawn = (usedHoles: readonly number[], rand: () => number): SpawnPlan[] => {
    const room = PARAMS.maxActive - usedHoles.length;
    const free = freeHoles(usedHoles);
    if (room <= 0 || free.length === 0) return [];
    const combo = room >= PARAMS.comboSize && rand() < PARAMS.comboRate;
    const holes = combo ? comboHoles(free, rand) : [free[pick(free.length, rand)]];
    return holes.map((hole) => ({ hole, kind: toKind(rand) }));
};
