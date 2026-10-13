// The easy-board floor (docs/spec/board-generation.md "簡単さの下限") and the relocation of fixed blocks.
import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { floorMoves, hasSingleBlockClear, relocateFixed } from './floor';
import { cloneGrid, fullLineExists, key, reachableFrom } from './grid';
import { minClearMoves } from './solve';
import { board, count, oracleMinOf, render, seeded, singleClearOracle } from './testkit';
import { EMPTY, FIXED, MOVABLE, type Grid, type State } from './types';

// The three boards of the spec (target 6 → floor 5).
const EXAMPLE_1 = ['.....', '.....', '...@.', '...o.', 'ooo.o', '.....'];
const EXAMPLE_2 = ['.....', '.....', '..@..', '..oo.', 'oo..o', '.....'];
const EXAMPLE_3 = ['@....', '.....', '.....', '..oo.', 'oo..o', '.....'];

const single = (rows: string[]): boolean => {
    const s = board(rows);
    return hasSingleBlockClear(s.grid, s.px, s.py);
};

const singleOracle = singleClearOracle;

describe('floorMoves: the lower bound (A) on the fewest moves to a clear', () => {
    it.each([
        [6, 5], [7, 5], [8, 6], [9, 7], [10, 8],
    ])('target %i needs at least %i moves', (target, floor) => {
        expect(floorMoves(target)).toBe(floor);
    });

    it('is the larger of the minimum and the target minus the gap', () => {
        // 7 - 2 = 5 ties the minimum, 8 - 2 = 6 is the first target above it
        expect(floorMoves(PARAMS.floorMin + PARAMS.floorGap)).toBe(PARAMS.floorMin);
        expect(floorMoves(PARAMS.floorMin + PARAMS.floorGap + 1)).toBe(PARAMS.floorMin + 1);
        expect(floorMoves(PARAMS.floorMin)).toBe(PARAMS.floorMin); // a small target never lowers it
    });
});

describe('hasSingleBlockClear: (B) one block alone clears a line', () => {
    it('example 1: pushing one block once completes a row (shortest clear is 1 move)', () => {
        expect(single(EXAMPLE_1)).toBe(true);
        expect(oracleMinOf(board(EXAMPLE_1), 40)).toBe(1);
    });

    it('example 2: two blocks are needed (4 moves), so no single block clears', () => {
        expect(single(EXAMPLE_2)).toBe(false);
        expect(oracleMinOf(board(EXAMPLE_2), 40)).toBe(4);
    });

    it('example 3: the same blocks with a far character need 8 moves and still no single block clears', () => {
        expect(single(EXAMPLE_3)).toBe(false);
        expect(oracleMinOf(board(EXAMPLE_3), 40)).toBe(8);
        expect(minClearMoves(board(EXAMPLE_3).grid, 0, 0, 20)).toBe(8);
    });

    it('treats the other movable blocks as walls: a block that is in the way is not pushed aside for the first one', () => {
        // b at (3,3) would complete row 4, but c above it blocks every approach from above unless c is moved
        const rows = ['.....', '...@.', '...o.', '...o.', 'ooo.o', '.....'];
        expect(single(rows)).toBe(false);
        expect(oracleMinOf(board(rows), 40)).toBe(4); // two blocks together do clear
    });

    it('treats fixed blocks as walls', () => {
        const rows = ['.....', '...@.', '...x.', '...o.', 'ooo.o', '.....'];
        expect(single(rows)).toBe(false);
    });

    it('also finds a completed column, not only a row (the pushed block entered it)', () => {
        const rows = ['....o', '....o', '....o', '....o', '....o', '..@o.'];
        expect(single(rows)).toBe(true);
    });

    it('does not count the row the block was pushed along: the character ends up standing in it', () => {
        // pushing the block left fills the gap, but the character's new cell (the block's old one) is empty
        expect(single(['.....', '.....', '.....', '.....', '.....', 'xx.o@'])).toBe(false);
    });

    it('treats the character\'s start cell as an ordinary empty cell once it has left it', () => {
        // pushing the block down twice moves it into (0,5), where the character started: row 5 is complete
        expect(single(['.....', '.....', '.....', 'o....', '.....', '@oooo'])).toBe(true);
    });

    it('treats the cell a block has left as empty when the block later comes back into that line', () => {
        // column 2 is filled except (2,3), where b stands, and (2,4). Pushing b right and then walking it
        // down and back left into (2,4) would fill every other cell of column 2, but its old cell (2,3)
        // is empty by then, so the column is not complete: no single block clears.
        const rows = ['..o..', '..o..', '..o..', '.@o..', '.....', '..o..'];
        expect(single(rows)).toBe(false);
        expect(singleOracle(rows)).toBe(false);
    });

    it('finds a single-block clear on a hand-made board and agrees with the independent search', () => {
        const rows = ['.....', '.....', '.....', '..o..', 'oo.oo', '@....'];
        expect(single(rows)).toBe(singleOracle(rows));
        expect(single(rows)).toBe(true);
    });

    it('agrees with an independent search on 400 random boards (both answers occur)', () => {
        const rng = seeded(7);
        let yes = 0;
        let no = 0;
        for (let i = 0; i < 400; i++) {
            const cells: string[] = Array.from({ length: 30 }, () => {
                const r = rng();
                return r < 0.12 ? 'x' : r < 0.5 ? 'o' : '.';
            });
            const at = Math.floor(rng() * 30);
            cells[at] = '@';
            const rows = [0, 1, 2, 3, 4, 5].map((y) => cells.slice(y * 5, y * 5 + 5).join(''));
            const s = board(rows);
            if (fullLineExists(s.grid)) continue; // a board the game never has
            const got = hasSingleBlockClear(s.grid, s.px, s.py);
            const want = singleOracle(rows);
            if (got !== want) expect.fail(`board\n${rows.join('\n')}\nexpected ${want}, got ${got}`);
            if (got) yes++; else no++;
        }
        expect(yes).toBeGreaterThan(10);
        expect(no).toBeGreaterThan(10);
    });
});

describe('relocateFixed: moving fixed blocks to relieve a crowded board', () => {
    const FIXED_PAIR = ['x.x..', '.....', '.....', '.....', '.....', '..@..'];

    const fixedCells = (grid: Grid): string[] => {
        const out: string[] = [];
        grid.forEach((row, y) => row.forEach((c, x) => { if (c === FIXED) out.push(key(x, y)); }));
        return out;
    };

    it('moves the configured number of fixed blocks, each to a different empty cell', () => {
        const s = board(FIXED_PAIR);
        const res = relocateFixed(s.grid, s.px, s.py, seeded(1), new Set(), new Set());
        expect(res).not.toBeNull();
        expect(res!.moves).toHaveLength(PARAMS.relocateCount);
        for (const m of res!.moves) {
            expect(key(m.from.x, m.from.y)).not.toBe(key(m.to.x, m.to.y));
            expect(s.grid[m.from.y][m.from.x]).toBe(FIXED); // the input board is left alone
            expect(s.grid[m.to.y][m.to.x]).toBe(EMPTY);
            expect(res!.grid[m.to.y][m.to.x]).toBe(FIXED);
        }
        expect(count(res!.grid, FIXED)).toBe(2);
    });

    it('moves a single block when only one is there, and nothing when there are none', () => {
        const one = board(['x....', '.....', '.....', '.....', '.....', '..@..']);
        expect(relocateFixed(one.grid, one.px, one.py, seeded(1), new Set(), new Set())!.moves).toHaveLength(1);
        const none = board(['.....', '.....', '.....', '.....', '.....', '..@..']);
        expect(relocateFixed(none.grid, none.px, none.py, seeded(1), new Set(), new Set())).toBeNull();
    });

    it('leaves blocks that already moved alone', () => {
        const s = board(['x....', '.....', '.....', '.....', '.....', '..@..']);
        expect(relocateFixed(s.grid, s.px, s.py, seeded(1), new Set([key(0, 0)]), new Set())).toBeNull();
    });

    it('never moves a block into a cell that was vacated earlier (and does use other cells)', () => {
        const s = board(FIXED_PAIR);
        const banned = key(2, 2);
        let usedOthers = 0;
        let bannedWithout = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const withBan = relocateFixed(s.grid, s.px, s.py, seeded(seed), new Set(), new Set([banned]))!;
            if (withBan.moves.some((m) => key(m.to.x, m.to.y) === banned)) expect.fail(`seed ${seed} moved into the vacated cell`);
            usedOthers += withBan.moves.length;
            const noBan = relocateFixed(s.grid, s.px, s.py, seeded(seed), new Set(), new Set())!;
            if (noBan.moves.some((m) => key(m.to.x, m.to.y) === banned)) bannedWithout++;
        }
        expect(usedOthers).toBeGreaterThan(0);
        expect(bannedWithout).toBeGreaterThan(0); // the cell is a real candidate, so the ban is what keeps it out
    });

    it('never moves a second block into the cell the first one has just left', () => {
        const s = board(FIXED_PAIR);
        let pairs = 0;
        for (let seed = 1; seed <= 300; seed++) {
            const res = relocateFixed(s.grid, s.px, s.py, seeded(seed), new Set(), new Set())!;
            if (res.moves.length < 2) continue;
            pairs++;
            if (key(res.moves[1].to.x, res.moves[1].to.y) === key(res.moves[0].from.x, res.moves[0].from.y)) {
                expect.fail(`seed ${seed}: the second block went into the first one's old cell`);
            }
        }
        expect(pairs).toBe(300);
    });

    it('does not put a block where it would complete a line', () => {
        // the only fixed block (0,0) could go to (4,0), which completes column 4, or to one of the
        // diagonal gaps, each of which completes its row
        const s = board(['xooo.', '.oooo', 'o.ooo', 'oo.oo', 'ooo.o', '@oooo']);
        expect(fullLineExists(s.grid)).toBe(false);
        expect(relocateFixed(s.grid, s.px, s.py, seeded(1), new Set(), new Set())).toBeNull();
    });

    it('keeps the number of fixed blocks, the character\'s cell empty, no completed line and every reachable cell reachable', () => {
        const rng = seeded(11);
        let relocations = 0;
        for (let i = 0; i < 150; i++) {
            const cells: string[] = Array.from({ length: 30 }, () => {
                const r = rng();
                return r < 0.28 ? 'x' : r < 0.4 ? 'o' : '.';
            });
            cells[Math.floor(rng() * 30)] = '@';
            const rows = [0, 1, 2, 3, 4, 5].map((y) => cells.slice(y * 5, y * 5 + 5).join(''));
            const s: State = board(rows);
            if (fullLineExists(s.grid)) continue;
            const before = reachableFrom(s.grid, s.px, s.py);
            const res = relocateFixed(s.grid, s.px, s.py, seeded(i + 1), new Set(), new Set());
            if (!res) continue;
            relocations += res.moves.length;
            expect(fixedCells(res.grid)).toHaveLength(fixedCells(s.grid).length);
            expect(res.grid[s.py][s.px]).toBe(EMPTY);
            expect(fullLineExists(res.grid)).toBe(false);
            const after = reachableFrom(res.grid, s.px, s.py);
            const touched = new Set(res.moves.flatMap((m) => [key(m.from.x, m.from.y), key(m.to.x, m.to.y)]));
            for (const k of before) {
                if (!touched.has(k) && !after.has(k)) expect.fail(`cell ${k} became unreachable\n${render({ ...s, grid: res.grid }).join('\n')}`);
            }
            // a block that was already on the board and is not listed as moved is where it was
            const moved = new Set(res.moves.map((m) => key(m.from.x, m.from.y)));
            for (const k of fixedCells(s.grid)) {
                if (!moved.has(k) && res.grid[Number(k.split(',')[1])][Number(k.split(',')[0])] !== FIXED) expect.fail(`${k} vanished`);
            }
        }
        expect(relocations).toBeGreaterThan(30);
    });

    it('is deterministic for the same random source', () => {
        const s = board(FIXED_PAIR);
        const a = relocateFixed(cloneGrid(s.grid), s.px, s.py, seeded(5), new Set(), new Set());
        const b = relocateFixed(cloneGrid(s.grid), s.px, s.py, seeded(5), new Set(), new Set());
        expect(a).toEqual(b);
    });
});

describe('the spec examples are consistent with the parameters', () => {
    it('uses movable blocks only in the examples (a sanity check on the fixtures)', () => {
        for (const rows of [EXAMPLE_1, EXAMPLE_2, EXAMPLE_3]) {
            const s = board(rows);
            expect(count(s.grid, MOVABLE)).toBeGreaterThan(0);
            expect(fullLineExists(s.grid)).toBe(false);
        }
    });
});
