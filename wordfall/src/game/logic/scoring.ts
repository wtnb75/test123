import {
    BONUS_SEC_PER_LETTER,
    FALL_SPEED_MAX,
    FALL_SPEED_RAMP,
    FALL_SPEED_START,
    SCORE_BY_LENGTH,
} from '../params';

/** Score for completing a word of `length` letters. */
export const scoreFor = (length: number): number => SCORE_BY_LENGTH[length] ?? 0;

/** Seconds added to the clock for completing a word of `length` letters. */
export const bonusFor = (length: number): number => length * BONUS_SEC_PER_LETTER;

/** Fall speed in field heights per second after `elapsedSec` of play. */
export function fallSpeed(elapsedSec: number): number {
    return Math.min(FALL_SPEED_MAX, FALL_SPEED_START + FALL_SPEED_RAMP * elapsedSec);
}
