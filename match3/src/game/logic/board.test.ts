import { describe, expect, it } from 'vitest';
import {
    type Board,
    type Pos,
    canSwap,
    collapse,
    createBoard,
    findMatches,
    findMove,
    hasMove,
    inBoard,
    randomColor,
    refill,
    samePos,
    shuffleBoard,
    swapCells,
    swapPartners,
} from './board';
import { pos, seeded, stamp, uniqueBoard } from './testing';

const cells = (list: [number, number][]): Pos[] => list.map(([r, c]) => ({ r, c }));

describe('findMatches (docs/spec.md "そろい")', () => {
    it('finds a horizontal run of 3', () => {
        const b = stamp(uniqueBoard(8, 8), 9, [[1, 1], [1, 2], [1, 3]]);
        expect(findMatches(b)).toEqual(cells([[1, 1], [1, 2], [1, 3]]));
    });

    it('finds a vertical run of 3', () => {
        const b = stamp(uniqueBoard(8, 8), 9, [[2, 4], [3, 4], [4, 4]]);
        expect(findMatches(b)).toEqual(cells([[2, 4], [3, 4], [4, 4]]));
    });

    it('takes every stone of a run of 4 and of 5', () => {
        const four = stamp(uniqueBoard(8, 8), 9, [[0, 0], [0, 1], [0, 2], [0, 3]]);
        expect(findMatches(four)).toHaveLength(4);
        const five = stamp(uniqueBoard(8, 8), 9, [[5, 0], [5, 1], [5, 2], [5, 3], [5, 4]]);
        expect(findMatches(five)).toHaveLength(5);
    });

    it('does not count a run of 2, nor a run broken by another colour', () => {
        const two = stamp(uniqueBoard(8, 8), 9, [[1, 1], [1, 2]]);
        expect(findMatches(two)).toEqual([]);
        const broken = stamp(uniqueBoard(8, 8), 9, [[3, 0], [3, 1], [3, 3], [3, 4]]);
        expect(findMatches(broken)).toEqual([]);
    });

    it('lists the crossing stone of an L shape once (5 stones)', () => {
        const b = stamp(uniqueBoard(8, 8), 9, [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]);
        expect(findMatches(b)).toEqual(cells([[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]));
    });

    it('lists the crossing stone of a plus shape once (5 stones)', () => {
        const b = stamp(uniqueBoard(8, 8), 9, [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]]);
        expect(findMatches(b)).toEqual(cells([[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]]));
    });

    it('finds two separate runs together (they are cleared at once)', () => {
        const b = stamp(stamp(uniqueBoard(8, 8), 9, [[0, 0], [0, 1], [0, 2]]), 8, [[6, 5], [6, 6], [6, 7]]);
        expect(findMatches(b)).toEqual(cells([[0, 0], [0, 1], [0, 2], [6, 5], [6, 6], [6, 7]]));
    });

    it('keeps two touching runs of different colours apart', () => {
        const b = stamp(stamp(uniqueBoard(8, 8), 9, [[4, 0], [4, 1], [4, 2]]), 8, [[4, 3], [4, 4], [4, 5]]);
        expect(findMatches(b)).toHaveLength(6);
    });

    it('finds runs on the board edge and in the last column and row', () => {
        const b = stamp(stamp(uniqueBoard(8, 8), 9, [[5, 7], [6, 7], [7, 7]]), 8, [[7, 0], [7, 1], [7, 2]]);
        expect(findMatches(b)).toEqual(cells([[5, 7], [6, 7], [7, 0], [7, 1], [7, 2], [7, 7]]));
    });

    it('never matches empty (null) cells, even three in a row', () => {
        const b: Board = uniqueBoard(4, 4);
        b[1][0] = b[1][1] = b[1][2] = null;
        b[0][3] = b[1][3] = b[2][3] = null;
        expect(findMatches(b)).toEqual([]);
    });

    it('agrees with a brute-force oracle on seeded random boards (and sees both outcomes)', () => {
        // Oracle: a cell matches when some window of 3 in a line holds it with all three equal and filled.
        const oracle = (b: Board): string[] => {
            const out = new Set<string>();
            const rows = b.length;
            const cols = b[0].length;
            const same = (a: Pos, c: Pos, d: Pos) =>
                b[a.r][a.c] !== null && b[a.r][a.c] === b[c.r][c.c] && b[c.r][c.c] === b[d.r][d.c];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (c + 2 < cols && same(pos(r, c), pos(r, c + 1), pos(r, c + 2))) {
                        for (let k = 0; k < 3; k++) out.add(`${r},${c + k}`);
                    }
                    if (r + 2 < rows && same(pos(r, c), pos(r + 1, c), pos(r + 2, c))) {
                        for (let k = 0; k < 3; k++) out.add(`${r + k},${c}`);
                    }
                }
            }
            return [...out].sort();
        };
        const rng = seeded(7);
        let withMatches = 0;
        let withoutMatches = 0;
        for (let n = 0; n < 300; n++) {
            const b: Board = Array.from({ length: 6 }, () =>
                Array.from({ length: 7 }, () => (rng() < 0.1 ? null : Math.floor(rng() * 4))),
            );
            const got = findMatches(b)
                .map((p) => `${p.r},${p.c}`)
                .sort();
            const want = oracle(b);
            if (got.join('|') !== want.join('|')) expect.fail(`board ${JSON.stringify(b)}: got ${got} want ${want}`);
            if (want.length > 0) withMatches++;
            else withoutMatches++;
        }
        expect(withMatches).toBeGreaterThan(50);
        expect(withoutMatches).toBeGreaterThan(0); // the boards without any match were also compared
    });
});

describe('swapPartners / canSwap (docs/spec.md "交換")', () => {
    it('lists the four neighbours of a middle stone in the order right, down, left, up', () => {
        expect(swapPartners(pos(3, 3), 8, 8)).toEqual(cells([[3, 4], [4, 3], [3, 2], [2, 3]]));
    });

    it('drops neighbours outside the board at corners', () => {
        expect(swapPartners(pos(0, 0), 8, 8)).toEqual(cells([[0, 1], [1, 0]]));
        expect(swapPartners(pos(7, 7), 8, 8)).toEqual(cells([[7, 6], [6, 7]]));
    });

    it('allows only up / down / left / right neighbours', () => {
        expect(canSwap(pos(2, 2), pos(2, 3), 8, 8)).toBe(true);
        expect(canSwap(pos(2, 2), pos(1, 2), 8, 8)).toBe(true);
        expect(canSwap(pos(2, 2), pos(3, 3), 8, 8)).toBe(false); // diagonal
        expect(canSwap(pos(2, 2), pos(2, 4), 8, 8)).toBe(false); // two apart
        expect(canSwap(pos(2, 2), pos(2, 2), 8, 8)).toBe(false); // itself
    });

    it('refuses cells off the board', () => {
        expect(canSwap(pos(0, 0), pos(0, -1), 8, 8)).toBe(false);
        expect(canSwap(pos(7, 7), pos(7, 8), 8, 8)).toBe(false);
        expect(canSwap(pos(-1, 0), pos(0, 0), 8, 8)).toBe(false);
    });

    it('helpers: inBoard and samePos', () => {
        expect(inBoard(pos(0, 0), 8, 8)).toBe(true);
        expect(inBoard(pos(8, 0), 8, 8)).toBe(false);
        expect(samePos(pos(1, 2), pos(1, 2))).toBe(true);
        expect(samePos(pos(1, 2), pos(2, 1))).toBe(false);
    });
});

describe('swapCells', () => {
    it('exchanges two stones, and doing it twice restores the board', () => {
        const b: Board = [[1, 2], [3, 4]];
        swapCells(b, pos(0, 0), pos(1, 1));
        expect(b).toEqual([[4, 2], [3, 1]]);
        swapCells(b, pos(0, 0), pos(1, 1));
        expect(b).toEqual([[1, 2], [3, 4]]);
    });
});

describe('findMove / hasMove (docs/spec.md "動かせる手")', () => {
    it('is empty for a board where no swap makes three', () => {
        expect(findMove(uniqueBoard(3, 3))).toBeNull();
        expect(hasMove(uniqueBoard(8, 8))).toBe(false);
    });

    it('finds the swap that completes a run, and leaves the board unchanged', () => {
        // 9 9 . 9 in row 2 with a 9 below the gap: moving that 9 up makes four in a row.
        const b = stamp(uniqueBoard(8, 8), 9, [[2, 0], [2, 1], [2, 3], [3, 2]]);
        const copy = b.map((row) => [...row]);
        // The stone at (2,2) is tried first, towards the right: swapping with the 9 at (2,3) also makes 9 9 9.
        expect(findMove(b)).toEqual([pos(2, 2), pos(2, 3)]);
        expect(b).toEqual(copy);
        expect(hasMove(b)).toBe(true);
    });

    it('offers nothing when only a pair exists at the board edge (a swap cannot go outside)', () => {
        const b = stamp(uniqueBoard(8, 8), 9, [[0, 6], [0, 7]]);
        expect(findMove(b)).toBeNull();
    });

    it('returns the move whose first stone comes earliest: upper rows first, then left to right', () => {
        const upper = [[1, 4], [1, 5], [1, 7], [2, 6]] as [number, number][];
        const lower = [[5, 0], [5, 1], [5, 3], [6, 2]] as [number, number][];
        const b = stamp(stamp(uniqueBoard(8, 8), 9, lower), 8, upper);
        // Both groups hold a move; the upper one wins. From stone (1,6) the right partner (1,7) is tried first.
        expect(findMove(b)).toEqual([pos(1, 6), pos(1, 7)]);
    });

    it('tries the partner to the right before the one below for the same stone', () => {
        // Stone (1,1) = 7 can go right (then 7 7 7 7 with (1,3),(1,4)) or down (then 7 7 7 with (2,0),(2,2)).
        const b = uniqueBoard(8, 8);
        stamp(b, 7, [[1, 1], [1, 3], [1, 4], [2, 0], [2, 2]]);
        expect(findMove(b)).toEqual([pos(1, 1), pos(1, 2)]);
    });

    it('agrees with a brute-force oracle: a move exists exactly when some neighbour swap creates a run', () => {
        const rng = seeded(11);
        let found = 0;
        let stuck = 0;
        for (let n = 0; n < 200; n++) {
            const b = createBoard(5, 5, 4, rng);
            // Break the board a little so both outcomes happen: stamp a few cells with a shared colour.
            if (n % 2 === 0) stamp(b, 9, [[2, 0], [2, 1], [3, 3]]);
            const want = (() => {
                for (let r = 0; r < 5; r++) {
                    for (let c = 0; c < 5; c++) {
                        for (const [dr, dc] of [[0, 1], [1, 0]]) {
                            if (r + dr > 4 || c + dc > 4) continue;
                            const t = b.map((row) => [...row]);
                            [t[r][c], t[r + dr][c + dc]] = [t[r + dr][c + dc], t[r][c]];
                            if (findMatches(t).length > 0) return true;
                        }
                    }
                }
                return false;
            })();
            if (hasMove(b) !== want) expect.fail(`board ${JSON.stringify(b)} expected hasMove=${want}`);
            if (want) found++;
            else stuck++;
        }
        expect(found).toBeGreaterThan(20);
        expect(stuck).toBeGreaterThan(0);
    });
});

describe('createBoard (docs/spec.md "盤面")', () => {
    const valid = (b: Board, rows: number, cols: number, colors: number) =>
        b.length === rows &&
        b.every((row) => row.length === cols) &&
        b.flat().every((v) => v !== null && Number.isInteger(v) && v >= 0 && v < colors) &&
        findMatches(b).length === 0 &&
        hasMove(b);

    it('makes boards with no match, a move, and every colour index below COLORS (200 seeds)', () => {
        for (let seed = 1; seed <= 200; seed++) {
            const b = createBoard(8, 8, 6, seeded(seed));
            if (!valid(b, 8, 8, 6)) expect.fail(`seed ${seed} gave ${JSON.stringify(b)}`);
        }
    });

    it('still finishes with the extreme rng values 0 and 0.9999999', () => {
        expect(valid(createBoard(8, 8, 6, () => 0), 8, 8, 6)).toBe(true);
        expect(valid(createBoard(8, 8, 6, () => 0.9999999), 8, 8, 6)).toBe(true);
    });

    it('uses a different board for a different seed', () => {
        expect(createBoard(8, 8, 6, seeded(1))).not.toEqual(createBoard(8, 8, 6, seeded(2)));
    });

    it('gives up after its attempt limit when no board of that size can have a move (2 x 2)', () => {
        const b = createBoard(2, 2, 4, seeded(3));
        expect(b).toHaveLength(2);
        expect(findMatches(b)).toEqual([]);
        expect(hasMove(b)).toBe(false);
    });
});

describe('randomColor', () => {
    it('is floor(rng × colors)', () => {
        expect(randomColor(6, () => 0)).toBe(0);
        expect(randomColor(6, () => 0.17)).toBe(1);
        expect(randomColor(6, () => 0.5)).toBe(3);
        expect(randomColor(6, () => 0.9999999)).toBe(5);
    });
});

describe('collapse (docs/spec.md "落下・補充・連鎖")', () => {
    it('sinks stones to the bottom of each column keeping their order, and reports each fall', () => {
        const b: Board = [[1], [null], [2], [null]];
        const falls = collapse(b);
        expect(b).toEqual([[null], [null], [1], [2]]);
        expect(falls).toEqual([
            { c: 0, from: 2, to: 3 },
            { c: 0, from: 0, to: 2 },
        ]);
    });

    it('does nothing for a full column, or a column whose gaps are all at the top', () => {
        const full: Board = [[1], [2]];
        expect(collapse(full)).toEqual([]);
        const gapsOnTop: Board = [[null], [null], [3]];
        expect(collapse(gapsOnTop)).toEqual([]);
        expect(gapsOnTop).toEqual([[null], [null], [3]]);
    });

    it('matches a per-column oracle on seeded random boards with gaps', () => {
        const rng = seeded(21);
        let withFalls = 0;
        for (let n = 0; n < 200; n++) {
            const rows = 6;
            const cols = 5;
            const b: Board = Array.from({ length: rows }, () =>
                Array.from({ length: cols }, () => (rng() < 0.4 ? null : Math.floor(rng() * 5))),
            );
            const want: Board = Array.from({ length: rows }, () => new Array(cols).fill(null));
            for (let c = 0; c < cols; c++) {
                const col = b.map((row) => row[c]).filter((v) => v !== null);
                col.forEach((v, i) => (want[rows - col.length + i][c] = v));
            }
            const falls = collapse(b);
            if (JSON.stringify(b) !== JSON.stringify(want)) expect.fail(`collapse wrong for case ${n}`);
            if (falls.some((f) => f.to <= f.from)) expect.fail('a fall must go down');
            if (falls.length > 0) withFalls++;
        }
        expect(withFalls).toBeGreaterThan(100);
    });
});

describe('refill', () => {
    it('fills only the empty cells, drawing rng column by column (left to right), each column top to bottom', () => {
        const b: Board = [
            [null, null],
            [null, 7],
        ];
        // Draw order: (0,0) -> 0.1, (1,0) -> 0.5, (0,1) -> 0.9.
        const values = [0.1, 0.5, 0.9];
        let i = 0;
        const added = refill(b, 6, () => {
            if (i >= values.length) throw new Error('drew more random numbers than there are empty cells');
            return values[i++];
        });
        expect(added).toEqual([
            { r: 0, c: 0, color: 0 },
            { r: 1, c: 0, color: 3 },
            { r: 0, c: 1, color: 5 },
        ]);
        expect(b).toEqual([
            [0, 5],
            [3, 7],
        ]);
        expect(i).toBe(3);
    });

    it('draws nothing for a full board', () => {
        expect(refill([[1, 2]], 6, () => 0.5)).toEqual([]);
    });
});

describe('shuffleBoard (docs/spec.md "手詰まり")', () => {
    const sorted = (b: Board) => [...b.flat()].sort((x, y) => (x as number) - (y as number));

    it('rearranges the same stones into a board with no match and a move', () => {
        let rearranged = 0;
        for (let seed = 1; seed <= 50; seed++) {
            const b = createBoard(8, 8, 6, seeded(seed));
            const before = sorted(b);
            const rebuilt = shuffleBoard(b, 6, seeded(seed + 100), 100);
            expect(rebuilt, `seed ${seed}: should not need a rebuild`).toBe(false);
            if (JSON.stringify(sorted(b)) !== JSON.stringify(before)) expect.fail(`seed ${seed}: stones changed`);
            if (findMatches(b).length > 0 || !hasMove(b)) expect.fail(`seed ${seed}: bad board after shuffle`);
            rearranged++;
        }
        expect(rearranged).toBe(50);
    });

    it('builds the board anew after maxTries failed arrangements (a board of one colour can never be arranged)', () => {
        const b: Board = Array.from({ length: 8 }, () => new Array(8).fill(2));
        const rebuilt = shuffleBoard(b, 6, seeded(5), 3);
        expect(rebuilt).toBe(true);
        expect(findMatches(b)).toEqual([]);
        expect(hasMove(b)).toBe(true);
        expect(new Set(b.flat()).size).toBeGreaterThan(1);
    });

    it('rebuilds at once when maxTries is 0', () => {
        const b = uniqueBoard(8, 8);
        expect(shuffleBoard(b, 6, seeded(9), 0)).toBe(true);
        expect(b.flat().every((v) => (v as number) < 6)).toBe(true);
    });
});
