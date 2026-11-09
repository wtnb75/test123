// The one-line "how to play" hint of the first game after the page loads (docs/spec/effects.md "遊び方の一言").
import { PARAMS } from '../params';

export const HOW_TO_PLAY_TEXT = 'ブロックで一列を埋めよう';

/**
 * Remembers, in memory only (never in storage), whether the hint was already shown since the page loaded.
 * The first `claim()` is true; every later one is false. A page reload creates a fresh memory.
 */
export class HowToPlayMemory {
    private shown = false;

    claim(): boolean {
        if (this.shown) return false;
        this.shown = true;
        return true;
    }
}

/** The page-wide memory used by the Game Scene (Scene restarts do not clear it). */
export const pageHowToPlay = new HowToPlayMemory();

/**
 * Opacity `elapsedMs` after the Game was entered: a linear fade in over `howToPlayFadeMs`, full until
 * `howToPlayShowMs - howToPlayFadeMs`, then a linear fade out that reaches 0 exactly at `howToPlayShowMs`.
 */
export function howToPlayAlpha(elapsedMs: number): number {
    if (elapsedMs <= 0 || elapsedMs >= PARAMS.howToPlayShowMs) return 0;
    const fadeIn = elapsedMs / PARAMS.howToPlayFadeMs;
    const fadeOut = (PARAMS.howToPlayShowMs - elapsedMs) / PARAMS.howToPlayFadeMs;
    return Math.min(1, fadeIn, fadeOut);
}

/**
 * The hint of one game. It ends by itself at `howToPlayShowMs`, or at once (no fade) when `dismiss()` is
 * called (first line cleared, `ending`, Quit); once gone it never comes back in the same game.
 */
export class HowToPlayNote {
    private dismissed = false;

    constructor(private readonly startMs: number) {}

    dismiss() {
        this.dismissed = true;
    }

    /** Whether the hint is over for good (dismissed, or the time has run out). */
    isGone(nowMs: number): boolean {
        return this.dismissed || nowMs - this.startMs >= PARAMS.howToPlayShowMs;
    }

    alpha(nowMs: number): number {
        return this.dismissed ? 0 : howToPlayAlpha(nowMs - this.startMs);
    }
}
