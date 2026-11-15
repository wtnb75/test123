import { describe, expect, it } from 'vitest';
import { PointerTracker } from './pointers';

const down = () => true;

describe('one finger or the mouse', () => {
    it('taps where it was released after moving 9.99 px', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        expect(t.move(1, 109.99, 100, down)).toBeNull();
        expect(t.up(1, 109.99, 100, true)).toEqual({ x: 109.99, y: 100 });
    });

    it('starts spinning at exactly 10 px, rotating from the next move on, and does not tap on release', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        expect(t.move(1, 110, 100, down)).toBeNull(); // the crossing move itself rotates nothing
        expect(t.spinning).toBe(1);
        expect(t.move(1, 115, 98, down)).toEqual({ dx: 5, dy: -2 });
        expect(t.up(1, 115, 98, true)).toBeNull();
        expect(t.spinning).toBe(-1);
    });

    it('does not tap when the finger returns to where it started after a drag', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 120, 100, down);
        t.move(1, 100, 100, down);
        expect(t.up(1, 100, 100, true)).toBeNull();
    });

    it('taps again on the next press after a drag', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'mouse', down);
        t.move(1, 130, 100, down);
        t.up(1, 130, 100, true);
        t.down(1, 50, 60, 'mouse', down);
        expect(t.up(1, 50, 60, true)).toEqual({ x: 50, y: 60 });
    });

    it('does not tap when released outside the canvas', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        expect(t.up(1, 100, 100, false)).toBeNull();
    });

    it('ignores moves and releases of pointers it does not track', () => {
        const t = new PointerTracker();
        expect(t.move(9, 5, 5, down)).toBeNull();
        expect(t.up(9, 5, 5, true)).toBeNull();
    });
});

describe('several fingers', () => {
    it('lets another finger tap while one spins, rotating only by the spinning finger', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 130, 100, down); // starts spinning
        t.down(2, 300, 300, 'touch', down);
        expect(t.move(2, 303, 300, down)).toBeNull(); // 3 px: still a tap candidate, no rotation
        expect(t.up(2, 303, 300, true)).toEqual({ x: 303, y: 300 });
        expect(t.move(1, 140, 100, down)).toEqual({ dx: 10, dy: 0 });
    });

    it('ignores a second finger that moves past the threshold while one spins (it never taps either)', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 130, 100, down);
        t.down(2, 300, 300, 'touch', down);
        expect(t.move(2, 350, 300, down)).toBeNull();
        expect(t.move(2, 360, 300, down)).toBeNull();
        expect(t.up(2, 360, 300, true)).toBeNull();
        expect(t.spinning).toBe(1);
    });

    it('lets whichever finger crosses the threshold first spin, even if it pressed second', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.down(2, 300, 300, 'touch', down);
        t.move(2, 320, 300, down);
        expect(t.spinning).toBe(2);
        expect(t.move(1, 150, 100, down)).toBeNull(); // 50 px, but 2 already spins: ignored
        expect(t.up(1, 150, 100, true)).toBeNull();
    });

    it('keeps an ignored finger ignored after the spinning finger lifts, while a new finger can spin', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 130, 100, down);
        t.down(2, 300, 300, 'touch', down);
        t.move(2, 350, 300, down); // ignored
        t.up(1, 130, 100, true);
        expect(t.move(2, 360, 300, down)).toBeNull(); // still ignored
        expect(t.spinning).toBe(-1);
        t.down(3, 50, 50, 'touch', down);
        t.move(3, 70, 50, down);
        expect(t.spinning).toBe(3);
    });

    it('still taps with a pending finger once the spinning finger has lifted', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 130, 100, down);
        t.down(2, 300, 300, 'touch', down);
        t.up(1, 130, 100, true);
        expect(t.up(2, 301, 300, true)).toEqual({ x: 301, y: 300 });
    });

    it('keeps the first spinning finger when another presses meanwhile', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 130, 100, down);
        t.down(2, 300, 300, 'touch', down);
        expect(t.spinning).toBe(1);
    });

    it('taps once per finger when two lift in the same frame (release events are not checked)', () => {
        const t = new PointerTracker();
        t.down(1, 10, 10, 'touch', down);
        t.down(2, 20, 20, 'touch', down);
        expect(t.up(1, 10, 10, true)).toEqual({ x: 10, y: 10 });
        expect(t.up(2, 20, 20, true)).toEqual({ x: 20, y: 20 });
    });
});

describe('releases that never arrived', () => {
    it('drops a spinning finger that is no longer pressed when the next event comes, without tapping', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 130, 100, down);
        expect(t.spinning).toBe(1);
        const only2 = (id: number) => id === 2;
        t.down(2, 300, 300, 'touch', only2);
        expect(t.spinning).toBe(-1);
        expect(t.up(1, 130, 100, true)).toBeNull(); // forgotten
        t.move(2, 320, 300, only2);
        expect(t.spinning).toBe(2);
    });

    it('drops an unpressed finger on a move event too', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.down(2, 300, 300, 'touch', down);
        const only2 = (id: number) => id === 2;
        expect(t.move(2, 320, 300, only2)).toBeNull(); // finger 1 is dropped first, so 2 becomes the spinner
        expect(t.spinning).toBe(2);
        expect(t.move(2, 330, 300, only2)).toEqual({ dx: 10, dy: 0 });
        expect(t.up(1, 100, 100, true)).toBeNull();
    });

    it('forgets the stale press when the same id is pressed again', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 130, 100, down);
        t.down(1, 200, 200, 'touch', down); // the release of the first press never came
        expect(t.spinning).toBe(-1);
        t.move(1, 230, 200, down);
        expect(t.spinning).toBe(1);
    });
});

describe('limits and reset', () => {
    it('ignores a 5th touch but still takes the mouse, and takes a new touch once one lifts', () => {
        const t = new PointerTracker();
        for (let id = 1; id <= 4; id++) t.down(id, id * 10, 0, 'touch', down);
        t.down(5, 500, 0, 'touch', down);
        expect(t.up(5, 500, 0, true)).toBeNull();
        t.down(0, 5, 5, 'mouse', down);
        expect(t.up(0, 5, 5, true)).toEqual({ x: 5, y: 5 });
        t.up(1, 10, 0, true);
        t.down(6, 600, 0, 'touch', down);
        expect(t.up(6, 600, 0, true)).toEqual({ x: 600, y: 0 });
    });

    it('forgets every pointer on reset', () => {
        const t = new PointerTracker();
        t.down(1, 100, 100, 'touch', down);
        t.move(1, 130, 100, down);
        t.down(2, 300, 300, 'touch', down);
        t.reset();
        expect(t.spinning).toBe(-1);
        expect(t.up(2, 300, 300, true)).toBeNull();
        expect(t.move(1, 140, 100, down)).toBeNull();
    });
});
