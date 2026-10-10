import { describe, expect, it } from 'vitest';
import { Flow, guardOpen, QuitConfirm } from './flow';
import { LANDSCAPE, PORTRAIT } from './layout';

// Portrait layout: board (40..440, 110..590), Undo button x 30..230 / Quit x 250..450, both y 660..740.
const BOARD = { x: 200, y: 300 };

describe('Flow: pointer session', () => {
    it('turns a press and a release in place into a tap at the release position', () => {
        const f = new Flow();
        expect(f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT)).toEqual({ kind: 'none' });
        expect(f.pointerUp(1, BOARD.x + 3, BOARD.y - 2)).toEqual({ kind: 'tap', x: BOARD.x + 3, y: BOARD.y - 2 });
    });

    it('turns a 24 px drag into a swipe and a 23 px drag into a tap', () => {
        const f = new Flow();
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT);
        expect(f.pointerUp(1, BOARD.x + 24, BOARD.y)).toEqual({ kind: 'swipe', dir: 'right' });
        f.pointerDown(2, BOARD.x, BOARD.y, PORTRAIT);
        expect(f.pointerUp(2, BOARD.x + 23, BOARD.y)).toEqual({ kind: 'tap', x: BOARD.x + 23, y: BOARD.y });
    });

    it('follows only the first finger', () => {
        const f = new Flow();
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT);
        expect(f.pointerDown(2, 100, 400, PORTRAIT)).toEqual({ kind: 'none' });
        expect(f.pointerUp(2, 100, 400)).toEqual({ kind: 'none' });
        expect(f.pointerUp(1, BOARD.x, BOARD.y)).toEqual({ kind: 'tap', x: BOARD.x, y: BOARD.y });
    });

    it('a press that starts on a button is that button\'s action and its release does nothing', () => {
        const f = new Flow();
        expect(f.pointerDown(1, 130, 700, PORTRAIT)).toEqual({ kind: 'undo' });
        expect(f.pointerUp(1, 300, 400)).toEqual({ kind: 'none' });
        expect(f.pointerDown(2, 350, 700, PORTRAIT)).toEqual({ kind: 'quit' });
        expect(f.pointerUp(2, 350, 700)).toEqual({ kind: 'none' });
    });

    it('uses the buttons of the layout it is given', () => {
        const f = new Flow();
        expect(f.pointerDown(1, 820, 220, LANDSCAPE)).toEqual({ kind: 'undo' });
        f.pointerUp(1, 820, 220);
        expect(f.pointerDown(1, 820, 340, LANDSCAPE)).toEqual({ kind: 'quit' });
    });

    it('does nothing for the release of an input whose press was discarded (rotation under a finger)', () => {
        const f = new Flow();
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT);
        f.discardPress();
        expect(f.pointerUp(1, BOARD.x + 50, BOARD.y)).toEqual({ kind: 'none' });
        // and the next press works normally
        f.pointerDown(3, BOARD.x, BOARD.y, PORTRAIT);
        expect(f.pointerUp(3, BOARD.x, BOARD.y)).toEqual({ kind: 'tap', x: BOARD.x, y: BOARD.y });
    });

    it('discarding when nothing is pressed does not spoil the next press', () => {
        const f = new Flow();
        f.discardPress();
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT);
        expect(f.pointerUp(1, BOARD.x + 40, BOARD.y)).toEqual({ kind: 'swipe', dir: 'right' });
    });

    it('ignores the release of a pointer it never saw press', () => {
        const f = new Flow();
        expect(f.pointerUp(9, 10, 10)).toEqual({ kind: 'none' });
    });

    it('can be freed from a pointer whose release was never reported', () => {
        const f = new Flow();
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT);
        expect(f.activePointerId).toBe(1);
        f.releasePointer();
        expect(f.activePointerId).toBeNull();
        expect(f.pointerDown(2, BOARD.x, BOARD.y, PORTRAIT)).toEqual({ kind: 'none' });
        expect(f.pointerUp(2, BOARD.x, BOARD.y)).toEqual({ kind: 'tap', x: BOARD.x, y: BOARD.y });
    });

    it('treats a new press by the finger already followed as a new press (the old release was lost)', () => {
        const f = new Flow();
        f.pointerDown(1, 100, 300, PORTRAIT);
        // no release for the first press; the same finger presses again somewhere else
        expect(f.pointerDown(1, 300, 400, PORTRAIT)).toEqual({ kind: 'none' });
        expect(f.pointerUp(1, 302, 401)).toEqual({ kind: 'tap', x: 302, y: 401 }); // measured from (300, 400)
    });

    it('a new press by the followed finger on a button acts as that button', () => {
        const f = new Flow();
        f.pointerDown(1, 100, 300, PORTRAIT);
        expect(f.pointerDown(1, 130, 700, PORTRAIT)).toEqual({ kind: 'undo' });
    });

    it('still ignores a different finger while one is followed', () => {
        const f = new Flow();
        f.pointerDown(1, 100, 300, PORTRAIT);
        expect(f.pointerDown(2, 130, 700, PORTRAIT)).toEqual({ kind: 'none' });
        expect(f.activePointerId).toBe(1);
    });

    it('lets go of a followed finger that is no longer down when a different finger presses', () => {
        const f = new Flow();
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT); // its release never arrives (a cancelled touch)
        const stillDown = (id: number) => id !== 1;
        expect(f.pointerDown(2, 300, 400, PORTRAIT, stillDown)).toEqual({ kind: 'none' });
        expect(f.activePointerId).toBe(2);
        expect(f.pointerUp(2, 301, 400)).toEqual({ kind: 'tap', x: 301, y: 400 });
    });

    it('keeps following a finger that is still down when a different finger presses', () => {
        const f = new Flow();
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT);
        expect(f.pointerDown(2, 300, 400, PORTRAIT, () => true)).toEqual({ kind: 'none' });
        expect(f.activePointerId).toBe(1);
    });

    it('ignores presses while ending', () => {
        const f = new Flow();
        f.beginEnding(0);
        expect(f.pointerDown(1, 130, 700, PORTRAIT)).toEqual({ kind: 'none' });
        expect(f.activePointerId).toBeNull();
    });

    it('ignores a release that arrives after the run started ending', () => {
        const f = new Flow();
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT);
        f.beginEnding(0);
        expect(f.pointerUp(1, BOARD.x + 40, BOARD.y)).toEqual({ kind: 'none' });
    });
});

describe('Flow: walking', () => {
    it('hands out the first step at once and the rest one walk-step apart', () => {
        const f = new Flow(500, 70);
        f.startWalk(['up', 'left', 'left'], 1000);
        expect(f.walking).toBe(true);
        expect(f.tick(1000).walkStep).toBe('up');
        expect(f.tick(1069).walkStep).toBeNull();
        expect(f.tick(1070).walkStep).toBe('left');
        expect(f.tick(1139).walkStep).toBeNull();
        expect(f.tick(1140).walkStep).toBe('left');
        expect(f.walking).toBe(false);
        expect(f.tick(1300).walkStep).toBeNull();
    });

    it('reports the steps still to walk', () => {
        const f = new Flow(500, 70);
        f.startWalk(['up', 'right'], 0);
        f.tick(0);
        expect(f.walkRemaining).toEqual(['right']);
    });

    it('stops handing out steps after cancelWalk', () => {
        const f = new Flow(500, 70);
        f.startWalk(['up', 'up'], 0);
        f.tick(0);
        f.cancelWalk();
        expect(f.walking).toBe(false);
        expect(f.tick(70).walkStep).toBeNull();
    });

    it('discarding a press (rotation) changes neither the ending deadline nor the walk', () => {
        const f = new Flow(500, 70);
        f.startWalk(['up', 'left'], 0);
        f.tick(0);
        f.pointerDown(1, BOARD.x, BOARD.y, PORTRAIT);
        f.discardPress();
        expect(f.walkRemaining).toEqual(['left']);
        expect(f.tick(70).walkStep).toBe('left');
        f.beginEnding(100);
        f.discardPress();
        expect(f.tick(599).ended).toBe(false);
        expect(f.tick(600).ended).toBe(true);
    });

    it('does not consume the caller\'s path array', () => {
        const f = new Flow(500, 70);
        const path: ('up' | 'left')[] = ['up', 'left'];
        f.startWalk(path, 0);
        f.tick(0);
        expect(path).toEqual(['up', 'left']);
    });

    it('a new walk replaces the old one and starts immediately', () => {
        const f = new Flow(500, 70);
        f.startWalk(['up', 'up', 'up'], 0);
        f.tick(0);
        f.startWalk(['left'], 30);
        expect(f.tick(30).walkStep).toBe('left');
    });
});

describe('Flow: ending', () => {
    it('is playing at first', () => {
        expect(new Flow().phase).toBe('playing');
    });

    it('reports the end once, exactly when the wait is over', () => {
        const f = new Flow(500, 70);
        f.beginEnding(2000);
        expect(f.phase).toBe('ending');
        expect(f.tick(2499).ended).toBe(false);
        expect(f.tick(2500).ended).toBe(true);
        expect(f.tick(2600).ended).toBe(false);
    });

    it('keeps the first deadline when ending is begun again', () => {
        const f = new Flow(500, 70);
        f.beginEnding(2000);
        f.beginEnding(2300);
        expect(f.tick(2500).ended).toBe(true);
    });

    it('stops walking and hands out no steps while ending', () => {
        const f = new Flow(500, 70);
        f.startWalk(['up', 'up'], 0);
        f.beginEnding(10);
        expect(f.walking).toBe(false);
        expect(f.tick(100).walkStep).toBeNull();
    });
});

describe('Flow: idle ticks', () => {
    it('hands out one shared "nothing due" answer while playing and idle', () => {
        const f = new Flow(500, 70);
        const a = f.tick(0);
        const b = f.tick(16);
        expect(a).toBe(b);
        expect(a).toEqual({ walkStep: null, ended: false });
    });

    it('hands out the shared answer while waiting to end, and fresh objects for real events', () => {
        const f = new Flow(500, 70);
        f.beginEnding(0);
        expect(f.tick(100)).toBe(f.tick(200));
        const ended = f.tick(500);
        expect(ended).toEqual({ walkStep: null, ended: true });
        expect(f.tick(600)).not.toBe(ended);
    });
});

describe('guardOpen', () => {
    it('is closed for 400 ms after entering and open from then on', () => {
        expect(guardOpen(1000, 1000)).toBe(false);
        expect(guardOpen(1000, 1399)).toBe(false);
        expect(guardOpen(1000, 1400)).toBe(true);
        expect(guardOpen(1000, 5000)).toBe(true);
    });

    it('takes the guard time as an argument', () => {
        expect(guardOpen(0, 99, 100)).toBe(false);
        expect(guardOpen(0, 100, 100)).toBe(true);
    });
});

describe('QuitConfirm', () => {
    it('the first press only arms, it does not confirm', () => {
        const q = new QuitConfirm(2000);
        expect(q.armed(0)).toBe(false);
        expect(q.press(0)).toBe(false);
        expect(q.armed(0)).toBe(true);
    });

    it('a second press within the window confirms', () => {
        const q = new QuitConfirm(2000);
        q.press(1000);
        expect(q.press(1500)).toBe(true);
    });

    it('a second press exactly at the end of the window (2000 ms) still confirms', () => {
        const q = new QuitConfirm(2000);
        q.press(1000);
        expect(q.press(3000)).toBe(true);
    });

    it('a second press 2001 ms later is a new first press', () => {
        const q = new QuitConfirm(2000);
        q.press(1000);
        expect(q.press(3001)).toBe(false);
        expect(q.armed(3001)).toBe(true);
        expect(q.press(3500)).toBe(true);
    });

    it('is no longer armed once the window has passed', () => {
        const q = new QuitConfirm(2000);
        q.press(0);
        expect(q.armed(2000)).toBe(true);
        expect(q.armed(2001)).toBe(false);
    });

    it('confirming disarms it: the next press arms again', () => {
        const q = new QuitConfirm(2000);
        q.press(0);
        q.press(100);
        expect(q.armed(100)).toBe(false);
        expect(q.press(200)).toBe(false);
    });

    it('reset disarms it', () => {
        const q = new QuitConfirm(2000);
        q.press(0);
        q.reset();
        expect(q.armed(10)).toBe(false);
        expect(q.press(20)).toBe(false);
    });

    it('uses 2000 ms by default', () => {
        const q = new QuitConfirm();
        q.press(0);
        expect(q.armed(2000)).toBe(true);
        expect(q.armed(2001)).toBe(false);
    });
});
