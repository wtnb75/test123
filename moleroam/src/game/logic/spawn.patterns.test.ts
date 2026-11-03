import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { LANDSCAPE, PORTRAIT } from './layout';
import { lineCandidates, pickComboPattern, planSpawn, rollDecoys, type SpawnPlan } from './spawn';

// docs/spec/combo-patterns.md: the combo shapes (cluster, line, surround). Expected values are worked by hand
// from the spec; the board is 8 x 6 (hole = row * 8 + col) unless a test says portrait (6 x 8).

/** A rand() that returns the given values in order and fails if asked for more; `calls` counts the draws. */
const seq = (values: number[]): { rand: () => number; calls: () => number } => {
    let i = 0;
    return {
        rand: () => {
            if (i >= values.length) throw new Error(`rand() called more than ${values.length} times`);
            return values[i++];
        },
        calls: () => i,
    };
};

const holesOf = (plan: SpawnPlan[]): number[] => plan.map((p) => p.hole);
const kindsOf = (plan: SpawnPlan[]): string[] => plan.map((p) => p.kind);
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

const COMBO = 0.1; // under comboRate (0.2): a combo
const CLUSTER = 0; // pattern draws (equal weights 1:1:1): [0, 1/3) cluster, [1/3, 2/3) line, [2/3, 1) surround
const LINE = 0.5;
const SURROUND = 0.9;

describe('pickComboPattern (equal weights: r * 3 against 1 and 2)', () => {
    it('picks cluster up to just under a third', () => {
        expect(pickComboPattern(0)).toBe('cluster');
        expect(pickComboPattern(0.3333)).toBe('cluster'); // 0.9999 < 1
    });

    it('picks line from a third up to just under two thirds', () => {
        expect(pickComboPattern(0.3334)).toBe('line'); // 1.0002
        expect(pickComboPattern(0.6666)).toBe('line'); // 1.9998
    });

    it('picks surround from two thirds up', () => {
        expect(pickComboPattern(0.6667)).toBe('surround'); // 2.0001
        expect(pickComboPattern(0.9999)).toBe('surround');
    });

    it('follows the weights in PARAMS: with 2:1:1, 0.4999 is cluster, 0.5 is line and 0.75 is surround', () => {
        const params = PARAMS as unknown as Record<string, number>;
        const saved = [params.comboWeightCluster, params.comboWeightLine, params.comboWeightSurround];
        try {
            params.comboWeightCluster = 2;
            expect(pickComboPattern(0.4999)).toBe('cluster'); // 1.9996 < 2
            expect(pickComboPattern(0.5)).toBe('line'); // 2 is not below 2; below 3
            expect(pickComboPattern(0.7499)).toBe('line'); // 2.9996 < 3
            expect(pickComboPattern(0.75)).toBe('surround'); // 3 is not below 3
        } finally {
            [params.comboWeightCluster, params.comboWeightLine, params.comboWeightSurround] = saved;
        }
    });
});

describe('lineCandidates on an empty board', () => {
    it('counts 116 runs on the landscape board: right 36, down 32, down-right 24, down-left 24', () => {
        expect(lineCandidates(range(48), LANDSCAPE)).toHaveLength(116);
    });

    it('counts 116 runs on the portrait board: right 32, down 36, down-right 24, down-left 24', () => {
        expect(lineCandidates(range(48), PORTRAIT)).toHaveLength(116);
    });

    it('orders runs by start hole, then right, down, down-right, down-left', () => {
        const runs = lineCandidates(range(48), LANDSCAPE);
        // start 0: right, down, down-right (down-left would leave the board); start 1: right, down, down-right
        expect(runs.slice(0, 6)).toEqual([
            [0, 1, 2],
            [0, 8, 16],
            [0, 9, 18],
            [1, 2, 3],
            [1, 9, 17],
            [1, 10, 19],
        ]);
    });

    it('includes the down-left run from start 2 (2, 9, 16) and from start 7 (7, 14, 21)', () => {
        const runs = lineCandidates(range(48), LANDSCAPE).map((r) => r.join());
        expect(runs).toContain('2,9,16');
        expect(runs).toContain('7,14,21');
    });

    it('does not wrap a run across rows: 6-7-8 (right) and 8-15-22 (down-left) are not runs', () => {
        const runs = lineCandidates(range(48), LANDSCAPE).map((r) => r.join());
        expect(runs).toContain('5,6,7');
        expect(runs).not.toContain('6,7,8');
        expect(runs).not.toContain('8,15,22');
        expect(runs.some((r) => r.startsWith('40,'))).toBe(true); // start 40 only runs right (40, 41, 42)
        expect(runs).not.toContain('40,48,56'); // down from the last row leaves the board
    });

    it('never makes a run that is not three holes in one straight, board-aligned step', () => {
        for (const layout of [LANDSCAPE, PORTRAIT]) {
            for (const run of lineCandidates(range(layout.cols * layout.rows), layout)) {
                const [a, b, c] = run.map((h) => ({ col: h % layout.cols, row: Math.floor(h / layout.cols) }));
                const dc = b.col - a.col;
                const dr = b.row - a.row;
                const ok = Math.abs(dc) <= 1 && Math.abs(dr) <= 1 && (dc !== 0 || dr !== 0);
                if (!ok || c.col - b.col !== dc || c.row - b.row !== dr) expect.fail(`not a line: ${run}`);
            }
        }
    });
});

describe('lineCandidates with holes in use', () => {
    it('drops every run that contains a used hole', () => {
        const free = range(48).filter((h) => h !== 1);
        const runs = lineCandidates(free, LANDSCAPE);
        expect(runs.every((r) => !r.includes(1))).toBe(true);
        // hole 1 (row 0, col 1) as the first hole: right (1, 2, 3), down (1, 9, 17), down-right (1, 10, 19);
        // down-left (1, 8, 15) leaves the board. As the middle: right (0, 1, 2) only. As the last: none (row 0).
        // So 4 runs are dropped
        expect(runs).toHaveLength(116 - 4);
    });

    it('finds no run when the free holes are only two', () => {
        expect(lineCandidates([0, 1], LANDSCAPE)).toEqual([]);
    });
});

describe('planSpawn: combo pattern draw', () => {
    it('draws the pattern right after the combo roll: roll, pattern, then a cluster draws anchor, neighbours and kinds', () => {
        const r = seq([COMBO, CLUSTER, 0, 0, 0.99, 0.9, 0.99, 0.99, 0.1, 0.5, 0.99, 0.99]);
        const plan = planSpawn([], r.rand);
        expect(plan).toEqual([
            { hole: 0, kind: 'mole' },
            { hole: 1, kind: 'cat' },
            { hole: 9, kind: 'mole' },
        ]);
        expect(r.calls()).toBe(12);
    });

    it('does not draw a pattern when there is no combo: a single spawn takes roll, hole, kind rolls only', () => {
        const r = seq([0.5, 0, 0.5, 0.99, 0.99]);
        expect(planSpawn([], r.rand)).toEqual([{ hole: 0, kind: 'mole' }]);
        expect(r.calls()).toBe(5);
    });

    it('does not draw a pattern when the combo roll is exactly comboRate', () => {
        const r = seq([0.2, 0, 0.5, 0.99, 0.99]);
        expect(planSpawn([], r.rand)).toHaveLength(1);
        expect(r.calls()).toBe(5);
    });

    it('does not draw a pattern when room is under comboSize, even with a combo-sized roll', () => {
        const r = seq([0, 0.5, 0.99, 0.99]); // 2 pops out: room 2, no combo roll; hole pick 0 -> 2
        expect(planSpawn([0, 1], r.rand)).toEqual([{ hole: 2, kind: 'mole' }]);
        expect(r.calls()).toBe(4);
    });
});

describe('planSpawn: line combo', () => {
    it('makes three moles on the run picked by one draw, with no kind or decoy draws', () => {
        // 116 runs: draw 0 -> the first run (0, 1, 2)
        const r = seq([COMBO, LINE, 0]);
        const plan = planSpawn([], r.rand);
        expect(plan).toEqual([
            { hole: 0, kind: 'mole' },
            { hole: 1, kind: 'mole' },
            { hole: 2, kind: 'mole' },
        ]);
        expect(r.calls()).toBe(3);
        // the decoy step draws nothing for a plan of moles (a fourth draw would throw)
        expect(rollDecoys(plan, r.rand).map((p) => p.decoy)).toEqual([false, false, false]);
        expect(r.calls()).toBe(3);
    });

    it('picks the run by floor(draw * count): 0.5 -> index 58, and a draw of 1 -> the last run', () => {
        const runs = lineCandidates(range(48), LANDSCAPE);
        expect(holesOf(planSpawn([], seq([COMBO, LINE, 0.5]).rand))).toEqual(runs[58]);
        expect(holesOf(planSpawn([], seq([COMBO, LINE, 1]).rand))).toEqual(runs[115]);
    });

    it('lists the pops from the start of the run to its end, for a down-left run', () => {
        // (2, 9, 16) is the down-left run of start 2: columns 2, 1, 0
        const runs = lineCandidates(range(48), LANDSCAPE);
        const index = runs.findIndex((r) => r.join() === '2,9,16');
        const plan = planSpawn([], seq([COMBO, LINE, (index + 0.5) / runs.length]).rand);
        expect(holesOf(plan)).toEqual([2, 9, 16]);
        expect(kindsOf(plan)).toEqual(['mole', 'mole', 'mole']);
    });

    it('never uses a used hole: every run through hole 1 is out, so draw 0 gives the first free run', () => {
        // used [1] (room 3): the first remaining run in order is start 0 down (0, 8, 16), since (0, 1, 2) has hole 1
        const plan = planSpawn([1], seq([COMBO, LINE, 0]).rand);
        expect(holesOf(plan)).toEqual([0, 8, 16]);
    });

    it('stays inside the portrait board and does not wrap: all runs are straight on 6 columns', () => {
        const runs = lineCandidates(range(48), PORTRAIT);
        const plan = planSpawn([], seq([COMBO, LINE, 0.5]).rand, PORTRAIT);
        expect(holesOf(plan)).toEqual(runs[58]);
        expect(runs.map((r) => r.join())).not.toContain('4,5,6'); // 5 -> 6 wraps to the next row on 6 columns
        expect(runs.map((r) => r.join())).toContain('3,4,5');
    });

    it('falls back to a cluster when no run is free, without drawing the pattern again', () => {
        // free holes 0 and 1 only (all others used; the cap is raised so there is room for a combo): no run of three
        const used = range(48).filter((h) => h > 1);
        const r = seq([COMBO, LINE, 0, 0.99, 0.5, 0.99, 0.99, 0.5, 0.99, 0.99]);
        // cluster draws: anchor 0 -> hole 0; near [1]: pick 0.99 -> 1; then kinds for two pops (mole, mole)
        const plan = planSpawn(used, r.rand, LANDSCAPE, 49);
        expect(holesOf(plan)).toEqual([0, 1]);
        expect(kindsOf(plan)).toEqual(['mole', 'mole']);
        expect(r.calls()).toBe(10);
    });
});

describe('planSpawn: surround combo', () => {
    it('makes a mole at the anchor and two cats on its neighbours, with no kind draws', () => {
        // anchor 0 (corner): near [1, 8, 9]: pick 0 -> 1, then near [8, 9]: pick 0.99 -> 9
        const r = seq([COMBO, SURROUND, 0, 0, 0.99]);
        const plan = planSpawn([], r.rand);
        expect(plan).toEqual([
            { hole: 0, kind: 'mole' },
            { hole: 1, kind: 'cat' },
            { hole: 9, kind: 'cat' },
        ]);
        expect(r.calls()).toBe(5);
    });

    it('picks the cats from the 8 neighbours of an inner anchor (9): 0, 1, 2, 8, 10, 16, 17, 18', () => {
        // anchor index 9 -> draw (9 + 0.5) / 48; neighbours in order [0, 1, 2, 8, 10, 16, 17, 18]
        const anchorDraw = 9.5 / 48;
        const first = planSpawn([], seq([COMBO, SURROUND, anchorDraw, 0, 0]).rand);
        expect(holesOf(first)).toEqual([9, 0, 1]);
        const last = planSpawn([], seq([COMBO, SURROUND, anchorDraw, 0.99, 0.99]).rand);
        expect(holesOf(last)).toEqual([9, 18, 17]);
    });

    it('never leaves the board from the last hole: the cats come from 38, 39 and 46 (neighbours of 47)', () => {
        const plan = planSpawn([], seq([COMBO, SURROUND, 0.999, 0, 0]).rand);
        expect(holesOf(plan)).toEqual([47, 38, 39]);
        expect(kindsOf(plan)).toEqual(['mole', 'cat', 'cat']);
    });

    it('skips neighbours that are in use', () => {
        // used [1]: free list starts at 0 (the anchor); free neighbours are 8 and 9
        const plan = planSpawn([1], seq([COMBO, SURROUND, 0, 0, 0]).rand);
        expect(holesOf(plan)).toEqual([0, 8, 9]);
    });

    it('makes one cat when only one neighbour is free', () => {
        // used: every neighbour of hole 0 but 8; the room is raised so a combo can happen
        const used = [1, 9];
        const r = seq([COMBO, SURROUND, 0, 0]);
        const plan = planSpawn(used, r.rand, LANDSCAPE, 5);
        expect(plan).toEqual([
            { hole: 0, kind: 'mole' },
            { hole: 8, kind: 'cat' },
        ]);
        expect(r.calls()).toBe(4);
    });

    it('makes the mole alone when every neighbour is in use', () => {
        const r = seq([COMBO, SURROUND, 0]);
        const plan = planSpawn([1, 8, 9], r.rand, LANDSCAPE, 6);
        expect(plan).toEqual([{ hole: 0, kind: 'mole' }]);
        expect(r.calls()).toBe(3);
    });

    it('gives each cat one decoy draw in plan order and none to the mole', () => {
        const r = seq([COMBO, SURROUND, 0, 0, 0.99, 0.3, 0.2999]);
        const plan = planSpawn([], r.rand);
        const rolled = rollDecoys(plan, r.rand);
        expect(rolled.map((p) => [p.hole, p.kind, p.decoy])).toEqual([
            [0, 'mole', false],
            [1, 'cat', false], // exactly decoyRate 0.3 is not a decoy
            [9, 'cat', true], // 0.2999 is
        ]);
        expect(r.calls()).toBe(7);
    });
});

describe('combo patterns over many seeded plans (oracle: board geometry)', () => {
    const seeded = (seed: number): (() => number) => {
        let a = seed;
        return () => {
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    it.each([
        ['landscape', LANDSCAPE],
        ['portrait', PORTRAIT],
    ])('on the %s board every combo is a cluster, a line of moles or a mole with two cats, on free holes', (_name, layout) => {
        const rand = seeded(777);
        const counts = { cluster: 0, line: 0, surround: 0 };
        for (let trial = 0; trial < 20000; trial++) {
            const used = new Set<number>();
            const usedCount = Math.floor(rand() * 4); // 0..3 out: a combo needs room 3 in the early phase
            while (used.size < usedCount) used.add(Math.floor(rand() * layout.cols * layout.rows));
            const plan = planSpawn([...used], rand, layout, 4);
            if (plan.length < 2) continue;
            const holes = holesOf(plan);
            if (new Set(holes).size !== holes.length || holes.some((h) => used.has(h))) expect.fail(`bad holes ${holes}`);
            const pos = holes.map((h) => ({ col: h % layout.cols, row: Math.floor(h / layout.cols) }));
            const near = (i: number): boolean =>
                Math.abs(pos[i].col - pos[0].col) <= 1 && Math.abs(pos[i].row - pos[0].row) <= 1;
            const step = { dc: pos[1].col - pos[0].col, dr: pos[1].row - pos[0].row };
            const straight =
                plan.length === 3 &&
                Math.abs(step.dc) <= 1 &&
                Math.abs(step.dr) <= 1 &&
                pos[2].col - pos[1].col === step.dc &&
                pos[2].row - pos[1].row === step.dr;
            const kinds = kindsOf(plan);
            if (kinds.every((k) => k === 'mole') && straight && !near(2)) {
                counts.line++;
            } else if (kinds[0] === 'mole' && kinds.slice(1).every((k) => k === 'cat')) {
                if (!pos.slice(1).every((_p, i) => near(i + 1))) expect.fail(`cats not around the mole ${holes}`);
                counts.surround++;
            } else {
                if (!pos.slice(1).every((_p, i) => near(i + 1))) expect.fail(`cluster not adjacent ${holes}`);
                counts.cluster++;
            }
        }
        // guard against a vacuous run: every shape came up
        expect(counts.cluster).toBeGreaterThan(0);
        expect(counts.line).toBeGreaterThan(0);
        expect(counts.surround).toBeGreaterThan(0);
    });
});
