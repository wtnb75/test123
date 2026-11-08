// HUD texts and the small numbers behind the effects (docs/spec.md "Game" / "演出・UI"). Pure; no Phaser.
import {
    BALL_BLINK_DURATION,
    BALL_BLINK_INTERVAL,
    CHARGE_MARK,
    CHARGE_MID,
    SCORE_BUMP_DURATION,
    SCORE_BUMP_SCALE,
    STAGE_COUNT,
} from '../params';

export const scoreText = (score: number): string => `SCORE ${score}`;

/** One ● per remaining ball, plus `ghost` more while a lost ball's dot is blinking. */
export const ballText = (lives: number, ghost = 0): string => `BALL ${'●'.repeat(Math.max(0, lives + ghost))}`;

export const stageText = (stage: number): string => `STAGE ${stage}/${STAGE_COUNT}`;

/**
 * 1 while the lost ball's dot is shown during its blink, 0 while it is hidden or the blink is over. The dot
 * is shown first, then toggles every BALL_BLINK_INTERVAL and ends hidden at BALL_BLINK_DURATION. The elapsed
 * time is turned into whole milliseconds first, so 0.3 s is the 4th interval exactly (0.3 / 0.1 is 2.9999...).
 */
export function ghostBall(elapsed: number): 0 | 1 {
    if (elapsed < 0 || elapsed >= BALL_BLINK_DURATION) return 0;
    const ms = Math.floor(elapsed * 1000 + 1e-6); // whole milliseconds, tolerating float error just below a boundary
    const index = Math.floor(ms / Math.round(BALL_BLINK_INTERVAL * 1000));
    return index % 2 === 0 ? 1 : 0;
}

/** Scale of the SCORE text `elapsed` seconds after the score grew: SCORE_BUMP_SCALE down to 1 (linear). */
export function scoreBumpScale(elapsed: number): number {
    const t = Math.min(1, Math.max(0, elapsed / SCORE_BUMP_DURATION));
    return SCORE_BUMP_SCALE + (1 - SCORE_BUMP_SCALE) * t;
}

/** Colour of the plunger bar: green, yellow from CHARGE_MID, orange from CHARGE_MARK. */
export function chargeColor(charge: number): number {
    if (charge >= CHARGE_MARK) return 0xff9f43;
    if (charge >= CHARGE_MID) return 0xffe14d;
    return 0x4dffb0;
}
