import { describe, expect, it } from 'vitest';
import { readInputDelta } from './input';

describe('readInputDelta', () => {
    it('returns the letters typed since last time, in order', () => {
        expect(readInputDelta(0, 'ab')).toEqual({ chars: ['a', 'b'], seen: 2, clear: false });
        expect(readInputDelta(2, 'abc')).toEqual({ chars: ['c'], seen: 3, clear: false });
    });

    it('types nothing when the value did not grow', () => {
        expect(readInputDelta(3, 'abc')).toEqual({ chars: [], seen: 3, clear: false });
    });

    it('treats a shorter value (Backspace) as typing nothing and re-aligns, so the next letter counts', () => {
        expect(readInputDelta(3, 'ab')).toEqual({ chars: [], seen: 2, clear: false });
        expect(readInputDelta(2, 'abx')).toEqual({ chars: ['x'], seen: 3, clear: false });
    });

    it('turns capitals into lower case', () => {
        expect(readInputDelta(0, 'AbC').chars).toEqual(['a', 'b', 'c']);
    });

    it('drops anything that is not a to z (digits, spaces, symbols, other scripts)', () => {
        expect(readInputDelta(0, 'a1 !b-ー').chars).toEqual(['a', 'b']);
    });

    it('counts letters a keyboard sends in one go (several at once)', () => {
        expect(readInputDelta(0, 'tree').chars).toEqual(['t', 'r', 'e', 'e']);
    });

    it('keeps a 24-character value as is', () => {
        const delta = readInputDelta(23, 'a'.repeat(24));
        expect(delta).toEqual({ chars: ['a'], seen: 24, clear: false });
    });

    it('still types the 25th character, then asks to empty the input and restarts counting from 0', () => {
        const delta = readInputDelta(24, 'a'.repeat(24) + 'z');
        expect(delta).toEqual({ chars: ['z'], seen: 0, clear: true });
    });
});
