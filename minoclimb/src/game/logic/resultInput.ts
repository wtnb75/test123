// What a press on the Result screen does (docs/spec.md "Result Scene"): retry, or back to Title.
// Pure logic, no Phaser. The Scene passes the latched presses of one frame and whether the lockout is over.
import { P } from '../params';
import { RETRY_KEYS, type RawInput } from './input';

/** 'retry' is the same stage again; 'next' (after a clear only) is the next stage. */
export type ResultAction = 'retry' | 'next' | 'title';

export const TITLE_KEYS: readonly string[] = ['KeyT'];
/** After a clear: R plays the same stage again, Space goes on to the next one. */
const AGAIN_KEY = 'KeyR';
const NEXT_KEY = 'Space';

/** The "back to Title" button: left and top edges belong to it, right and bottom edges do not. */
export const RESULT_TITLE_RECT = {
    x: P.RESULT_TITLE_X - P.RESULT_TITLE_W / 2,
    y: P.RESULT_TITLE_Y - P.RESULT_TITLE_H / 2,
    width: P.RESULT_TITLE_W,
    height: P.RESULT_TITLE_H,
} as const;

export const onTitleButton = (x: number, y: number): boolean =>
    x >= RESULT_TITLE_RECT.x && x < RESULT_TITLE_RECT.x + RESULT_TITLE_RECT.width
    && y >= RESULT_TITLE_RECT.y && y < RESULT_TITLE_RECT.y + RESULT_TITLE_RECT.height;

/** Whether the Result screen accepts input yet: from RETRY_LOCKOUT seconds after it came up (the instant included). */
export const lockoutOver = (elapsedSeconds: number): boolean => elapsedSeconds >= P.RETRY_LOCKOUT;

/**
 * The action for the presses latched since the previous read, or null. Before the lockout is over nothing
 * counts (and nothing is carried over: the caller reads, and so consumes, the presses every frame).
 * A press that began on the button is the button's (never a retry). When both a "back to Title" and a retry
 * press come in one frame, "back to Title" wins.
 * After a clear (`cleared`, docs/spec/stages.md) Space and a tap outside the button mean "next stage" and R
 * means "the same stage again" (R wins when they come together); after a loss all of them are a retry.
 */
export function resultAction(raw: RawInput, accepting: boolean, cleared = false): ResultAction | null {
    if (!accepting) return null;
    if (TITLE_KEYS.some((code) => raw.pressedKeys.has(code))) return 'title';
    if (raw.pressPoints.some((p) => onTitleButton(p.x, p.y))) return 'title';
    if (cleared) {
        if (raw.pressedKeys.has(AGAIN_KEY)) return 'retry';
        if (raw.pressedKeys.has(NEXT_KEY) || raw.pressPoints.length > 0) return 'next';
        return null;
    }
    if (RETRY_KEYS.some((code) => raw.pressedKeys.has(code))) return 'retry';
    if (raw.pressPoints.length > 0) return 'retry';
    return null;
}
