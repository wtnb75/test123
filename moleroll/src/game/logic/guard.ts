// Result's input guard (docs/spec.md "ドラッグとタップ" の末尾): no button or key input right after it opens.
import { RESULT_INPUT_GUARD_SEC } from '../params';

/**
 * Whether a key press counts: an auto-repeat does not (so Space held from the previous Scene, or held down,
 * never acts again). A key pressed in Title or Result is not a tap in Game for the same reason.
 */
export function shouldHandleKey(repeat: boolean): boolean {
    return !repeat;
}

/** Whether Result takes button and key input yet, `elapsedSec` after it started. */
export function resultInputOpen(elapsedSec: number): boolean {
    return elapsedSec >= RESULT_INPUT_GUARD_SEC;
}
