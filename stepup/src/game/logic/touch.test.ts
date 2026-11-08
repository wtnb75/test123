import { describe, expect, it } from 'vitest';
import { combineDir, swipeStep, TouchTracker } from './touch';

// The Scene glue around this tracker (input only while playing and without the rotate notice, pointer cancel,
// the left mouse button only) is not unit-tested; game-qa checks it (two fingers, the notice) in a real browser.

describe('swipeStep', () => {
    it('stays at 0 inside the dead zone (difference <= 8) and moves just past it', () => {
        expect(swipeStep(100, 105)).toEqual({ dir: 0, anchor: 100 });
        expect(swipeStep(100, 108).dir).toBe(0);
        expect(swipeStep(100, 108.01).dir).toBe(1);
        expect(swipeStep(100, 92).dir).toBe(0);
        expect(swipeStep(100, 91.99).dir).toBe(-1);
    });

    it('drags the anchor along 28 px behind a finger that goes further', () => {
        expect(swipeStep(100, 128)).toEqual({ dir: 1, anchor: 100 });
        expect(swipeStep(100, 140)).toEqual({ dir: 1, anchor: 112 });
        expect(swipeStep(100, 60)).toEqual({ dir: -1, anchor: 88 });
    });

    it('turns around after a short move back (anchor 112, finger 140 -> 120 is difference 8 -> 0, 110 -> 0, 103 -> -1)', () => {
        expect(swipeStep(112, 120).dir).toBe(0);
        expect(swipeStep(112, 110).dir).toBe(0);
        expect(swipeStep(112, 103).dir).toBe(-1);
    });
});

describe('combineDir', () => {
    it('adds the keyboard and the swipe and clamps to -1..1', () => {
        expect(combineDir(-1, 1)).toBe(0);
        expect(combineDir(1, 1)).toBe(1);
        expect(combineDir(-1, -1)).toBe(-1);
        expect(combineDir(1, -1)).toBe(0);
        expect(combineDir(0, 0)).toBe(0);
    });
});

describe('TouchTracker: a single finger', () => {
    it('presses once for a short tap with a small wobble (5 px, 200 ms)', () => {
        const t = new TouchTracker();
        expect(t.down(1, 100, 300, 1000)).toBe(0);
        t.move(1, 105, 300);
        expect(t.dir).toBe(0);
        expect(t.up(1, 1200)).toBe(1);
    });

    it('counts 300 ms exactly as a tap and 301 ms as nothing', () => {
        const a = new TouchTracker();
        a.down(1, 0, 0, 0);
        expect(a.up(1, 300)).toBe(1);
        const b = new TouchTracker();
        b.down(1, 0, 0, 0);
        expect(b.up(1, 301)).toBe(0);
    });

    it('keeps a finger that moved exactly 12 px a tap, and turns one that moved 12.01 px into a swipe', () => {
        const a = new TouchTracker();
        a.down(1, 100, 100, 0);
        a.move(1, 112, 100);
        expect(a.up(1, 100)).toBe(1);
        const b = new TouchTracker();
        b.down(1, 100, 100, 0);
        b.move(1, 112.01, 100);
        expect(b.dir).toBe(1);
        expect(b.up(1, 100)).toBe(0);
    });

    it('measures the 12 px as a straight-line distance (a vertical drag also stops it being a tap)', () => {
        const t = new TouchTracker();
        t.down(1, 100, 100, 0);
        t.move(1, 100, 120);
        expect(t.up(1, 100)).toBe(0);
    });

    it('does nothing for a finger held still for 400 ms and released', () => {
        const t = new TouchTracker();
        t.down(1, 100, 100, 0);
        expect(t.up(1, 400)).toBe(0);
    });

    it('swipes: 13 px right sets direction +1 from an anchor at the touch point, a hold keeps it', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        t.move(1, 113, 300);
        expect(t.dir).toBe(1);
        t.move(1, 113, 300); // held still: the direction stays
        expect(t.dir).toBe(1);
    });

    it('follows the swipe: 108 is still still, 140 drags the anchor to 112, and returning to 103 reverses', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        t.move(1, 113, 300); // becomes a swipe, anchor 100
        t.move(1, 108, 300);
        expect(t.dir).toBe(0);
        t.move(1, 140, 300);
        expect(t.dir).toBe(1);
        t.move(1, 120, 300); // anchor 112: difference 8
        expect(t.dir).toBe(0);
        t.move(1, 103, 300);
        expect(t.dir).toBe(-1);
    });

    it('never presses when a swiping finger is lifted, and the direction goes back to 0', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        t.move(1, 150, 300);
        expect(t.up(1, 100)).toBe(0);
        expect(t.dir).toBe(0);
    });

    it('ignores moves and releases of a finger it never saw go down', () => {
        const t = new TouchTracker();
        t.move(9, 100, 100);
        expect(t.up(9, 0)).toBe(0);
        expect(t.dir).toBe(0);
    });

    it('drops a cancelled finger without a press', () => {
        const t = new TouchTracker();
        t.down(1, 100, 100, 0);
        t.cancel(1);
        expect(t.up(1, 10)).toBe(0);
    });
});

describe('TouchTracker: two fingers', () => {
    it('acts the moment a second finger goes down while the first swipes, and the first keeps swiping', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        t.move(1, 150, 300);
        expect(t.down(2, 300, 500, 50)).toBe(1);
        expect(t.dir).toBe(1);
    });

    it('does not move for the second finger even if it travels, and lifting it adds no press', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        t.move(1, 150, 300);
        t.down(2, 300, 500, 50);
        t.move(2, 200, 500);
        expect(t.dir).toBe(1); // still the first finger's direction (+1), not the second's (-1)
        expect(t.up(2, 100)).toBe(0);
    });

    it('acts for a second finger while the first is only a held candidate (not yet a swipe)', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        expect(t.down(2, 200, 300, 500)).toBe(1);
        // the first finger can still become a swipe afterwards
        t.move(1, 150, 300);
        expect(t.dir).toBe(1);
    });

    it('lets a finger count again once the busy one is gone (an ignored finger does not block)', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        t.down(2, 200, 300, 10); // acts, ignored
        expect(t.up(1, 20)).toBe(1); // first lifted 20 ms later: it was a tap -> 1 press (a real tap of its own)
        expect(t.down(3, 50, 50, 30)).toBe(0); // only an ignored finger remains: 3 is a candidate
        expect(t.up(3, 100)).toBe(1);
    });

    it('presses once per extra finger: a third finger acts while the first still swipes', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        t.move(1, 150, 300);
        expect(t.down(2, 10, 10, 10)).toBe(1);
        expect(t.down(3, 20, 20, 20)).toBe(1);
    });

    it('clears candidate, swiping and ignored fingers alike, and the next tap after that presses once', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0); // candidate
        t.down(2, 200, 300, 10); // ignored (acted)
        t.clear();
        expect(t.down(3, 10, 10, 1000)).toBe(0); // nobody blocks: a candidate again
        expect(t.up(3, 1100)).toBe(1);
        // the cleared fingers stay inert when they are lifted later
        expect(t.up(1, 1200)).toBe(0);
        expect(t.up(2, 1200)).toBe(0);
    });

    it('clears every finger without presses (the rotate notice appeared)', () => {
        const t = new TouchTracker();
        t.down(1, 100, 300, 0);
        t.move(1, 150, 300);
        t.clear();
        expect(t.dir).toBe(0);
        expect(t.up(1, 10)).toBe(0);
        expect(t.down(2, 0, 0, 20)).toBe(0); // the slot is free again
    });
});
