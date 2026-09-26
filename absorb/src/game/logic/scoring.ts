import { RELEASE_BONUS_STEP } from './constants';

/**
 * Score for the enemies destroyed by one release: the base scores summed,
 * multiplied by 1 + (kills - 1) * 50% when two or more died, rounded down.
 */
export function releaseScore(killScores: readonly number[]): number {
    const n = killScores.length;
    if (n === 0) return 0;
    let sum = 0;
    for (const s of killScores) sum += s;
    const multiplier = 1 + (n - 1) * RELEASE_BONUS_STEP;
    return Math.floor(sum * multiplier);
}
