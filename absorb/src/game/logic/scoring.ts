import { RELEASE_BONUS_STEP } from './constants';
import { chainBonus } from './chain';

/**
 * Score for the enemies destroyed by one release: the base scores summed, multiplied by
 * 1 + (kills - 1) * 50% (multi-kill) + the chain's bonus for the release's level, rounded down.
 * Level 1 (no chain) leaves the multiplier as it was before the chain existed.
 */
export function releaseScore(killScores: readonly number[], chainLevel = 1): number {
    const n = killScores.length;
    if (n === 0) return 0;
    let sum = 0;
    for (const s of killScores) sum += s;
    const multiplier = 1 + (n - 1) * RELEASE_BONUS_STEP + chainBonus(chainLevel);
    return Math.floor(sum * multiplier);
}
