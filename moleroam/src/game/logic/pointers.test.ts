import { beforeEach, describe, expect, it } from 'vitest';
import { PointerTracker } from './pointers';

// dragThresholdPx = 10, maxTouchPointers = 2. Pointer 0 is the mouse; 1, 2, 3 are fingers.
const MOUSE = 0;
const A = 1;
const B = 2;
const C = 3;

describe('PointerTracker', () => {
    let down: Set<number>;
    let t: PointerTracker;

    const press = (id: number, x: number, y: number) => {
        down.add(id);
        t.press(id, id !== MOUSE, x, y);
    };
    /** Like Phaser: the pointer is already up when its release event arrives. */
    const lift = (id: number, x: number, y: number, inside = true) => {
        down.delete(id);
        return t.release(id, x, y, inside);
    };

    beforeEach(() => {
        down = new Set();
        t = new PointerTracker((id) => down.has(id));
    });

    describe('one pointer (finger or mouse)', () => {
        it.each([A, MOUSE])('strikes at the release position when it moved 9.99px (pointer %i)', (id) => {
            press(id, 100, 100);
            expect(t.move(id, 109.99, 100)).toBeNull();
            expect(lift(id, 109.99, 100)).toEqual({ x: 109.99, y: 100 });
        });

        it.each([A, MOUSE])('starts scrolling at exactly 10px, never strikes on release (pointer %i)', (id) => {
            press(id, 100, 100);
            expect(t.move(id, 110, 100)).toEqual({ x: -10, y: 0 });
            expect(t.move(id, 115, 108)).toEqual({ x: -5, y: -8 });
            expect(lift(id, 115, 108)).toBeNull();
        });

        it('keeps a drag a drag after the finger returns to the press point', () => {
            press(A, 100, 100);
            t.move(A, 130, 100);
            expect(t.move(A, 100, 100)).toEqual({ x: 30, y: 0 });
            expect(lift(A, 100, 100)).toBeNull();
        });

        it('does not strike when released 10px away without any move event', () => {
            press(A, 100, 100);
            expect(lift(A, 100, 110)).toBeNull();
        });

        it('does not strike when released outside the canvas', () => {
            press(A, 5, 5);
            expect(lift(A, 5, 5, false)).toBeNull();
        });

        it('strikes again on the next tap after a drag', () => {
            press(A, 100, 100);
            t.move(A, 200, 100);
            lift(A, 200, 100);
            press(A, 300, 300);
            expect(lift(A, 300, 300)).toEqual({ x: 300, y: 300 });
        });

        it('ignores moves and releases of a pointer that was never pressed', () => {
            expect(t.move(MOUSE, 10, 10)).toBeNull();
            expect(lift(MOUSE, 10, 10)).toBeNull();
        });

        it('stops following a pointer after its release', () => {
            press(A, 100, 100);
            lift(A, 100, 100);
            expect(t.move(A, 300, 100)).toBeNull();
            expect(lift(A, 300, 100)).toBeNull();
        });
    });

    describe('two fingers', () => {
        it('strikes at the second finger’s release while the first one scrolls; scroll comes only from the first', () => {
            press(A, 100, 100);
            expect(t.move(A, 130, 100)).toEqual({ x: -30, y: 0 });
            press(B, 500, 500);
            expect(t.move(B, 503, 500)).toBeNull();
            expect(t.move(A, 150, 100)).toEqual({ x: -20, y: 0 });
            expect(lift(B, 503, 500)).toEqual({ x: 503, y: 500 });
            expect(t.move(A, 160, 100)).toEqual({ x: -10, y: 0 });
        });

        it('lets the first finger tap while the second one scrolls', () => {
            press(B, 400, 400);
            press(A, 100, 100);
            expect(t.move(B, 400, 450)).toEqual({ x: 0, y: -50 });
            expect(lift(A, 102, 100)).toEqual({ x: 102, y: 100 });
        });

        it('keeps the scroll finger when another finger presses afterwards', () => {
            press(A, 100, 100);
            t.move(A, 120, 100);
            press(B, 300, 300);
            expect(t.move(A, 125, 100)).toEqual({ x: -5, y: 0 });
        });

        it('lets only the first finger past the threshold scroll', () => {
            press(A, 100, 100);
            press(B, 300, 300);
            expect(t.move(A, 105, 100)).toBeNull();
            expect(t.move(B, 300, 320)).toEqual({ x: 0, y: -20 });
            expect(t.move(A, 160, 100)).toBeNull();
            expect(lift(A, 160, 100)).toBeNull();
        });

        it('never strikes a second finger that dragged while the first was scrolling', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(B, 300, 300);
            expect(t.move(B, 350, 300)).toBeNull();
            expect(lift(B, 350, 300)).toBeNull();
        });

        it('hands the scroll to a finger that already dragged once the scroll finger is up, from its last seen position', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(B, 300, 300);
            t.move(B, 350, 300); // ignored, but seen
            lift(A, 150, 100);
            expect(t.move(B, 355, 300)).toEqual({ x: -5, y: 0 });
            expect(lift(B, 355, 300)).toBeNull();
        });

        it('lets a finger that has not reached the threshold still tap after the scroll finger is up', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(B, 300, 300);
            lift(A, 150, 100);
            expect(lift(B, 304, 300)).toEqual({ x: 304, y: 300 });
        });

        it('strikes twice when both fingers tap', () => {
            press(A, 100, 100);
            press(B, 300, 300);
            expect(lift(A, 100, 100)).toEqual({ x: 100, y: 100 });
            expect(lift(B, 300, 300)).toEqual({ x: 300, y: 300 });
        });

        it('strikes for both fingers lifted together (both already up when the first release arrives)', () => {
            press(A, 100, 100);
            press(B, 300, 300);
            down.clear();
            expect(t.release(A, 100, 100, true)).toEqual({ x: 100, y: 100 });
            expect(t.release(B, 300, 300, true)).toEqual({ x: 300, y: 300 });
        });

        it('does not strike the tap of a finger lifted together with the scroll finger', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(B, 300, 300);
            down.clear();
            expect(t.release(A, 150, 100, true)).toBeNull();
            expect(t.release(B, 301, 300, true)).toEqual({ x: 301, y: 300 });
        });

        it('lets the mouse scroll independently from a scrolling finger; both deltas are reported', () => {
            press(A, 100, 100);
            expect(t.move(A, 120, 100)).toEqual({ x: -20, y: 0 });
            press(MOUSE, 500, 500);
            expect(t.move(MOUSE, 500, 530)).toEqual({ x: 0, y: -30 });
            expect(t.move(A, 130, 100)).toEqual({ x: -10, y: 0 });
        });
    });

    describe('more than maxTouchPointers fingers', () => {
        it('ignores a third finger completely while two are down', () => {
            press(A, 100, 100);
            press(B, 200, 200);
            press(C, 300, 300);
            expect(t.move(C, 400, 300)).toBeNull();
            expect(lift(C, 400, 300)).toBeNull();
            expect(lift(A, 100, 100)).toEqual({ x: 100, y: 100 });
        });

        it('keeps ignoring that third finger after a slot frees up', () => {
            press(A, 100, 100);
            press(B, 200, 200);
            press(C, 300, 300);
            lift(A, 100, 100);
            expect(lift(C, 300, 300)).toBeNull();
        });

        it('follows a finger pressed after one of the two lifted', () => {
            press(A, 100, 100);
            press(B, 200, 200);
            lift(A, 100, 100);
            press(C, 300, 300);
            expect(lift(C, 300, 300)).toEqual({ x: 300, y: 300 });
        });

        it('does not count a pressed mouse against the two fingers', () => {
            press(MOUSE, 400, 400);
            press(A, 100, 100);
            press(B, 200, 200);
            expect(lift(B, 200, 200)).toEqual({ x: 200, y: 200 });
            expect(lift(A, 100, 100)).toEqual({ x: 100, y: 100 });
        });

        it('lets the mouse press while two fingers are down', () => {
            press(A, 100, 100);
            press(B, 200, 200);
            press(MOUSE, 400, 400);
            expect(lift(MOUSE, 400, 400)).toEqual({ x: 400, y: 400 });
        });
    });

    describe('lost releases and cancels', () => {
        it('drops a finger that is no longer down without a strike when any event arrives', () => {
            press(A, 100, 100);
            down.delete(A); // released outside the window: no release event
            expect(t.move(MOUSE, 5, 5)).toBeNull();
            expect(lift(A, 100, 100)).toBeNull();
        });

        it('frees the slot of a lost finger before judging a third finger', () => {
            press(A, 100, 100);
            press(B, 200, 200);
            down.delete(A);
            press(C, 300, 300);
            expect(lift(C, 300, 300)).toEqual({ x: 300, y: 300 });
        });

        it('stops a lost scroll finger being the scroll finger', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(B, 300, 300);
            t.move(B, 350, 300);
            down.delete(A);
            expect(t.move(B, 360, 300)).toEqual({ x: -10, y: 0 });
        });

        it('drops a moving pointer that is no longer down', () => {
            press(MOUSE, 100, 100);
            down.delete(MOUSE);
            expect(t.move(MOUSE, 200, 100)).toBeNull();
            expect(lift(MOUSE, 200, 100)).toBeNull();
        });

        it('treats a press by a pointer that is already tracked as a new press', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(A, 400, 400);
            expect(lift(A, 400, 400)).toEqual({ x: 400, y: 400 });
        });

        it('cancel of the scroll finger does not strike and lets the other finger take over', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(B, 300, 300);
            t.move(B, 340, 300);
            t.cancel(A);
            expect(lift(A, 150, 100)).toBeNull();
            expect(t.move(B, 345, 300)).toEqual({ x: -5, y: 0 });
        });

        it('cancel of a finger that is not the scroll finger keeps the scroll finger', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(B, 300, 300);
            t.cancel(B);
            expect(t.move(A, 160, 100)).toEqual({ x: -10, y: 0 });
        });

        it('clear forgets every pointer', () => {
            press(A, 100, 100);
            t.move(A, 150, 100);
            press(B, 300, 300);
            t.clear();
            expect(t.move(A, 160, 100)).toBeNull();
            expect(lift(B, 300, 300)).toBeNull();
            press(C, 50, 50);
            press(A, 60, 60);
            expect(lift(C, 50, 50)).toEqual({ x: 50, y: 50 });
        });
    });
});
