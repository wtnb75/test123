import { COMBO_MULT_CAP, COMBO_STEP, SCORE_PER_CHAR } from '../params';

/** Points for clearing a word of `length` letters when the combo stood at `combo` before it. */
export function scoreFor(length: number, combo: number): number {
    const mult = Math.min(COMBO_MULT_CAP, 1 + combo * COMBO_STEP);
    return Math.round(length * SCORE_PER_CHAR * mult);
}
