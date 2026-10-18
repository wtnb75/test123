import { describe, expect, it } from 'vitest';
import type { PointerState, QuickTap } from '../logic/input';
import { TouchLatch } from './touchLatch';

const downPointer = (id: number): PointerState => ({ id, x: 0, y: 0, downX: 0, downY: 0, isDown: true });

const drain = (latch: TouchLatch): { taps: QuickTap[]; cancelled: Set<number> } => {
    const taps: QuickTap[] = [];
    const cancelled = new Set<number>();
    latch.drain(taps, cancelled);
    return { taps, cancelled };
};

describe('TouchLatch', () => {
    it('hands over a press that began and ended before any read saw it down, with both positions', () => {
        const latch = new TouchLatch();
        latch.down(1, 100, 600);
        latch.up(1, 104, 603, { primaryStillDown: false, canceled: false });
        expect(drain(latch)).toEqual({
            taps: [{ id: 1, downX: 100, downY: 600, x: 104, y: 603 }],
            cancelled: new Set(),
        });
    });

    it('gives nothing for a press a read saw down: the polling already handles its release', () => {
        const latch = new TouchLatch();
        latch.down(1, 100, 600);
        latch.markSeen([downPointer(1)]);
        latch.up(1, 100, 600, { primaryStillDown: false, canceled: false });
        expect(drain(latch)).toEqual({ taps: [], cancelled: new Set() });
    });

    it('reports a touch cancel as cancelled, not as a quick tap, even if no read saw it down', () => {
        const latch = new TouchLatch();
        latch.down(1, 100, 600);
        latch.up(1, 100, 600, { primaryStillDown: false, canceled: true });
        expect(drain(latch)).toEqual({ taps: [], cancelled: new Set([1]) });
    });

    it('reports a cancel of a press a read saw down as cancelled', () => {
        const latch = new TouchLatch();
        latch.down(2, 10, 10);
        latch.markSeen([downPointer(2)]);
        latch.up(2, 10, 10, { primaryStillDown: false, canceled: true });
        expect(drain(latch).cancelled).toEqual(new Set([2]));
    });

    it('reports a release outside the canvas as cancelled and forgets the press', () => {
        const latch = new TouchLatch();
        latch.down(1, 100, 600);
        latch.upOutside(1, false);
        latch.up(1, 100, 600, { primaryStillDown: false, canceled: false }); // no press left: not a quick tap
        expect(drain(latch)).toEqual({ taps: [], cancelled: new Set([1]) });
    });

    it('ignores the release of another mouse button while the primary one is still held', () => {
        const latch = new TouchLatch();
        latch.down(0, 50, 50);
        latch.up(0, 50, 50, { primaryStillDown: true, canceled: false }); // right button released, primary still down
        latch.up(0, 52, 50, { primaryStillDown: false, canceled: false }); // the primary release later is still a quick tap
        expect(drain(latch).taps).toEqual([{ id: 0, downX: 50, downY: 50, x: 52, y: 50 }]);
    });

    it('keeps the primary press when another mouse button is pressed or released outside the canvas', () => {
        const latch = new TouchLatch();
        latch.down(0, 50, 50);
        latch.down(0, 70, 70); // another button goes down: the first press stays
        latch.upOutside(0, true); // another button released outside while the primary is held
        latch.up(0, 52, 50, { primaryStillDown: false, canceled: false });
        expect(drain(latch)).toEqual({
            taps: [{ id: 0, downX: 50, downY: 50, x: 52, y: 50 }],
            cancelled: new Set(),
        });
    });

    it('does not mix up the two flags: a cancel with the primary still down is ignored, a plain release is a tap', () => {
        const latch = new TouchLatch();
        latch.down(1, 5, 5);
        latch.up(1, 5, 5, { primaryStillDown: true, canceled: true });
        expect(drain(latch).cancelled.size).toBe(0);
        latch.up(1, 5, 5, { primaryStillDown: false, canceled: false });
        expect(drain(latch).taps).toHaveLength(1);
    });

    it('ignores a release that has no press (the finger that started the Scene, held from before)', () => {
        const latch = new TouchLatch();
        latch.up(3, 0, 0, { primaryStillDown: false, canceled: false });
        expect(drain(latch)).toEqual({ taps: [], cancelled: new Set() });
    });

    it('clears what it handed over, so the next read starts empty', () => {
        const latch = new TouchLatch();
        latch.down(1, 1, 1);
        latch.up(1, 1, 1, { primaryStillDown: false, canceled: false });
        latch.upOutside(2, false);
        drain(latch);
        expect(drain(latch)).toEqual({ taps: [], cancelled: new Set() });
    });

    it('does not mark pointers that are not down as seen', () => {
        const latch = new TouchLatch();
        latch.down(1, 1, 1);
        latch.markSeen([{ ...downPointer(1), isDown: false }]);
        latch.up(1, 1, 1, { primaryStillDown: false, canceled: false });
        expect(drain(latch).taps).toHaveLength(1);
    });
});
