import { describe, expect, it } from 'vitest';
import { BOMB_RADIUS, LINE_MIN, RAINBOW_MIN } from '../params';
import {
    RAINBOW,
    type Board,
    type Kind,
    type Kinds,
    findMatches,
    findMove,
    hasMove,
    normalKinds,
    shuffleBoard,
} from './board';
import { applyFalls, findRuns, gemKey, planClear } from './special';
import { pos, seeded, stamp, uniqueBoard } from './testing';

/** A fresh 8 x 8 board of unique stones (no match) and all-normal kinds, ready to stamp. */
const fresh = (): { board: Board; kinds: Kinds } => ({ board: uniqueBoard(8, 8), kinds: normalKinds(8, 8) });

const cells = (...rc: [number, number][]) => rc.map(([r, c]) => pos(r, c));
/** The row-major list `[r, c]` of a plan's cleared stones, for readable comparisons. */
const rc = (p: { cleared: { r: number; c: number }[] }) => p.cleared.map((q) => [q.r, q.c]);

describe('findRuns (docs/spec.md "そろい")', () => {
    it('lists horizontal runs first (top row first), then vertical runs (left column first)', () => {
        const { board } = fresh();
        stamp(board, 1, [[2, 0], [2, 1], [2, 2], [3, 5], [4, 5], [5, 5], [5, 6], [5, 7]]);
        const runs = findRuns(board);
        expect(runs.map((r) => [r.dir, r.color, r.cells.length])).toEqual([
            ['h', 1, 3],
            ['h', 1, 3],
            ['v', 1, 3],
        ]);
        expect(runs[2].cells).toEqual(cells([3, 5], [4, 5], [5, 5]));
    });

    it('ignores two in a row, empty cells and colour stones even when three of them stand together', () => {
        const { board } = fresh();
        stamp(board, 1, [[0, 0], [0, 1]]);
        stamp(board, RAINBOW, [[1, 0], [1, 1], [1, 2]]);
        stamp(board, 2, [[2, 3], [2, 4]]);
        board[2][5] = null;
        board[3][3] = null;
        board[4][3] = null;
        board[5][3] = null;
        expect(findRuns(board)).toEqual([]);
    });

    it('agrees with findMatches on which cells are in a run', () => {
        for (let seed = 1; seed <= 40; seed++) {
            const rng = seeded(seed);
            const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => Math.floor(rng() * 3)));
            const fromRuns = new Set(findRuns(board).flatMap((r) => r.cells.map((p) => p.r * 8 + p.c)));
            expect([...fromRuns].sort((a, b) => a - b)).toEqual(findMatches(board).map((p) => p.r * 8 + p.c));
        }
    });
});

describe('planClear: which special stone a group leaves (docs/spec/special-gems.md "消去の決め方")', () => {
    it('leaves a column line stone for 4 in a row, at the swapped cell in the run', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[5, 2], [5, 3], [5, 4], [5, 5]]);
        const plan = planClear(board, kinds, cells([4, 4], [5, 4])) as NonNullable<ReturnType<typeof planClear>>;
        expect(plan.spawned).toEqual([{ r: 5, c: 4, color: 9, kind: 'lineCol' }]);
        expect(rc(plan)).toEqual([[5, 2], [5, 3], [5, 5]]);
        expect(plan.count).toBe(4);
    });

    it('takes the first given swapped cell that is in the run, whichever order they come in', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[5, 2], [5, 3], [5, 4], [5, 5]]);
        const plan = planClear(board, kinds, cells([5, 3], [5, 4]));
        expect(plan?.spawned).toEqual([{ r: 5, c: 3, color: 9, kind: 'lineCol' }]);
        const other = planClear(board, kinds, cells([5, 4], [5, 3]));
        expect(other?.spawned).toEqual([{ r: 5, c: 4, color: 9, kind: 'lineCol' }]);
    });

    it('puts a chained 4 on the second cell of the run (index floor((4 - 1) / 2) = 1)', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[5, 2], [5, 3], [5, 4], [5, 5]]);
        expect(planClear(board, kinds, [])?.spawned).toEqual([{ r: 5, c: 3, color: 9, kind: 'lineCol' }]);
    });

    it('leaves a row line stone for 4 in a column', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[1, 3], [2, 3], [3, 3], [4, 3]]);
        const plan = planClear(board, kinds, []);
        expect(plan?.spawned).toEqual([{ r: 2, c: 3, color: 9, kind: 'lineRow' }]);
        expect(plan?.count).toBe(4);
    });

    it('leaves a colour stone for 5 in a row at the swapped cell: 5 stones count, 90 points worth', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4]]);
        const plan = planClear(board, kinds, cells([6, 4], [5, 4]));
        expect(plan?.spawned).toEqual([{ r: 6, c: 4, color: RAINBOW, kind: 'rainbow' }]);
        expect(plan?.count).toBe(5);
        expect(plan?.cleared).toHaveLength(4);
    });

    it('puts a chained 6 on the third cell (index floor((6 - 1) / 2) = 2)', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5]]);
        expect(planClear(board, kinds, [])?.spawned).toEqual([{ r: 6, c: 2, color: RAINBOW, kind: 'rainbow' }]);
    });

    it('leaves a bomb at the crossing of an L, even when the swapped stone is at the end of an arm', () => {
        const { board, kinds } = fresh();
        stamp(board, 7, [[3, 2], [3, 3], [3, 4], [4, 2], [5, 2]]);
        const plan = planClear(board, kinds, cells([3, 4], [2, 4]));
        expect(plan?.spawned).toEqual([{ r: 3, c: 2, color: 7, kind: 'bomb' }]);
        expect(plan?.count).toBe(5);
        expect(plan?.cleared).toHaveLength(4);
    });

    it('leaves a bomb at the swapped cell when it is the crossing of a T', () => {
        const { board, kinds } = fresh();
        stamp(board, 7, [[3, 2], [3, 3], [3, 4], [4, 3], [5, 3]]);
        expect(planClear(board, kinds, cells([3, 3], [2, 3]))?.spawned).toEqual([
            { r: 3, c: 3, color: 7, kind: 'bomb' },
        ]);
    });

    it('leaves a bomb for a plus, at its centre', () => {
        const { board, kinds } = fresh();
        stamp(board, 7, [[3, 3], [3, 2], [3, 4], [2, 3], [4, 3]]);
        const plan = planClear(board, kinds, []);
        expect(plan?.spawned).toEqual([{ r: 3, c: 3, color: 7, kind: 'bomb' }]);
        expect(plan?.count).toBe(5);
    });

    it('chooses the upper-left crossing when two runs cross twice', () => {
        // Two horizontal 3-runs joined by two vertical 3-runs in a 3 x 3 frame: crossings at the four corners.
        const { board, kinds } = fresh();
        stamp(board, 7, [[1, 1], [1, 2], [1, 3], [3, 1], [3, 2], [3, 3], [2, 1], [2, 3]]);
        expect(planClear(board, kinds, [])?.spawned).toEqual([{ r: 1, c: 1, color: 7, kind: 'bomb' }]);
    });

    it('prefers a colour stone over a bomb when a run of 5 crosses a run of 3', () => {
        const { board, kinds } = fresh();
        stamp(board, 7, [[3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 3], [5, 3]]);
        const plan = planClear(board, kinds, []);
        expect(plan?.spawned).toEqual([{ r: 3, c: 3, color: RAINBOW, kind: 'rainbow' }]);
        expect(plan?.count).toBe(7);
    });

    it('prefers a bomb over a line stone when a run of 4 crosses a run of 3', () => {
        const { board, kinds } = fresh();
        stamp(board, 7, [[3, 1], [3, 2], [3, 3], [3, 4], [4, 3], [5, 3]]);
        expect(planClear(board, kinds, [])?.spawned).toEqual([{ r: 3, c: 3, color: 7, kind: 'bomb' }]);
    });

    it('leaves nothing for a plain 3 in a row', () => {
        const { board, kinds } = fresh();
        stamp(board, 7, [[3, 1], [3, 2], [3, 3]]);
        const plan = planClear(board, kinds, cells([3, 1], [2, 1]));
        expect(plan?.spawned).toEqual([]);
        expect(plan?.count).toBe(3);
        expect(plan?.cleared).toHaveLength(3);
    });

    it('treats two separate groups on their own: a 4 and a 3 of other colours leave one line stone', () => {
        const { board, kinds } = fresh();
        stamp(board, 7, [[1, 0], [1, 1], [1, 2], [1, 3]]);
        stamp(board, 8, [[6, 5], [6, 6], [6, 7]]);
        const plan = planClear(board, kinds, []);
        expect(plan?.spawned).toHaveLength(1);
        expect(plan?.count).toBe(7);
        expect(plan?.cleared).toHaveLength(6);
    });

    it('judges two separate runs of the same colour as two groups: each leaves its own line stone', () => {
        const { board, kinds } = fresh();
        stamp(board, 7, [[1, 0], [1, 1], [1, 2], [1, 3]]);
        stamp(board, 7, [[5, 3], [5, 4], [5, 5], [5, 6]]);
        const plan = planClear(board, kinds, []);
        expect(plan?.spawned).toEqual([
            { r: 1, c: 1, color: 7, kind: 'lineCol' },
            { r: 5, c: 4, color: 7, kind: 'lineCol' },
        ]);
        expect(plan?.count).toBe(8);
    });

    it('leaves no colour stone for 5 in a row when a line stone stands where it would be made: that stone goes off', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4]]);
        kinds[6][4] = 'lineCol';
        const plan = planClear(board, kinds, cells([6, 4], [5, 4]));
        expect(plan?.spawned).toEqual([]);
        expect(plan?.count).toBe(12); // the 5 plus the 7 other stones of column 4
        expect(plan?.cleared.filter((p) => p.c === 4)).toHaveLength(8);
    });

    it('leaves nothing where a special stone already stands: it goes off instead', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[5, 2], [5, 3], [5, 4], [5, 5]]);
        kinds[5][4] = 'lineRow';
        const plan = planClear(board, kinds, cells([5, 4], [4, 4]));
        expect(plan?.spawned).toEqual([]);
        expect(plan?.cleared).toHaveLength(8); // the whole row 5
        expect(plan?.cleared.every((p) => p.r === 5)).toBe(true);
        expect(plan?.count).toBe(8);
    });

    it('returns null when nothing clears', () => {
        const { board, kinds } = fresh();
        expect(planClear(board, kinds, [])).toBeNull();
        expect(planClear(board, kinds, cells([0, 0], [0, 1]))).toBeNull();
    });
});

describe('planClear: effects of special stones (docs/spec/special-gems.md "効果の展開")', () => {
    it('a column line stone in a row of 3 clears its column: 10 stones, worth (100 + 140) = 240', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[2, 3], [2, 4], [2, 5]]);
        kinds[2][3] = 'lineCol';
        const plan = planClear(board, kinds, []);
        expect(plan?.count).toBe(10);
        expect(plan?.cleared).toHaveLength(10);
        expect(plan?.spawned).toEqual([]);
        const colThree = plan?.cleared.filter((p) => p.c === 3) ?? [];
        expect(colThree.map((p) => p.r)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('a row line stone in a column of 3 clears its row: 10 stones', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[3, 0], [4, 0], [5, 0]]);
        kinds[4][0] = 'lineRow';
        const plan = planClear(board, kinds, []);
        expect(plan?.count).toBe(10);
        expect(plan?.cleared.filter((p) => p.r === 4)).toHaveLength(8);
    });

    it('a bomb in the corner clears the 2 x 2 that is on the board plus the rest of its run: 5 stones', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[0, 0], [1, 0], [2, 0]]);
        kinds[0][0] = 'bomb';
        const plan = planClear(board, kinds, []);
        expect(rc(plan as { cleared: { r: number; c: number }[] })).toEqual([[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]]);
        expect(plan?.count).toBe(5);
    });

    it('a bomb in the middle clears the 3 x 3 around it (radius BOMB_RADIUS)', () => {
        expect(BOMB_RADIUS).toBe(1);
        const { board, kinds } = fresh();
        stamp(board, 9, [[3, 3], [3, 4], [3, 5]]);
        kinds[3][4] = 'bomb';
        const plan = planClear(board, kinds, []);
        // 3 x 3 around (3,4) = rows 2..4, cols 3..5 (9 cells) which already holds the run.
        expect(plan?.count).toBe(9);
        expect(plan?.cleared.every((p) => p.r >= 2 && p.r <= 4 && p.c >= 3 && p.c <= 5)).toBe(true);
    });

    it('sets off a bomb that a line stone reaches, in the same clear: 16 stones, worth (160 + 260) = 420', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[2, 3], [2, 4], [2, 5]]);
        kinds[2][3] = 'lineCol';
        kinds[6][3] = 'bomb';
        const plan = planClear(board, kinds, []);
        expect(plan?.count).toBe(16);
        expect(plan?.cleared.filter((p) => p.c === 2).map((p) => p.r)).toEqual([5, 6, 7]);
        expect(plan?.cleared.filter((p) => p.c === 4).map((p) => p.r)).toEqual([2, 5, 6, 7]);
    });

    it('removes a colour stone caught in a blast, and only it', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[1, 0], [2, 0], [3, 0]]);
        kinds[2][0] = 'lineRow';
        board[2][5] = RAINBOW;
        kinds[2][5] = 'rainbow';
        const plan = planClear(board, kinds, []);
        expect(plan?.count).toBe(10); // row 2 (8, the colour stone among them) + (1,0) + (3,0)
        expect(plan?.cleared.some((p) => p.r === 2 && p.c === 5)).toBe(true);
    });

    it('does not remove a stone that is about to become a special stone, and does not set it off', () => {
        const { board, kinds } = fresh();
        // Group A: a 4 in row 5 (cols 1..4), swapped cell (5,1) becomes a line stone.
        stamp(board, 9, [[5, 1], [5, 2], [5, 3], [5, 4]]);
        // Group B: a 3 in column 0 (rows 5..7) holding a bomb at (6,0); its 3 x 3 reaches (5,1).
        stamp(board, 8, [[5, 0], [6, 0], [7, 0]]);
        kinds[6][0] = 'bomb';
        const plan = planClear(board, kinds, cells([5, 1], [4, 1]));
        expect(plan?.spawned).toEqual([{ r: 5, c: 1, color: 9, kind: 'lineCol' }]);
        expect(plan?.cleared.some((p) => p.r === 5 && p.c === 1)).toBe(false);
        expect(plan?.cleared).toHaveLength(8);
        expect(plan?.count).toBe(9);
    });

    it('counts a stone reached twice only once', () => {
        const { board, kinds } = fresh();
        stamp(board, 9, [[2, 3], [2, 4], [2, 5]]);
        kinds[2][3] = 'lineCol';
        kinds[2][4] = 'lineRow'; // its row 2 is already part of the clear
        const plan = planClear(board, kinds, []);
        const keys = (plan?.cleared ?? []).map((p) => p.r * 8 + p.c);
        expect(new Set(keys).size).toBe(keys.length);
        expect(plan?.count).toBe(15); // column 3 (8) + row 2 (8) share (2,3)
    });
});

describe('planClear: a colour stone swapped with a neighbour (docs/spec/special-gems.md "交換")', () => {
    const nineOfColor = (board: Board) => stamp(board, 2, [[0, 0], [1, 3], [2, 6], [3, 1], [4, 4], [5, 7], [6, 2], [7, 5], [7, 0]]);

    it('removes every stone of the partner colour and the colour stone itself: 10 stones, worth 240', () => {
        const { board, kinds } = fresh();
        nineOfColor(board);
        board[4][5] = RAINBOW; // the colour stone, after the swap with the colour-2 stone now at (4,4)
        kinds[4][5] = 'rainbow';
        const plan = planClear(board, kinds, cells([4, 4], [4, 5]));
        expect(plan?.count).toBe(10);
        expect(plan?.cleared).toHaveLength(10);
        expect(plan?.cleared.some((p) => p.r === 4 && p.c === 5)).toBe(true);
        expect(plan?.cleared.every((p) => board[p.r][p.c] === 2 || board[p.r][p.c] === RAINBOW)).toBe(true);
    });

    it('removes only the partner and itself when the partner is the only stone of its colour: 2 stones', () => {
        const { board, kinds } = fresh();
        board[4][5] = RAINBOW;
        kinds[4][5] = 'rainbow';
        expect(planClear(board, kinds, cells([4, 4], [4, 5]))?.count).toBe(2);
    });

    it('also sets off a line stone partner: the colour, its column and the colour stone make 9 stones', () => {
        const { board, kinds } = fresh();
        board[4][4] = 2;
        kinds[4][4] = 'lineCol';
        board[4][5] = RAINBOW;
        kinds[4][5] = 'rainbow';
        const plan = planClear(board, kinds, cells([4, 5], [4, 4]));
        expect(plan?.count).toBe(9); // column 4 (8) + the colour stone at (4,5)
    });

    it('removes just the two stones when two colour stones are swapped', () => {
        const { board, kinds } = fresh();
        board[4][4] = RAINBOW;
        board[4][5] = RAINBOW;
        kinds[4][4] = 'rainbow';
        kinds[4][5] = 'rainbow';
        const plan = planClear(board, kinds, cells([4, 4], [4, 5]));
        expect(plan?.count).toBe(2);
        expect(rc(plan as { cleared: { r: number; c: number }[] })).toEqual([[4, 4], [4, 5]]);
    });

    it('leaves a third colour stone elsewhere on the board alone when two colour stones are swapped', () => {
        const { board, kinds } = fresh();
        for (const [r, c] of [[4, 4], [4, 5], [0, 0]]) {
            board[r][c] = RAINBOW;
            kinds[r][c] = 'rainbow';
        }
        const plan = planClear(board, kinds, cells([4, 4], [4, 5]));
        expect(plan?.count).toBe(2);
        expect(plan?.cleared.some((p) => p.r === 0 && p.c === 0)).toBe(false);
    });

    it('joins the colour sweep with a run the swap made: the new line stone stays, the others go', () => {
        const { board, kinds } = fresh();
        // The partner (colour 2) moved up to (3,4) and completes row 3 cols 1..4; the colour stone is now at (4,4).
        stamp(board, 2, [[3, 1], [3, 2], [3, 3], [3, 4], [7, 7]]);
        board[4][4] = RAINBOW;
        kinds[4][4] = 'rainbow';
        const plan = planClear(board, kinds, cells([4, 4], [3, 4]));
        expect(plan?.spawned).toEqual([{ r: 3, c: 4, color: 2, kind: 'lineCol' }]);
        expect(plan?.count).toBe(6); // the 4-run + (7,7) + the colour stone
        expect(plan?.cleared).toHaveLength(5);
        expect(plan?.cleared.some((p) => p.r === 3 && p.c === 4)).toBe(false);
    });
});

describe('planClear against an independent oracle on random boards', () => {
    const SPECIAL: Kind[] = ['lineRow', 'lineCol', 'bomb'];

    /** The cells of every run of 3+ equal colours, found by testing every window (not by scanning runs). */
    function matchedByWindows(board: Board): Set<number> {
        const out = new Set<number>();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const v = board[r][c];
                if (v === null || v < 0) continue;
                if (c + 2 < 8 && board[r][c + 1] === v && board[r][c + 2] === v) [0, 1, 2].forEach((k) => out.add(r * 8 + c + k));
                if (r + 2 < 8 && board[r + 1][c] === v && board[r + 2][c] === v) [0, 1, 2].forEach((k) => out.add((r + k) * 8 + c));
            }
        }
        return out;
    }

    /** What a special stone at (r, c) removes, spelled out cell by cell. */
    function reachOf(kind: Kind, r: number, c: number): number[] {
        const out: number[] = [];
        for (let rr = 0; rr < 8; rr++) {
            for (let cc = 0; cc < 8; cc++) {
                if (kind === 'lineRow' && rr === r) out.push(rr * 8 + cc);
                if (kind === 'lineCol' && cc === c) out.push(rr * 8 + cc);
                if (kind === 'bomb' && Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1) out.push(rr * 8 + cc);
            }
        }
        return out;
    }

    it('removes exactly the matched cells plus the fixpoint of the special stones they set off', () => {
        const seen = { lineRow: 0, lineCol: 0, bomb: 0, rainbow: 0, chained: 0, boards: 0 };
        for (let seed = 1; seed <= 400; seed++) {
            const rng = seeded(seed);
            const board: Board = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => Math.floor(rng() * 3)));
            const kinds = normalKinds(8, 8);
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (rng() < 0.12) kinds[r][c] = SPECIAL[Math.floor(rng() * 3)];
                    else if (rng() < 0.03) {
                        board[r][c] = RAINBOW;
                        kinds[r][c] = 'rainbow';
                    }
                }
            }
            const plan = planClear(board, kinds, []);
            const matched = matchedByWindows(board);
            if (!plan) {
                if (matched.size !== 0) expect.fail(`seed ${seed}: matches exist but no plan`);
                continue;
            }
            seen.boards++;
            const spawnKeys = new Set(plan.spawned.map((s) => s.r * 8 + s.c));
            const clearedKeys = plan.cleared.map((p) => p.r * 8 + p.c);
            const all = new Set([...clearedKeys, ...spawnKeys]);

            if (new Set(clearedKeys).size !== clearedKeys.length) expect.fail(`seed ${seed}: duplicate cleared`);
            if (clearedKeys.some((k, i) => i > 0 && k < clearedKeys[i - 1])) expect.fail(`seed ${seed}: not in board order`);
            if (clearedKeys.some((k) => spawnKeys.has(k))) expect.fail(`seed ${seed}: a new special stone was cleared`);
            if (plan.count !== all.size) expect.fail(`seed ${seed}: count ${plan.count} vs ${all.size}`);

            // Oracle: start from the matched cells, keep adding what the special stones (not the new ones) reach.
            const expected = new Set(matched);
            for (let changed = true; changed; ) {
                changed = false;
                for (const k of [...expected]) {
                    const r = Math.floor(k / 8);
                    const c = k % 8;
                    if (spawnKeys.has(k)) continue;
                    for (const q of reachOf(kinds[r][c], r, c)) {
                        if (!expected.has(q)) {
                            expected.add(q);
                            changed = true;
                        }
                    }
                }
            }
            const got = [...all].sort((a, b) => a - b);
            const want = [...expected].sort((a, b) => a - b);
            if (got.join() !== want.join()) expect.fail(`seed ${seed}: cleared set differs from the oracle`);

            for (const s of plan.spawned) {
                seen[s.kind as 'lineRow' | 'lineCol' | 'bomb' | 'rainbow']++;
                if (kinds[s.r][s.c] !== 'normal') expect.fail(`seed ${seed}: spawned onto a special stone`);
                if (!matched.has(s.r * 8 + s.c)) expect.fail(`seed ${seed}: spawned outside the matched cells`);
            }
            if (expected.size > matched.size) seen.chained++;
        }
        // The loop must have met every outcome, or it proved nothing.
        expect(seen.boards).toBeGreaterThan(300);
        expect(seen.lineRow).toBeGreaterThan(0);
        expect(seen.lineCol).toBeGreaterThan(0);
        expect(seen.bomb).toBeGreaterThan(0);
        expect(seen.rainbow).toBeGreaterThan(0);
        expect(seen.chained).toBeGreaterThan(0);
    });
});

describe('applyFalls', () => {
    it('moves kinds with the stones that fell and leaves normal behind', () => {
        const kinds = normalKinds(4, 2);
        kinds[1][0] = 'bomb';
        kinds[0][0] = 'lineRow';
        applyFalls(kinds, [
            { c: 0, from: 1, to: 3 },
            { c: 0, from: 0, to: 2 },
        ]);
        expect(kinds[3][0]).toBe('bomb');
        expect(kinds[2][0]).toBe('lineRow');
        expect(kinds[1][0]).toBe('normal');
        expect(kinds[0][0]).toBe('normal');
    });
});

describe('gemKey', () => {
    it('gives each of the 25 (colour, kind) stones its own texture name', () => {
        const kinds: Kind[] = ['normal', 'lineRow', 'lineCol', 'bomb'];
        const keys = new Set<string>();
        for (let color = 0; color < 6; color++) for (const kind of kinds) keys.add(gemKey(color, kind));
        keys.add(gemKey(RAINBOW, 'rainbow'));
        expect(keys.size).toBe(25);
    });

    it('keeps the plain stone names as they were and names every colour stone alike', () => {
        expect(gemKey(3, 'normal')).toBe('gem3');
        expect(gemKey(RAINBOW, 'rainbow')).toBe(gemKey(0, 'rainbow'));
    });
});

describe('board rules with colour stones', () => {
    it('findMove counts a swap with a colour stone, in the usual scan order', () => {
        const board = uniqueBoard(8, 8);
        board[2][2] = RAINBOW;
        // Scan order is row by row, left to right, right partner before the one below: the first stone next to the
        // colour stone is (1,2) (the colour stone is its partner below), before (2,1) (partner to the right).
        expect(findMove(board)).toEqual([pos(1, 2), pos(2, 2)]);
        expect(hasMove(board)).toBe(true);
    });

    it('findMove tries the right partner of a colour stone that is the first stone before the one below it', () => {
        const board = uniqueBoard(8, 8);
        board[0][0] = RAINBOW;
        expect(findMove(board)).toEqual([pos(0, 0), pos(0, 1)]);
    });

    it('findMove pairs a colour stone in the last column and row with the stone above it (no partner to the right)', () => {
        const board = uniqueBoard(8, 8);
        board[7][7] = RAINBOW;
        // (6,7) is the first stone in scan order next to it: its partner below is the colour stone.
        expect(findMove(board)).toEqual([pos(6, 7), pos(7, 7)]);
    });

    it('a board with only a colour stone and unique stones still has a move; without it, none', () => {
        const board = uniqueBoard(8, 8);
        expect(hasMove(board)).toBe(false);
        board[7][7] = RAINBOW;
        expect(hasMove(board)).toBe(true);
    });

    it('findMatches never matches colour stones', () => {
        const board = uniqueBoard(8, 8);
        stamp(board, RAINBOW, [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]]);
        expect(findMatches(board)).toEqual([]);
    });

    it('shuffleBoard carries every kind with its stone and keeps colour-stone cells as they are paired', () => {
        const board: Board = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 2 * c) % 6));
        const kinds = normalKinds(8, 8);
        board[0][0] = RAINBOW;
        kinds[0][0] = 'rainbow';
        board[3][3] = 4;
        kinds[3][3] = 'bomb';
        const pairs = (b: Board, k: Kinds) => b.flat().map((v, i) => `${v}:${k.flat()[i]}`).sort();
        const before = pairs(board, kinds);
        expect(shuffleBoard(board, 6, seeded(3), 100, kinds)).toBe(false);
        expect(pairs(board, kinds)).toEqual(before);
        expect(findMatches(board)).toEqual([]);
    });

    it('shuffleBoard drops every special stone when it has to build the board anew', () => {
        const board = uniqueBoard(8, 8);
        const kinds = normalKinds(8, 8);
        kinds[2][2] = 'lineRow';
        kinds[5][5] = 'bomb';
        expect(shuffleBoard(board, 6, seeded(4), 3, kinds)).toBe(true);
        expect(kinds.flat().every((k) => k === 'normal')).toBe(true);
    });
});

describe('parameters of special stones', () => {
    it('a line needs one more stone than a match, a colour stone one more than a line', () => {
        expect(LINE_MIN).toBe(4);
        expect(RAINBOW_MIN).toBe(5);
    });
});
