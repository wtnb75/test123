// Reading typed characters from the hidden input's value (docs/spec.md "操作仕様").
import { INPUT_MAX_LENGTH } from '../params';

export interface InputDelta {
    /** Newly typed letters (a-z, lower case), in the order typed. */
    chars: string[];
    /** How much of the value has been read so far (0 after `clear`). */
    seen: number;
    /** The value has grown too long: the caller empties the input (and `seen` is already 0). */
    clear: boolean;
}

/**
 * Only the part of `value` past `seen` counts as newly typed; a shorter value (Backspace) types nothing and just
 * re-aligns `seen`. Composition state is not looked at: letters a keyboard sends as composing text count too.
 */
export function readInputDelta(seen: number, value: string): InputDelta {
    const lower = value.toLowerCase();
    const from = Math.min(seen, lower.length);
    const chars = [...lower.slice(from)].filter((c) => c >= 'a' && c <= 'z');
    if (lower.length > INPUT_MAX_LENGTH) return { chars, seen: 0, clear: true };
    return { chars, seen: lower.length, clear: false };
}
