import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { blockedHoles, initHoles, isUsable, nextShiftAt, stepHoles, type HoleState } from './holes';
import { LANDSCAPE, portraitLayout } from './layout';

const constant = (v: number) => () => v;

/** A small deterministic generator (mulberry32) for the seeded invariant runs. */
const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const openList = (s: HoleState): number[] => s.open.flatMap((o, i) => (o ? [i] : []));
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('initHoles', () => {
    it('closes the first 12 positions when every draw is 0 (the list head is taken each time)', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        expect(openList(s)).toEqual(range(12, 47));
        expect(s.shifts).toBe(0);
    });

    it('closes the last 12 positions when every draw is just under 1 (the list tail is taken each time)', () => {
        expect(openList(initHoles(constant(0.9999), LANDSCAPE))).toEqual(range(0, 35));
    });

    it('stays inside the board when a draw is exactly 1', () => {
        const s = initHoles(constant(1), LANDSCAPE);
        expect(s.open).toHaveLength(48);
        expect(openList(s)).toEqual(range(0, 35));
    });

    it('opens exactly openHoleCount holes in the portrait layout too', () => {
        const s = initHoles(constant(0), portraitLayout(1024));
        expect(s.open).toHaveLength(48);
        expect(openList(s)).toEqual(range(12, 47));
    });

    it('opens exactly openHoleCount holes for random draws', () => {
        const rand = seeded(7);
        for (let n = 0; n < 50; n++) {
            expect(openList(initHoles(rand, LANDSCAPE))).toHaveLength(PARAMS.openHoleCount);
        }
    });

    it('defaults to the landscape layout', () => {
        expect(initHoles(constant(0)).open).toHaveLength(48);
    });
});

describe('stepHoles timing', () => {
    it('does nothing just before the first shift time and shifts exactly at it', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        expect(nextShiftAt(s)).toBe(8000);
        expect(stepHoles(s, 7999, [], constant(0))).toBeNull();
        expect(s.shifts).toBe(0);
        expect(stepHoles(s, 8000, [], constant(0))).not.toBeNull();
        expect(s.shifts).toBe(1);
        expect(nextShiftAt(s)).toBe(16000);
    });

    it('shifts at most once per update even when two shift times have passed', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        expect(stepHoles(s, 20000, [], constant(0))).not.toBeNull(); // the 8 s one
        expect(stepHoles(s, 20000, [], constant(0))).not.toBeNull(); // the 16 s one, next update
        expect(stepHoles(s, 20000, [], constant(0))).toBeNull(); // 24 s is not yet due
        expect(s.shifts).toBe(2);
    });

    it('keeps shifting every 8 s past 60 s (time added by clocks)', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        s.shifts = 7;
        expect(stepHoles(s, 63999, [], constant(0))).toBeNull();
        expect(stepHoles(s, 64000, [], constant(0))).not.toBeNull();
    });

    it('reports the time of the shift (not the scheduled time)', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        expect(stepHoles(s, 8123, [], constant(0))?.at).toBe(8123);
    });
});

describe('stepHoles choices', () => {
    it('closes the first four holes without a pop and opens the first four closed positions (draws all 0)', () => {
        const s = initHoles(constant(0), LANDSCAPE); // open 12..47
        const shift = stepHoles(s, 8000, [], constant(0));
        expect(shift).toEqual({ at: 8000, closed: [12, 13, 14, 15], opened: [0, 1, 2, 3] });
        expect(openList(s)).toEqual([0, 1, 2, 3, ...range(16, 47)]);
        expect(openList(s)).toHaveLength(PARAMS.openHoleCount);
    });

    it('never closes a hole that has a pop', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        const shift = stepHoles(s, 8000, [12, 13], constant(0));
        expect(shift?.closed).toEqual([14, 15, 16, 17]);
        expect(s.open[12]).toBe(true);
        expect(s.open[13]).toBe(true);
    });

    it('closes the last candidates when the draws are just under 1', () => {
        const s = initHoles(constant(0), LANDSCAPE); // open 12..47
        const shift = stepHoles(s, 8000, [], constant(0.9999));
        expect(shift?.closed).toEqual([47, 46, 45, 44]);
        expect(shift?.opened).toEqual([11, 10, 9, 8]);
    });

    it('closes only as many as there are candidates and opens the same number', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        const withPops = range(12, 47).filter((h) => h !== 20 && h !== 30 && h !== 40); // 3 candidates left
        const shift = stepHoles(s, 8000, withPops, constant(0));
        expect(shift?.closed).toEqual([20, 30, 40]);
        expect(shift?.opened).toEqual([0, 1, 2]);
        expect(openList(s)).toHaveLength(PARAMS.openHoleCount);
    });

    it('closes and opens nothing, and draws nothing, when every open hole has a pop', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        let draws = 0;
        const shift = stepHoles(s, 8000, range(12, 47), () => {
            draws++;
            return 0;
        });
        expect(shift).toEqual({ at: 8000, closed: [], opened: [] });
        expect(draws).toBe(0);
        expect(s.shifts).toBe(1);
        expect(openList(s)).toEqual(range(12, 47));
    });

    it('never reopens a position closed in the same shift', () => {
        const s: HoleState = { open: new Array<boolean>(48).fill(true), lockedUntil: new Map(), shifts: 0 };
        const shift = stepHoles(s, 8000, [], constant(0));
        expect(shift?.closed).toEqual([0, 1, 2, 3]);
        expect(shift?.opened).toEqual([]);
    });

    it('draws the closing holes first and then the opening ones, one draw each, in list order', () => {
        const s = initHoles(constant(0), LANDSCAPE); // open 12..47, closed 0..11
        const values = [0, 0.9999, 0, 0.9999, 0, 0, 0, 0];
        let i = 0;
        const shift = stepHoles(s, 8000, [], () => values[i++]);
        // close: head 12, tail 47, head 13, tail 46; open: head of the closed list four times
        expect(shift?.closed).toEqual([12, 47, 13, 46]);
        expect(shift?.opened).toEqual([0, 1, 2, 3]);
        expect(i).toBe(8);
    });
});

describe('stepHoles with a closed position left over', () => {
    it('opens the other closed position, not the ones just closed', () => {
        const open = new Array<boolean>(48).fill(true);
        open[47] = false;
        const s: HoleState = { open, lockedUntil: new Map(), shifts: 0 };
        const shift = stepHoles(s, 8000, [], constant(0));
        expect(shift?.closed).toEqual([0, 1, 2, 3]);
        expect(shift?.opened).toEqual([47]);
    });
});

describe('opening holes', () => {
    it('take no pop until holeTransitionMs after the shift, and are usable exactly then', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        stepHoles(s, 8000, [], constant(0)); // opens 0..3
        expect(isUsable(s, 0, 8000)).toBe(false);
        expect(isUsable(s, 0, 8599)).toBe(false);
        expect(isUsable(s, 0, 8600)).toBe(true);
    });

    it('count as open for the hole total at once', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        stepHoles(s, 8000, [], constant(0));
        expect(s.open[0]).toBe(true);
    });

    it('measure the transition from the update the shift happened in', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        stepHoles(s, 20000, [], constant(0));
        expect(isUsable(s, 0, 20599)).toBe(false);
        expect(isUsable(s, 0, 20600)).toBe(true);
    });
});

describe('blockedHoles', () => {
    it('lists the closed positions and the opening ones, and drops an opening hole once it is usable', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        stepHoles(s, 8000, [], constant(0)); // closes 12..15, opens 0..3; closed now 4..15
        expect(blockedHoles(s, 8000)).toEqual(range(0, 15));
        expect(blockedHoles(s, 8599)).toEqual(range(0, 15));
        expect(blockedHoles(s, 8600)).toEqual(range(4, 15));
    });

    it('is the closed positions only at the start', () => {
        expect(blockedHoles(initHoles(constant(0), LANDSCAPE), 0)).toEqual(range(0, 11));
    });

    it('reports a closed or out-of-range position as not usable', () => {
        const s = initHoles(constant(0), LANDSCAPE);
        expect(isUsable(s, 0, 0)).toBe(false);
        expect(isUsable(s, 12, 0)).toBe(true);
        expect(isUsable(s, 99, 0)).toBe(false);
    });
});

describe('a whole run of shifts (seeded)', () => {
    it('keeps 36 holes open and never closes a hole that has a pop', () => {
        const rand = seeded(2024);
        const popRand = seeded(99);
        for (let run = 0; run < 40; run++) {
            const s = initHoles(rand, LANDSCAPE);
            let closedSomething = 0;
            for (let k = 1; k <= 9; k++) {
                const open = openList(s);
                const pops = open.filter(() => popRand() < 0.15);
                const shift = stepHoles(s, k * PARAMS.holeShiftIntervalMs, pops, rand);
                if (!shift) expect.fail(`no shift at k=${k}`);
                closedSomething += shift.closed.length;
                for (const h of shift.closed) if (pops.includes(h)) expect.fail(`closed a hole with a pop: ${h}`);
                if (openList(s).length !== PARAMS.openHoleCount) expect.fail(`open count ${openList(s).length}`);
                if (shift.closed.length !== shift.opened.length) expect.fail('closed and opened counts differ');
            }
            expect(closedSomething).toBeGreaterThan(0);
        }
    });
});
