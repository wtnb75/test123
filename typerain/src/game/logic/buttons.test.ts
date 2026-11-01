import { describe, expect, it } from 'vitest';
import { ButtonPress, buttonLook, GuardTimer, guardOver } from './buttons';

describe('ButtonPress', () => {
    it('acts when a pointer that went down on the button is released over it', () => {
        const b = new ButtonPress();
        expect(b.down(1, true)).toBe(true);
        expect(b.isPressed).toBe(true);
        expect(b.release(1)).toBe(true);
        expect(b.isPressed).toBe(false);
    });

    it('does not act twice for one press', () => {
        const b = new ButtonPress();
        b.down(1, true);
        expect(b.release(1)).toBe(true);
        expect(b.release(1)).toBe(false);
    });

    it('does not act on a release with no press (the press started elsewhere or before this Scene)', () => {
        expect(new ButtonPress().release(5)).toBe(false);
    });

    it('does not act when the pointer pressed one button and is released over another', () => {
        const retry = new ButtonPress();
        const toTitle = new ButtonPress();
        retry.down(1, true);
        expect(toTitle.release(1)).toBe(false);
        expect(retry.isPressed).toBe(true);
    });

    it('does not register a press while input is not accepted (guard time, rotate notice)', () => {
        const b = new ButtonPress();
        expect(b.down(1, false)).toBe(false);
        expect(b.isPressed).toBe(false);
        expect(b.release(1)).toBe(false);
    });

    it('forgets a pointer that slid off, so coming back and releasing does nothing', () => {
        const b = new ButtonPress();
        b.down(1, true);
        b.drop(1);
        expect(b.release(1)).toBe(false);
    });

    it('tracks pointers independently', () => {
        const b = new ButtonPress();
        b.down(1, true);
        b.down(2, true);
        b.drop(1);
        expect(b.isPressed).toBe(true);
        expect(b.release(2)).toBe(true);
        expect(b.isPressed).toBe(false);
    });

    it('clear forgets every pointer', () => {
        const b = new ButtonPress();
        b.down(1, true);
        b.down(2, true);
        b.clear();
        expect(b.isPressed).toBe(false);
        expect(b.release(1)).toBe(false);
    });
});

describe('buttonLook', () => {
    it('ranks pressed above hover above normal', () => {
        expect(buttonLook(true, true, true)).toBe('pressed');
        expect(buttonLook(true, false, true)).toBe('pressed');
        expect(buttonLook(false, true, true)).toBe('hover');
        expect(buttonLook(false, false, true)).toBe('normal');
    });

    it('stays normal while input is not accepted', () => {
        expect(buttonLook(true, true, false)).toBe('normal');
        expect(buttonLook(false, true, false)).toBe('normal');
    });
});

describe('GuardTimer', () => {
    it('starts closed whatever the wall clock says, and opens only after the summed frame deltas reach the guard time', () => {
        const t = new GuardTimer();
        expect(t.isOver(500)).toBe(false);
        for (let i = 0; i < 30; i++) t.tick(16); // 480 ms
        expect(t.isOver(500)).toBe(false);
        t.tick(16); // 496 ms
        expect(t.isOver(500)).toBe(false);
        t.tick(4); // exactly 500 ms
        expect(t.isOver(500)).toBe(true);
    });

    it('closes again after reset (a new Scene start), so a previous run does not leak into the next', () => {
        const t = new GuardTimer();
        t.tick(2000);
        expect(t.isOver(500)).toBe(true);
        t.reset();
        expect(t.isOver(500)).toBe(false);
    });
});

describe('guardOver', () => {
    it('ignores input until exactly the guard time has passed (499 ms no, 500 ms yes)', () => {
        expect(guardOver(0, 500)).toBe(false);
        expect(guardOver(499, 500)).toBe(false);
        expect(guardOver(500, 500)).toBe(true);
        expect(guardOver(5000, 500)).toBe(true);
    });
});
