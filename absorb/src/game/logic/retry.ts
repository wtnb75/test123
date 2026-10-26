import { BREAKDOWN_SHOWN_AT } from './breakdown';
import { GAMEOVER_HINT_FADE } from './constants';

const EPSILON = 1e-9;

/**
 * Seconds into the game-over screen during which retry input is ignored: until the total has fully faded in
 * on the longest table. Fixed, so a short table (fewer kinds defeated) keeps the same protection.
 */
export const GAMEOVER_INPUT_LOCK = BREAKDOWN_SHOWN_AT;

/** Key codes (DOM `keyCode`, as Phaser's KeyCodes) that retry: the release keys Space, X and Enter. */
export const RETRY_KEY_CODES: readonly number[] = [32, 88, 13];

/** Key code of T, which goes back to Title from the game-over screen. */
export const TITLE_KEY_CODE = 84;

/** Whether a point is inside a rectangle: the top-left corner is in, the right and bottom edges are out. */
export function inRect(x: number, y: number, left: number, top: number, width: number, height: number): boolean {
    return x >= left && x < left + width && y >= top && y < top + height;
}

/** Where a game-over press leads: back to Title, into a new game, or nowhere yet. */
export type GameOverExit = 'title' | 'game' | null;

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
 * Decides where game-over input leads: retry, or back to Title. Phaser delivers input before the Scene's update, so
 * input is only recorded here and judged in `resolve` with the elapsed time of the frame it arrived in.
 * Only a fresh press counts: auto-repeat keydowns (a key held since the game or since the lock) never do,
 * so a held key has to be released and pressed again. Fires at most once.
 */
export class RetryInput {
    private pressed = false;
    private titlePressed = false;
    private fired = false;

    /** Records a keydown: a fresh press of a retry key retries, a fresh press of T goes to Title. */
    keyDown(keyCode: number, repeat: boolean): void {
        if (repeat) return;
        if (keyCode === TITLE_KEY_CODE) this.titlePressed = true;
        else if (RETRY_KEY_CODES.includes(keyCode)) this.pressed = true;
    }

    /** Records a click or touch start: on the TITLE button it goes to Title, anywhere else it retries. */
    pointerDown(onTitleButton = false): void {
        if (onTitleButton) this.titlePressed = true;
        else this.pressed = true;
    }

    /**
     * Judges the presses recorded this frame at `t` seconds in and forgets them. Returns where to go, or null.
     * Going to Title wins over retrying when both arrive in the same frame. Fires at most once.
     */
    resolveExit(t: number): GameOverExit {
        const title = this.titlePressed;
        const retry = this.pressed;
        this.titlePressed = false;
        this.pressed = false;
        if (!(title || retry) || this.fired || !retryEnabled(t)) return null;
        this.fired = true;
        return title ? 'title' : 'game';
    }

    /** Judges the presses at `t` seconds in; true when the screen should leave for a new game (retry). */
    resolve(t: number): boolean {
        return this.resolveExit(t) === 'game';
    }
}
