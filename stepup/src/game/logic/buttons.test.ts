import { describe, expect, it } from 'vitest';
import { ButtonPress, buttonLook } from './buttons';

describe('ButtonPress (docs/spec.md "押しの登録")', () => {
    it('acts when a registered pointer is released over the button', () => {
        const b = new ButtonPress();
        expect(b.down(1, true)).toBe(true);
        expect(b.isPressed).toBe(true);
        expect(b.release(1)).toBe(true);
        expect(b.isPressed).toBe(false);
    });

    it('does not act for a pointer that went down while the Scene was not accepting input', () => {
        const b = new ButtonPress();
        expect(b.down(1, false)).toBe(false);
        expect(b.isPressed).toBe(false);
        // pressed in the Result guard time, released after it: still nothing
        expect(b.release(1)).toBe(false);
    });

    it('does not act for a pointer that never went down here (a finger from the previous Scene)', () => {
        expect(new ButtonPress().release(7)).toBe(false);
    });

    it('does not act after the pointer left the button, even if it comes back and is released', () => {
        const b = new ButtonPress();
        b.down(1, true);
        b.drop(1); // left the button
        expect(b.isPressed).toBe(false);
        expect(b.release(1)).toBe(false); // back over it: not registered again
    });

    it('acts only once per press', () => {
        const b = new ButtonPress();
        b.down(1, true);
        expect(b.release(1)).toBe(true);
        expect(b.release(1)).toBe(false);
    });

    it('tracks pointers independently: a second finger neither starts nor cancels the first', () => {
        const b = new ButtonPress();
        b.down(1, true);
        b.down(2, true);
        b.drop(2);
        expect(b.isPressed).toBe(true);
        expect(b.release(1)).toBe(true);
        expect(b.release(2)).toBe(false);
    });

    it('keeps different buttons apart: a pointer pressed on one is not a press on the other', () => {
        const start = new ButtonPress();
        const retry = new ButtonPress();
        start.down(1, true);
        retry.down(2, true);
        expect(retry.release(1)).toBe(false); // pointer 1 pressed the other button
        expect(start.release(1)).toBe(true);
        expect(retry.release(2)).toBe(true); // each acts for its own pointer
    });

    it('forgets every pointer on clear (the rotate notice appeared)', () => {
        const b = new ButtonPress();
        b.down(1, true);
        b.down(2, true);
        b.clear();
        expect(b.isPressed).toBe(false);
        expect(b.release(1)).toBe(false);
    });
});

describe('buttonLook', () => {
    it('prefers pressed over hover over normal', () => {
        expect(buttonLook(true, true, true)).toBe('pressed');
        expect(buttonLook(true, false, true)).toBe('pressed');
        expect(buttonLook(false, true, true)).toBe('hover');
        expect(buttonLook(false, false, true)).toBe('normal');
    });

    it('stays normal while the Scene is not accepting input (guard time, rotate notice)', () => {
        expect(buttonLook(true, true, false)).toBe('normal');
        expect(buttonLook(false, true, false)).toBe('normal');
    });
});
