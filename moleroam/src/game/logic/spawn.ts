import { PARAMS } from '../params';
import { LANDSCAPE, type Layout } from './layout';

/**
 * A mole, a cat to avoid, a clock (docs/spec/items.md: a clock adds time when hit) or a golden mole
 * (docs/spec/golden-mole.md: stays up briefly and scores a fixed bonus).
 */
export type Kind = 'mole' | 'cat' | 'clock' | 'golden';

export interface SpawnPlan {
    hole: number;
    kind: Kind;
}

export interface RampPhase {
    /** Time between spawn checks while this phase runs. */
    intervalMs: number;
    /** Most pops (telegraph and up) that may exist at once. */
    maxActive: number;
}

/** The phase at game time `elapsedMs`: early, mid from `rampMidAtMs`, late from `rampLateAtMs` (docs/spec.md "段階"). */
export const rampPhase = (elapsedMs: number): RampPhase => {
    if (elapsedMs >= PARAMS.rampLateAtMs) {
        return { intervalMs: PARAMS.spawnIntervalLateMs, maxActive: PARAMS.maxActiveLate };
    }
    if (elapsedMs >= PARAMS.rampMidAtMs) {
        return { intervalMs: PARAMS.spawnIntervalMidMs, maxActive: PARAMS.maxActiveMid };
    }
    return { intervalMs: PARAMS.spawnIntervalMs, maxActive: PARAMS.maxActive };
};

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
    layout: Layout = LANDSCAPE,
): { plan: SpawnPlan[]; scheduledAt: number } =>
    isSpawnDue(elapsedMs, scheduledAt)
        ? { plan: planSpawn(usedHoles, rand, layout, rampPhase(elapsedMs).maxActive), scheduledAt: nextSpawnAt(elapsedMs) }
        : { plan: [], scheduledAt };

/** The next check is one interval after the check that just ran (the interval of that check's phase), whether or not it spawned. */
export const nextSpawnAt = (checkedAt: number): number => checkedAt + rampPhase(checkedAt).intervalMs;

/** Index into a list of `length` items from a random value in [0, 1) (1 is tolerated). */
const pick = (length: number, rand: () => number): number => Math.min(length - 1, Math.floor(rand() * length));

/** The holes around `hole` (8-neighbourhood), never outside the board of `layout` (landscape when omitted). */
export const neighborHoles = (hole: number, layout: Layout = LANDSCAPE): number[] => {
    const col = hole % layout.cols;
    const row = Math.floor(hole / layout.cols);
    const result: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc;
            const r = row + dr;
            const inside = c >= 0 && c < layout.cols && r >= 0 && r < layout.rows;
            if (inside && (dr !== 0 || dc !== 0)) result.push(r * layout.cols + c);
        }
    }
    return result;
};

const freeHoles = (used: readonly number[], layout: Layout): number[] => {
    const taken = new Set(used);
    const free: number[] = [];
    for (let i = 0; i < layout.cols * layout.rows; i++) if (!taken.has(i)) free.push(i);
    return free;
};

/**
 * The kind of one spawned pop: a cat with `friendRate`; otherwise one more draw decides a clock with
 * `itemRate` (docs/spec/items.md); otherwise one more decides a golden mole with `goldenRate`
 * (docs/spec/golden-mole.md), else a mole. Each later draw happens only for a pop the earlier ones did not take,
 * right after it: cat draw, clock draw, golden draw, then the next pop.
 */
const toKind = (rand: () => number): Kind => {
    if (rand() < PARAMS.friendRate) return 'cat';
    if (rand() < PARAMS.itemRate) return 'clock';
    return rand() < PARAMS.goldenRate ? 'golden' : 'mole';
};

/**
 * Whether a freshly spawned pop is a decoy (a cat that also gets a direction arrow). Drawn once at spawn,
 * after the whole spawn plan is made, from the same random source: only cats draw (a mole never does),
 * and a cat is a decoy when the value is below `decoyRate`.
 */
export const rollDecoy = (kind: Kind, rand: () => number): boolean => kind === 'cat' && rand() < PARAMS.decoyRate;

export interface DecoyPlan extends SpawnPlan {
    decoy: boolean;
}

/**
 * The decoy rolls for a finished spawn plan: one draw per cat, in plan order, none for moles. Taking the
 * plan keeps the rule "roll after the whole plan, from the same random source" in the signature.
 */
export const rollDecoys = (plan: readonly SpawnPlan[], rand: () => number): DecoyPlan[] =>
    plan.map((p) => ({ ...p, decoy: rollDecoy(p.kind, rand) }));

/** Anchor hole plus free neighbours, at most `comboSize` holes in all. */
const comboHoles = (free: readonly number[], rand: () => number, layout: Layout): number[] => {
    const anchor = free[pick(free.length, rand)];
    const near = neighborHoles(anchor, layout).filter((h) => free.includes(h));
    const holes = [anchor];
    while (holes.length < PARAMS.comboSize && near.length > 0) {
        holes.push(near.splice(pick(near.length, rand), 1)[0]);
    }
    return holes;
};

/**
 * What to spawn at one spawn check, given the holes in use (telegraph and up pops).
 * Random draws in order: combo roll (only when there is room for a combo), anchor hole,
 * neighbour holes, then per spawned pop its kind roll, a clock roll for a non-cat and a golden roll for a non-clock after it (see toKind).
 */
export const planSpawn = (
    usedHoles: readonly number[],
    rand: () => number,
    layout: Layout = LANDSCAPE,
    maxActive: number = PARAMS.maxActive,
): SpawnPlan[] => {
    const room = maxActive - usedHoles.length;
    const free = freeHoles(usedHoles, layout);
    if (room <= 0 || free.length === 0) return [];
    const combo = room >= PARAMS.comboSize && rand() < PARAMS.comboRate;
    const holes = combo ? comboHoles(free, rand, layout) : [free[pick(free.length, rand)]];
    return holes.map((hole) => ({ hole, kind: toKind(rand) }));
};
