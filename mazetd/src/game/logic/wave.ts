import {
    ENEMY_COUNT_BASE,
    ENEMY_COUNT_STEP,
    ENEMY_HP_BASE,
    ENEMY_HP_STEP,
    SCORE_PER_KILL,
    SCORE_PER_LIFE
} from './config';

export function enemyCount(wave: number): number {
    return ENEMY_COUNT_BASE + ENEMY_COUNT_STEP * (wave - 1);
}

export function enemyHp(wave: number): number {
    return ENEMY_HP_BASE + ENEMY_HP_STEP * (wave - 1);
}

export function computeScore(kills: number, lives: number, cleared: boolean): number {
    return kills * SCORE_PER_KILL + (cleared ? lives * SCORE_PER_LIFE : 0);
}
