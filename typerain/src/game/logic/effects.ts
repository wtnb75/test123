// The numbers and texts behind the effects (docs/spec.md "演出・UI（Game）"). The motion itself (growing,
// rising, fading) is done by Phaser tweens in the Scene.
import { CHAR_W, LOCK_PAD_X, MARGIN, SCREEN_WIDTH } from '../params';

/** Text of the score pop-up: "+30". */
export const popText = (points: number): string => `+${points}`;

/** Centre x for the pop-up so a text of `textWidth` keeps MARGIN from both screen edges. */
export function clampPopX(centerX: number, textWidth: number): number {
    const half = textWidth / 2;
    return Math.min(Math.max(centerX, MARGIN + half), SCREEN_WIDTH - MARGIN - half);
}

/** Left edge and width of the lock-on band behind a word of `length` letters whose left edge is `wordX`. */
export function lockBandRect(wordX: number, length: number): { x: number; width: number } {
    return { x: wordX - LOCK_PAD_X, width: length * CHAR_W + 2 * LOCK_PAD_X };
}

/** How many hearts a life change took away (never negative). */
export const heartsLost = (before: number, after: number): number => Math.max(0, before - after);
