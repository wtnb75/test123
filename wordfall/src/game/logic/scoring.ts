import {
    BONUS_SEC_PER_LETTER,
    FALL_SPEED_MAX,
    FALL_SPEED_RAMP,
    FALL_SPEED_START,
    MULTI_BONUS_SCORE,
    MULTI_BONUS_SEC,
    SCORE_BY_LENGTH,
} from '../params';

/** The extra score and seconds for `n` words completed by one pick (nothing below two). */
export function multiBonus(n: number): { score: number; sec: number } {
    const extra = Math.max(0, n - 1);
    return { score: MULTI_BONUS_SCORE * extra, sec: MULTI_BONUS_SEC * extra };
}

/** Score for completing a word of `length` letters. */
export const scoreFor = (length: number): number => SCORE_BY_LENGTH[length] ?? 0;

/** Seconds added to the clock for completing a word of `length` letters. */
export const bonusFor = (length: number): number => length * BONUS_SEC_PER_LETTER;

/** Fall speed in field heights per second after `elapsedSec` of play. */
export function fallSpeed(elapsedSec: number): number {
    return Math.min(FALL_SPEED_MAX, FALL_SPEED_START + FALL_SPEED_RAMP * elapsedSec);
}
