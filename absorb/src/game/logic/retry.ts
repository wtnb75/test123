import { BREAKDOWN_SHOWN_AT } from './breakdown';
import { GAMEOVER_HINT_FADE } from './constants';

const EPSILON = 1e-9;

/** Seconds into the game-over screen during which retry input is ignored: until the total has fully faded in. */
export const GAMEOVER_INPUT_LOCK = BREAKDOWN_SHOWN_AT;

/** Key codes (DOM `keyCode`, as Phaser's KeyCodes) that retry: the release keys Space, X and Enter. */
export const RETRY_KEY_CODES: readonly number[] = [32, 88, 13];

/** Whether retry input is accepted `t` seconds into the game-over screen. */
export function retryEnabled(t: number): boolean {
    return t >= GAMEOVER_INPUT_LOCK - EPSILON;
}

/** Opacity of the retry hint: hidden while locked, then fading in over GAMEOVER_HINT_FADE and staying at 1. */
export function hintAlpha(t: number): number {
    if (!retryEnabled(t)) return 0;
    const since = t - GAMEOVER_INPUT_LOCK;
    if (since >= GAMEOVER_HINT_FADE - EPSILON) return 1;
    return Math.max(0, since / GAMEOVER_HINT_FADE);
}

/**
 * Decides whether game-over input should retry. Phaser delivers input before the Scene's update, so
 * input is only recorded here and judged in `resolve` with the elapsed time of the frame it arrived in.
 * Only a fresh press counts: auto-repeat keydowns (a key held since the game or since the lock) never do,
 * so a held key has to be released and pressed again. Fires at most once.
 */
export class RetryInput {
    private pressed = false;
    private fired = false;

    /** Records a keydown; only a fresh press of a retry key counts. */
    keyDown(keyCode: number, repeat: boolean): void {
        if (!repeat && RETRY_KEY_CODES.includes(keyCode)) this.pressed = true;
    }

    /** Records a click or touch start. */
    pointerDown(): void {
        this.pressed = true;
    }

    /** Judges the presses recorded this frame at `t` seconds in and forgets them; true when it should retry. */
    resolve(t: number): boolean {
        const pressed = this.pressed;
        this.pressed = false;
        if (!pressed || this.fired || !retryEnabled(t)) return false;
        this.fired = true;
        return true;
    }
}
