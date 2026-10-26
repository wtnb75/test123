// HUD and hint decisions behind the Game Scene's effects (pure; no Phaser).
import { HINT_TIMEOUT } from '../params';

/** The paddle hint starts to fade once the paddle has moved, or after HINT_TIMEOUT seconds of play. */
export function shouldHideHint(elapsed: number, paddleMoved: boolean): boolean {
    return paddleMoved || elapsed >= HINT_TIMEOUT;
}

/**
 * How many lost hearts the blink shows: the ones lost since the current blink started. A loss while
 * blinking adds to the hearts already blinking; a loss after the blink ended starts counting again.
 */
export function blinkCount(blinking: boolean, blinkingNow: number, newlyLost: number): number {
    return blinking ? blinkingNow + newlyLost : newlyLost;
}

/** The LIFE row: remaining hearts plus `shownLost` lost ones during the "on" half of a blink. */
export function lifeText(remaining: number, shownLost: number): string {
    const hearts = remaining + shownLost;
    return hearts > 0 ? `LIFE ${'♥'.repeat(hearts)}` : 'LIFE';
}
