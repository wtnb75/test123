import { describe, expect, it } from 'vitest';
import { blockedHoles, initHoles, stepHoles } from './holes';
import { planSpawn, stepSpawn } from './spawn';
import { LANDSCAPE } from './layout';

const seq = (values: number[]): (() => number) => {
    let i = 0;
    return () => {
        if (i >= values.length) throw new Error(`rand() called more than ${values.length} times`);
        return values[i++];
    };
};

const allBut = (keep: number[]): number[] => Array.from({ length: 48 }, (_, i) => i).filter((i) => !keep.includes(i));

describe('planSpawn with blocked holes (closed or still opening)', () => {
    it('spawns only on a hole that is not blocked', () => {
        // combo roll 0.9 (no combo), pick among one free hole (draw 0), kind draws: not cat, not clock, not golden
        const plan = planSpawn([], seq([0.9, 0, 0.9, 0.9, 0.9]), LANDSCAPE, 4, allBut([47]));
        expect(plan).toEqual([{ hole: 47, kind: 'mole' }]);
    });

    it('spawns nothing when every free hole is blocked', () => {
        expect(planSpawn([], seq([]), LANDSCAPE, 4, allBut([]))).toEqual([]);
    });

    it('does not count blocked holes against the room: the combo roll is still made with room for a combo', () => {
        // room = 4 - 0 = 4 >= comboSize, so the combo roll (0.1 < 0.2) happens; pattern draw 0.5 -> line;
        // the only free run is 5,6,7 (draw 0); a line draws no kinds
        const plan = planSpawn([], seq([0.1, 0.5, 0]), LANDSCAPE, 4, allBut([5, 6, 7]));
        expect(plan).toEqual([
            { hole: 5, kind: 'mole' },
            { hole: 6, kind: 'mole' },
            { hole: 7, kind: 'mole' },
        ]);
    });

    it('counts only the pops in use for the room', () => {
        // used 2 of 4 -> room 2 < comboSize: no combo roll at all, so the first draw is the hole pick
        const plan = planSpawn([0, 1], seq([0, 0.9, 0.9, 0.9]), LANDSCAPE, 4, allBut([0, 1, 20]));
        expect(plan).toEqual([{ hole: 20, kind: 'mole' }]);
    });

    it('does not choose a line that crosses a blocked hole', () => {
        // free: 5,6 and 8,9,10 (7 blocked); the only straight free runs of three are 8,9,10 (right)
        const plan = planSpawn([], seq([0.1, 0.5, 0]), LANDSCAPE, 4, allBut([5, 6, 8, 9, 10]));
        expect(plan.map((p) => p.hole)).toEqual([8, 9, 10]);
    });

    it('with nothing blocked picks among all the holes that are not in use (hand-worked)', () => {
        // used 1 and 8 leave room 2 (< comboSize): no combo roll. 46 free holes 0, 2, 3, ...; draw 0.5 -> index 23 -> hole 25
        const plan = planSpawn([1, 8], seq([0.5, 0.9, 0.9, 0.9]), LANDSCAPE, 4, []);
        expect(plan).toEqual([{ hole: 25, kind: 'mole' }]);
    });

    it('never picks a hole that is still opening after a real shift', () => {
        const holes = initHoles(() => 0, LANDSCAPE); // closed 0..11
        stepHoles(holes, 8000, [], () => 0); // closes 12..15, opens 0..3 (locked until 8600)
        const blocked = blockedHoles(holes, 8100); // 0..15
        // only 16 onwards are free: draw 0 -> hole 16
        const plan = planSpawn([], seq([0.9, 0, 0.9, 0.9, 0.9]), LANDSCAPE, 4, blocked);
        expect(plan).toEqual([{ hole: 16, kind: 'mole' }]);
        const later = planSpawn([], seq([0.9, 0, 0.9, 0.9, 0.9]), LANDSCAPE, 4, blockedHoles(holes, 8600));
        expect(later).toEqual([{ hole: 0, kind: 'mole' }]);
    });
});

describe('combo patterns with blocked holes', () => {
    it('cluster: only free neighbours of the anchor are chosen', () => {
        // free holes 0, 1, 9 (8 is blocked). combo roll 0.1, pattern 0 -> cluster, anchor pick 0 -> hole 0,
        // neighbours free: 1, 9 -> picks 1 then 9; three mole rolls (0.9 each: not cat, not clock, not golden)
        const plan = planSpawn([], seq([0.1, 0, 0, 0, 0, ...Array<number>(9).fill(0.9)]), LANDSCAPE, 4, allBut([0, 1, 9]));
        expect(plan.map((p) => p.hole)).toEqual([0, 1, 9]);
    });

    it('surround: fewer cats when the free neighbours run short', () => {
        // free holes 0 and 1: pattern draw 0.9 -> surround, anchor 0 (mole), the only free neighbour 1 is a cat
        const plan = planSpawn([], seq([0.1, 0.9, 0, 0]), LANDSCAPE, 4, allBut([0, 1]));
        expect(plan).toEqual([
            { hole: 0, kind: 'mole' },
            { hole: 1, kind: 'cat' },
        ]);
    });

    it('line with no free run falls back to a cluster without drawing the pattern again', () => {
        // pattern draw 0.5 -> line, but 0, 1, 9 hold no straight run of three; the cluster uses the next draws
        const plan = planSpawn([], seq([0.1, 0.5, 0, 0, 0, ...Array<number>(9).fill(0.9)]), LANDSCAPE, 4, allBut([0, 1, 9]));
        expect(plan).toEqual([
            { hole: 0, kind: 'mole' },
            { hole: 1, kind: 'mole' },
            { hole: 9, kind: 'mole' },
        ]);
    });
});

describe('stepSpawn with blocked holes', () => {
    it('hands the blocked holes to the plan when a check is due', () => {
        const r = stepSpawn(500, 500, [], seq([0.9, 0, 0.9, 0.9, 0.9]), LANDSCAPE, allBut([47]));
        expect(r.plan).toEqual([{ hole: 47, kind: 'mole' }]);
        expect(r.scheduledAt).toBe(1700);
    });
});
