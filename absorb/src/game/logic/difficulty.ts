import type { EnemyKind } from './constants';
import type { Rng } from './geometry';

export interface Stage {
    /** Spawn weights for grunt / shooter / heavy (rammers spawn on their own timer). */
    weights: Record<Exclude<EnemyKind, 'rammer'>, number>;
    spawnInterval: number;
    bulletSpeed: number;
    rammerInterval: number;
    /** How many rammers appear together at each rammer spawn. */
    rammerCount: number;
}

const STAGES: { from: number; stage: Stage }[] = [
    { from: 120, stage: { weights: { grunt: 30, shooter: 30, heavy: 40 }, spawnInterval: 1.6, bulletSpeed: 260, rammerInterval: 4, rammerCount: 3 } },
    { from: 60, stage: { weights: { grunt: 40, shooter: 30, heavy: 30 }, spawnInterval: 2.0, bulletSpeed: 230, rammerInterval: 6, rammerCount: 2 } },
    { from: 30, stage: { weights: { grunt: 60, shooter: 25, heavy: 15 }, spawnInterval: 2.5, bulletSpeed: 200, rammerInterval: 8, rammerCount: 1 } },
    { from: 0, stage: { weights: { grunt: 100, shooter: 0, heavy: 0 }, spawnInterval: 3.0, bulletSpeed: 180, rammerInterval: 10, rammerCount: 1 } }
];

/** Returns the difficulty stage for the given playing time; each boundary belongs to the later stage. */
export function getStage(elapsed: number): Stage {
    for (const { from, stage } of STAGES) {
        if (elapsed >= from) return stage;
    }
    return STAGES[STAGES.length - 1].stage;
}

const SPAWN_KINDS = ['grunt', 'shooter', 'heavy'] as const;

/** Picks grunt / shooter / heavy according to the current stage's weights. */
export function pickEnemyKind(elapsed: number, rng: Rng): Exclude<EnemyKind, 'rammer'> {
    const { weights } = getStage(elapsed);
    const total = weights.grunt + weights.shooter + weights.heavy;
    let roll = rng() * total;
    for (const kind of SPAWN_KINDS) {
        roll -= weights[kind];
        if (roll < 0) return kind;
    }
    return 'grunt';
}
