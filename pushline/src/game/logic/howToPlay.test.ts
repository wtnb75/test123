import { describe, expect, it } from 'vitest';
import { HOW_TO_PLAY_TEXT, HowToPlayMemory, HowToPlayNote, howToPlayAlpha, pageHowToPlay } from './howToPlay';

// Expected values are hand-worked from docs/spec/effects.md "遊び方の一言の規則":
// 0 at t=0, linear to 1 at 300 ms, 1 until 5700 ms, linear down to 0 at exactly 6000 ms.
describe('howToPlayAlpha', () => {
    it.each([
        [0, 0],
        [150, 0.5],
        [300, 1],
        [3000, 1],
        [5000, 1],
        [5700, 1],
        [5850, 0.5],
        [6000, 0],
        [6500, 0],
        [-10, 0],
    ])('is %i ms after entering -> opacity %f', (t, expected) => {
        expect(howToPlayAlpha(t)).toBeCloseTo(expected, 10);
    });

    it('is nearly 0 but still visible one millisecond before the end', () => {
        const a = howToPlayAlpha(5999);
        expect(a).toBeGreaterThan(0);
        expect(a).toBeLessThan(0.01);
    });
});

describe('HowToPlayMemory', () => {
    it('claims once and refuses every later claim', () => {
        const m = new HowToPlayMemory();
        expect([m.claim(), m.claim(), m.claim()]).toEqual([true, false, false]);
    });

    it('gives a fresh memory (a page reload) its own first claim', () => {
        const a = new HowToPlayMemory();
        a.claim();
        expect(new HowToPlayMemory().claim()).toBe(true);
    });

    it('does not touch storage', () => {
        const names = ['localStorage', 'sessionStorage'] as const;
        const calls: string[] = [];
        const originals = names.map((n) => Object.getOwnPropertyDescriptor(globalThis, n));
        names.forEach((n) => Object.defineProperty(globalThis, n, {
            configurable: true,
            get() {
                calls.push(n);
                return undefined;
            },
        }));
        try {
            // positive control: the trap does record an access
            void (globalThis as { localStorage?: unknown }).localStorage;
            expect(calls).toEqual(['localStorage']);
            calls.length = 0;

            new HowToPlayMemory().claim();
            const note = new HowToPlayNote(0);
            note.alpha(100);
            note.isGone(100);
            note.dismiss();
        } finally {
            names.forEach((n, i) => {
                const original = originals[i];
                if (original) Object.defineProperty(globalThis, n, original);
                else Reflect.deleteProperty(globalThis, n);
            });
        }
        expect(calls).toEqual([]);
    });

    it('exposes a page-wide memory that starts unspent and is spent by its first claim', () => {
        // The only test that uses the shared instance (vitest isolates modules per test file).
        expect(pageHowToPlay.claim()).toBe(true);
        expect(pageHowToPlay.claim()).toBe(false);
    });
});

describe('HowToPlayNote', () => {
    const START = 1000; // the Scene clock at entry is not 0

    it('measures time from the entry, not from clock 0', () => {
        const note = new HowToPlayNote(START);
        expect(note.alpha(START)).toBe(0);
        expect(note.alpha(START + 300)).toBe(1);
        expect(note.alpha(START + 5850)).toBeCloseTo(0.5, 10);
    });

    it('is gone exactly at 6000 ms and not one millisecond earlier', () => {
        const note = new HowToPlayNote(START);
        expect(note.isGone(START + 5999)).toBe(false);
        expect(note.isGone(START + 6000)).toBe(true);
        expect(note.alpha(START + 6000)).toBe(0);
    });

    it('is gone at once when dismissed in the middle of the fade in (first line cleared at 100 ms)', () => {
        const note = new HowToPlayNote(START);
        expect(note.alpha(START + 100)).toBeGreaterThan(0);
        note.dismiss();
        expect(note.alpha(START + 100)).toBe(0);
        expect(note.isGone(START + 100)).toBe(true);
    });

    it('is gone at once when dismissed at full opacity (first line cleared at 2000 ms)', () => {
        const note = new HowToPlayNote(START);
        note.dismiss();
        expect(note.alpha(START + 2000)).toBe(0);
        expect(note.isGone(START + 2000)).toBe(true);
    });

    it('is gone at once when dismissed in the middle of the fade out (5800 ms)', () => {
        const note = new HowToPlayNote(START);
        expect(note.alpha(START + 5800)).toBeGreaterThan(0);
        note.dismiss();
        expect(note.alpha(START + 5800)).toBe(0);
        expect(note.isGone(START + 5800)).toBe(true);
    });

    it('does not come back once dismissed, whatever the clock says afterwards', () => {
        const note = new HowToPlayNote(START);
        note.dismiss();
        [START, START + 300, START + 3000].forEach((t) => expect(note.alpha(t)).toBe(0));
    });

    it('stays visible during the middle of its time when nothing dismisses it', () => {
        const note = new HowToPlayNote(START);
        expect(note.isGone(START + 3000)).toBe(false);
    });
});

describe('HOW_TO_PLAY_TEXT', () => {
    it('is the 12-letter goal line (and says nothing about the character row or fixed blocks)', () => {
        expect(HOW_TO_PLAY_TEXT).toBe('ブロックで一列を埋めよう');
        expect(HOW_TO_PLAY_TEXT).toHaveLength(12);
    });
});
