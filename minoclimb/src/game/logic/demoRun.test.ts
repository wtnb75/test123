import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { DemoRunClock, type DemoRunEvent } from './demoRun';

const RUN = 30000;
const FADE = 400;
const HOLD = 1200;

const clock = (): DemoRunClock => new DemoRunClock(RUN, FADE, HOLD);

/** Advances to absolute time `t` in one step and returns the event. */
const at = (c: DemoRunClock, t: number, ended = false): DemoRunEvent | null => c.update(t - c.clock, ended);

describe('DemoRunClock: the timeline of a run', () => {
    it('uses the spec parameters by default', () => {
        const c = new DemoRunClock();
        expect(at(c, P.DEMO_RUN_MS - 1)).toBeNull();
        expect(at(c, P.DEMO_RUN_MS)).toEqual({ kind: 'fade-out' });
    });

    it('closes at the run length, rebuilds when the screen is black and opens a fade later', () => {
        const c = clock();
        expect(at(c, 29999)).toBeNull();
        expect(c.phase).toBe('waiting');
        expect(at(c, 30000)).toEqual({ kind: 'fade-out' });
        expect(c.phase).toBe('fading-out');
        expect(at(c, 30399)).toBeNull();
        expect(at(c, 30400)).toEqual({ kind: 'fade-in' });
        expect(c.rebuilds).toBe(1);
        expect(at(c, 30799)).toBeNull();
        expect(c.phase).toBe('fading-in');
        expect(at(c, 30800)).toBeNull();
        expect(c.phase).toBe('waiting');
        // The second run's curtain closes a run length after the curtain was fully open.
        expect(at(c, 60799)).toBeNull();
        expect(at(c, 60800)).toEqual({ kind: 'fade-out' });
    });

    it('has the opacity 1 while waiting, 1 -> 0 while closing and 0 -> 1 while opening', () => {
        const c = clock();
        expect(c.opacity()).toBe(1);
        at(c, 30000);
        expect(c.opacity()).toBe(1);
        at(c, 30200);
        expect(c.opacity()).toBeCloseTo(0.5, 9);
        at(c, 30400);
        expect(c.opacity()).toBe(0);
        at(c, 30600);
        expect(c.opacity()).toBeCloseTo(0.5, 9);
        at(c, 30800);
        expect(c.opacity()).toBe(1);
    });

    it('moves at most one phase per update, even after a very long frame', () => {
        const c = clock();
        expect(c.update(100000, false)).toEqual({ kind: 'fade-out' });
        expect(c.phase).toBe('fading-out');
        expect(c.update(0, false)).toBeNull();
    });
});

describe('DemoRunClock: the round ended early', () => {
    it('closes DEMO_END_HOLD_MS after the end was seen', () => {
        const c = clock();
        expect(at(c, 4999)).toBeNull();
        expect(at(c, 5000, true)).toBeNull(); // seen at 5000
        expect(at(c, 6199, true)).toBeNull();
        expect(at(c, 6200, true)).toEqual({ kind: 'fade-out' });
    });

    it('does not wait past the run length', () => {
        const c = clock();
        expect(at(c, 29500, true)).toBeNull(); // 29500 + 1200 would be 30700
        expect(at(c, 29999, true)).toBeNull();
        expect(at(c, 30000, true)).toEqual({ kind: 'fade-out' });
    });

    it('does not restart the hold while the curtain is already closing', () => {
        const c = clock();
        at(c, 30000);
        expect(at(c, 30100, true)).toBeNull();
        expect(at(c, 30400, true)).toEqual({ kind: 'fade-in' });
    });

    it('forgets the end after a rebuild: the next run is judged on its own', () => {
        const c = clock();
        at(c, 5000, true);
        at(c, 6200, true);
        at(c, 6600, true); // fade-in: rebuilt
        at(c, 7000, false); // open
        expect(c.phase).toBe('waiting');
        expect(at(c, 7000 + 29999, false)).toBeNull();
        expect(at(c, 7000 + 30000, false)).toEqual({ kind: 'fade-out' });
    });
});

describe('DemoRunClock: starting the game', () => {
    it('accepts only the first start request', () => {
        const c = clock();
        expect(c.leaving).toBe(false);
        expect(c.requestStart()).toBe(true);
        expect(c.leaving).toBe(true);
        expect(c.requestStart()).toBe(false);
    });

    it('stops the clock and gives no more events once a start was accepted', () => {
        const c = clock();
        at(c, 1000);
        c.requestStart();
        expect(c.update(100000, true)).toBeNull();
        expect(c.clock).toBe(1000);
    });

    it('treats a negative delta as zero', () => {
        const c = clock();
        c.update(500, false);
        c.update(-300, false);
        expect(c.clock).toBe(500);
    });
});
