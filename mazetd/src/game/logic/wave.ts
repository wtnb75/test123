import {
    BOSS_HP_RATE,
    BOSS_RADIUS,
    BOSS_REWARD,
    BOSS_SCORE,
    BOSS_SPEED_RATE,
    BOSS_WAVES,
    ENEMY_COUNT_BASE,
    ENEMY_COUNT_STEP,
    ENEMY_HP_BASE,
    ENEMY_HP_STEP,
    ENEMY_RADIUS,
    FAST_FROM_WAVE,
    FAST_HP_RATE,
    FAST_RADIUS,
    FAST_SLOT,
    FAST_SPEED_RATE,
    FLYER_CYCLE,
    FLYER_FROM_WAVE,
    FLYER_HP_RATE,
    FLYER_RADIUS,
    FLYER_SLOT,
    FLYER_SPEED_RATE,
    KILL_REWARD,
    KIND_CYCLE,
    SCORE_PER_KILL,
    SCORE_PER_LIFE,
    TANK_FROM_WAVE,
    TANK_HP_RATE,
    TANK_RADIUS,
    TANK_SLOT,
    TANK_SPEED_RATE
} from './config';

export type EnemyKind = 'normal' | 'fast' | 'tank' | 'flyer' | 'boss';

/** The number of regular enemies in the wave (the boss, if any, comes after them). */
export function enemyCount(wave: number): number {
    return ENEMY_COUNT_BASE + ENEMY_COUNT_STEP * (wave - 1);
}

export function isBossWave(wave: number): boolean {
    return BOSS_WAVES.includes(wave);
}

/** Everything that spawns in the wave: the regular enemies plus the boss in a boss wave. */
export function waveSpawnTotal(wave: number): number {
    return enemyCount(wave) + (isBossWave(wave) ? 1 : 0);
}

/** The wave's base HP: a normal enemy's max HP; the other kinds scale it (see `enemyHp`). */
export function baseEnemyHp(wave: number): number {
    return ENEMY_HP_BASE + ENEMY_HP_STEP * (wave - 1);
}

/** The kind of the enemy spawned i-th (0-based) in the given wave; no randomness. */
export function enemyKind(wave: number, index: number): EnemyKind {
    // The boss is the one after the regular enemies, outside the index rules below.
    if (isBossWave(wave) && index === enemyCount(wave)) return 'boss';
    // The flyer slot is a normal one modulo KIND_CYCLE, so it never competes with the fast and tank slots.
    if (wave >= FLYER_FROM_WAVE && index % FLYER_CYCLE === FLYER_SLOT) return 'flyer';
    const slot = index % KIND_CYCLE;
    if (wave >= TANK_FROM_WAVE && slot === TANK_SLOT) return 'tank';
    if (wave >= FAST_FROM_WAVE && slot === FAST_SLOT) return 'fast';
    return 'normal';
}

function scaledHpCeil(base: number, rate: number): number {
    return Math.max(1, Math.ceil(Math.round(base * rate * 1e6) / 1e6));
}

/** Max HP of an enemy of `kind` in `wave`. Fast and flyer round up (never below 1); the product is rounded to dodge float noise. */
export function enemyHp(wave: number, kind: EnemyKind = 'normal'): number {
    const base = baseEnemyHp(wave);
    if (kind === 'fast') return scaledHpCeil(base, FAST_HP_RATE);
    if (kind === 'flyer') return scaledHpCeil(base, FLYER_HP_RATE);
    if (kind === 'tank') return base * TANK_HP_RATE;
    if (kind === 'boss') return base * BOSS_HP_RATE;
    return base;
}

/** Share of ENEMY_SPEED the kind walks at, before the swamp and slow tower factors. */
export function kindSpeedRate(kind: EnemyKind = 'normal'): number {
    if (kind === 'fast') return FAST_SPEED_RATE;
    if (kind === 'tank') return TANK_SPEED_RATE;
    if (kind === 'flyer') return FLYER_SPEED_RATE;
    if (kind === 'boss') return BOSS_SPEED_RATE;
    return 1;
}

/** Drawing radius of the kind (px). */
export function kindRadius(kind: EnemyKind = 'normal'): number {
    if (kind === 'fast') return FAST_RADIUS;
    if (kind === 'tank') return TANK_RADIUS;
    if (kind === 'flyer') return FLYER_RADIUS;
    if (kind === 'boss') return BOSS_RADIUS;
    return ENEMY_RADIUS;
}

/** Coins for killing an enemy of `kind`. */
export function killReward(kind: EnemyKind = 'normal'): number {
    return kind === 'boss' ? BOSS_REWARD : KILL_REWARD;
}

/** `kills` counts every kill including bosses; each of the `bossKills` scores BOSS_SCORE instead of SCORE_PER_KILL. */
export function computeScore(kills: number, lives: number, cleared: boolean, bossKills = 0): number {
    return (kills - bossKills) * SCORE_PER_KILL + bossKills * BOSS_SCORE + (cleared ? lives * SCORE_PER_LIFE : 0);
}
