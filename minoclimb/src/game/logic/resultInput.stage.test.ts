import { describe, expect, it } from 'vitest';
import type { RawInput } from './input';
import { lockoutOver, resultAction } from './resultInput';

/** The latched presses of one frame: keys pressed (by `KeyboardEvent.code`) and where each press began. */
const frame = (keys: string[] = [], presses: [number, number][] = []): RawInput => ({
    keys: new Set(),
    pointers: [],
    pressedKeys: new Set(keys),
    pointerPressed: presses.length > 0,
    pressPoints: presses.map(([x, y]) => ({ x, y })),
    quickTaps: [],
    cancelled: new Set(),
});

const OUTSIDE: [number, number] = [180, 480]; // the prompt's position, outside the Title button
const INSIDE: [number, number] = [180, 600]; // the centre of the Title button

describe('resultAction after a clear (docs/spec/stages.md テスト観点)', () => {
    it('goes on to the next stage on Space and on a tap outside the button', () => {
        expect(resultAction(frame(['Space']), true, true)).toBe('next');
        expect(resultAction(frame([], [OUTSIDE]), true, true)).toBe('next');
        expect(resultAction(frame([], [[79, 600]]), true, true)).toBe('next');
        expect(resultAction(frame([], [[180, 632]]), true, true)).toBe('next');
    });

    it('plays the same stage again on R', () => {
        expect(resultAction(frame(['KeyR']), true, true)).toBe('retry');
    });

    it('goes to the Title on T and on a press inside the button, never to the next stage', () => {
        expect(resultAction(frame(['KeyT']), true, true)).toBe('title');
        expect(resultAction(frame([], [INSIDE]), true, true)).toBe('title');
        expect(resultAction(frame([], [[80, 568]]), true, true)).toBe('title');
    });

    it('ignores Enter and other keys', () => {
        expect(resultAction(frame(['Enter']), true, true)).toBeNull();
        expect(resultAction(frame(['KeyA']), true, true)).toBeNull();
        expect(resultAction(frame(), true, true)).toBeNull();
    });

    it('lets R win over Space and over a tap outside the button in the same frame', () => {
        expect(resultAction(frame(['KeyR', 'Space']), true, true)).toBe('retry');
        expect(resultAction(frame(['KeyR'], [OUTSIDE]), true, true)).toBe('retry');
    });

    it('lets the Title win over everything in the same frame', () => {
        expect(resultAction(frame(['KeyR', 'KeyT']), true, true)).toBe('title');
        expect(resultAction(frame(['Space', 'KeyT']), true, true)).toBe('title');
        expect(resultAction(frame(['Space'], [INSIDE]), true, true)).toBe('title');
        expect(resultAction(frame([], [OUTSIDE, INSIDE]), true, true)).toBe('title');
        expect(resultAction(frame([], [INSIDE, OUTSIDE]), true, true)).toBe('title');
    });

    it('gives "next" once for Space together with a tap outside the button', () => {
        expect(resultAction(frame(['Space'], [OUTSIDE]), true, true)).toBe('next');
    });

    it('accepts nothing before RETRY_LOCKOUT is over', () => {
        expect(resultAction(frame(['Space']), false, true)).toBeNull();
        expect(resultAction(frame(['KeyR']), false, true)).toBeNull();
        expect(resultAction(frame([], [OUTSIDE]), false, true)).toBeNull();
        expect(resultAction(frame(['KeyT']), false, true)).toBeNull();
    });
});

describe('the lockout applies to a clear too (0.49 s nothing, 0.5 s exactly accepted)', () => {
    it('ignores Space at 0.49 s and goes on to the next stage at exactly 0.5 s', () => {
        expect(resultAction(frame(['Space']), lockoutOver(0.49), true)).toBeNull();
        expect(resultAction(frame(['Space']), lockoutOver(0.5), true)).toBe('next');
    });
});

describe('resultAction after a loss is the retry it always was', () => {
    it('retries on R, Space and a tap outside the button, with or without the explicit "not cleared"', () => {
        for (const cleared of [undefined, false]) {
            expect(resultAction(frame(['KeyR']), true, cleared)).toBe('retry');
            expect(resultAction(frame(['Space']), true, cleared)).toBe('retry');
            expect(resultAction(frame([], [OUTSIDE]), true, cleared)).toBe('retry');
        }
    });

    it('never answers "next" after a loss', () => {
        const inputs = [frame(['Space']), frame(['KeyR']), frame([], [OUTSIDE]), frame(['Space'], [OUTSIDE])];
        for (const raw of inputs) expect(resultAction(raw, true, false)).not.toBe('next');
    });

    it('still goes to the Title on T and the button', () => {
        expect(resultAction(frame(['KeyT']), true, false)).toBe('title');
        expect(resultAction(frame([], [INSIDE]), true, false)).toBe('title');
    });
});
