import { describe, expect, it } from 'vitest';
import { fixedTarget, topUpFixed } from './fixed';
import { fullLineExists, reachableFrom } from './grid';
import { board, count, EMPTY_ROWS, seeded } from './testkit';
import { FIXED } from './types';

describe('fixedTarget', () => {
    it.each([[0, 3], [1, 3], [2, 4], [3, 4], [4, 5], [8, 7], [9, 7], [10, 7], [50, 7]])(
        'is %i lines -> %i fixed blocks',
        (score, expected) => {
            expect(fixedTarget(score)).toBe(expected);
        },
    );
});

describe('topUpFixed', () => {
    it('adds fixed blocks up to the target and reports each one', () => {
        const s = board(EMPTY_ROWS);
        const placed = topUpFixed(s, seeded(1));
        expect(placed).toHaveLength(3);
        expect(count(s.grid, FIXED)).toBe(3);
        expect(placed.every((p) => s.grid[p.y][p.x] === FIXED && p.kind === FIXED)).toBe(true);
    });

    it('adds nothing when the board is already at the target', () => {
        const s = board(['x....', '.....', '..x.x', '.....', '.....', '..@..']);
        expect(topUpFixed(s, seeded(1))).toEqual([]);
        expect(count(s.grid, FIXED)).toBe(3);
    });

    it('tops up only the missing ones', () => {
        const s = board(['x....', '.....', '.....', '.....', '.....', '..@..'], { score: 4 });
        // score 4 -> target 5, one is there
        expect(topUpFixed(s, seeded(2))).toHaveLength(4);
        expect(count(s.grid, FIXED)).toBe(5);
    });

    it('never goes above the cap of seven', () => {
        const s = board(EMPTY_ROWS, { score: 40 });
        topUpFixed(s, seeded(3));
        expect(count(s.grid, FIXED)).toBe(7);
    });

    it('on an open board: never on the character, every empty cell stays reachable, no completed line', () => {
        for (let seed = 1; seed <= 60; seed++) {
            const s = board(EMPTY_ROWS, { score: 12 });
            topUpFixed(s, seeded(seed));
            if (s.grid[s.py][s.px] !== 0) expect.fail(`seed ${seed}: block on the character`);
            if (fullLineExists(s.grid)) expect.fail(`seed ${seed}: completed line`);
            const empties = s.grid.flat().filter((c) => c === 0).length;
            if (reachableFrom(s.grid, s.px, s.py).size !== empties) expect.fail(`seed ${seed}: cells cut off`);
        }
    });

    it('never closes a dead end: the spur cell (4, 5) is only filled before (3, 5), never after', () => {
        // (4, 5) is reachable only through (3, 5): a fixed block on (3, 5) would cut it off
        let spurFilled = 0;
        for (let seed = 1; seed <= 80; seed++) {
            const s = board(['.....', '.....', '.....', '.....', '....o', '@....']);
            topUpFixed(s, seeded(seed));
            if (s.grid[5][3] === FIXED && s.grid[5][4] === 0) expect.fail(`seed ${seed}: spur cut off`);
            if (s.grid[5][4] === FIXED) spurFilled++;
        }
        expect(spurFilled).toBeGreaterThan(0);
    });

    it('never fills the last gap of an almost completed column', () => {
        // column 4 holds fixed blocks at y 0-3 and 5; a block at the gap (4, 4) would complete it
        let placedElsewhere = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const s = board(['....x', '....x', '....x', '....x', '.....', '..@.x'], { score: 12 });
            const placed = topUpFixed(s, seeded(seed));
            if (s.grid[4][4] !== 0) expect.fail(`seed ${seed}: the gap (4, 4) was filled`);
            placedElsewhere += placed.length;
        }
        expect(placedElsewhere).toBeGreaterThan(0);
    });

    it('never fills the last gap of an almost completed row', () => {
        // row 0 holds four fixed blocks; a fifth at (4, 0) would complete it
        let placedElsewhere = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const s = board(['xxxx.', '.....', '.....', '.....', '.....', '..@..'], { score: 12 });
            const placed = topUpFixed(s, seeded(seed));
            if (s.grid[0][4] !== 0) expect.fail(`seed ${seed}: the gap (4, 0) was filled`);
            placedElsewhere += placed.length;
        }
        expect(placedElsewhere).toBeGreaterThan(0);
    });

    it('still tops up when the character is shut in a pocket (regression: the old rule added nothing)', () => {
        // the character is in a 2 x 2 pocket (0,4)(1,4)(0,5)(1,5); the open board above can't be reached
        const rows = ['.....', '.....', '.....', 'ooo..', '..o..', '@.o..'];
        for (let seed = 1; seed <= 40; seed++) {
            const s = board(rows);
            const before = reachableFrom(s.grid, s.px, s.py);
            expect(before.size).toBe(4);
            const placed = topUpFixed(s, seeded(seed));
            if (placed.length !== 3) expect.fail(`seed ${seed}: ${placed.length} fixed blocks placed`);
            // the character still reaches every pocket cell that did not get a block
            const after = reachableFrom(s.grid, s.px, s.py);
            for (const k of before) {
                const [x, y] = k.split(',').map(Number);
                if (s.grid[y][x] === 0 && !after.has(k)) expect.fail(`seed ${seed}: ${k} was cut off`);
            }
        }
    });

    it('allows a block on cells the character never reached (an unreachable region)', () => {
        let placedUnreachable = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const s = board(['.....', '.....', '.....', 'ooo..', '..o..', '@.o..']);
            const placed = topUpFixed(s, seeded(seed));
            placedUnreachable += placed.filter((p) => p.y <= 2 || p.x >= 3).length;
        }
        expect(placedUnreachable).toBeGreaterThan(0);
    });

    it('does not cut the character off from a pocket cell it could reach (only the far end may be filled)', () => {
        // corridor (0,5) character, (1,5), (2,5) dead end, closed by movable blocks; the rest is open above
        let farEndFilled = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const s = board(['.....', '.....', '.....', 'ooo..', 'ooo..', '@..oo']);
            topUpFixed(s, seeded(seed));
            if (s.grid[5][1] === FIXED && s.grid[5][2] === 0) expect.fail(`seed ${seed}: (2,5) was cut off by (1,5)`);
            if (s.grid[5][2] === FIXED) farEndFilled++;
        }
        expect(farEndFilled).toBeGreaterThan(0);
    });
});
