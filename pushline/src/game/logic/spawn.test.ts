import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { topUpFixed } from './fixed';
import { fullLineExists } from './grid';
import { targetSolve } from './solve';
import { eligibleLines, generateBlocks, isHarder } from './spawn';
import {
    board, count, countingClock, cutOffAfter, EMPTY_ROWS, frozenClock, oracleMinOf, render, renderGrid, seeded,
} from './testkit';
import { FIXED, MOVABLE, type LineRef, type State } from './types';

/** A fresh board at the given score: fixed blocks topped up, then one generation. */
function generated(seed: number, score: number, now: () => number = frozenClock) {
    const s = board(EMPTY_ROWS, { score });
    const rng = seeded(seed);
    topUpFixed(s, rng);
    const result = generateBlocks(s, rng, [], now);
    return { s, result };
}

const rowsOf = (indices: number[]): LineRef[] => indices.map((index) => ({ horizontal: true, index }));
const colsOf = (indices: number[]): LineRef[] => indices.map((index) => ({ horizontal: false, index }));
const movablesIn = (s: State, cells: [number, number][]) => cells.filter(([x, y]) => s.grid[y][x] === MOVABLE).length;

describe('generateBlocks: what it guarantees', () => {
    it.each([0, 4, 8])('at score %i a line can always be cleared (checked by an independent search)', (score) => {
        for (let seed = 1; seed <= 25; seed++) {
            const { s } = generated(seed, score);
            if (oracleMinOf(s, 40, 600000) === null) {
                expect.fail(`seed ${seed}, score ${score}: no clear found\n${render(s).join('\n')}`);
            }
        }
    });

    it('never puts a block on the character and never leaves a completed line', () => {
        for (let seed = 1; seed <= 60; seed++) {
            const { s } = generated(seed, seed % 9);
            if (s.grid[s.py][s.px] !== 0) expect.fail(`seed ${seed}: a block on the character`);
            if (fullLineExists(s.grid)) expect.fail(`seed ${seed}: a completed line\n${render(s).join('\n')}`);
        }
    });

    it('leaves the fixed blocks exactly where they were', () => {
        for (let seed = 1; seed <= 30; seed++) {
            const s = board(EMPTY_ROWS, { score: 6 });
            const rng = seeded(seed);
            topUpFixed(s, rng);
            const before = renderGrid(s.grid).map((r) => r.replace(/o/g, '.'));
            generateBlocks(s, rng, [], frozenClock);
            const after = renderGrid(s.grid).map((r) => r.replace(/o/g, '.'));
            expect(after).toEqual(before);
        }
    });

    it('is deterministic for the same random source', () => {
        expect(render(generated(42, 3).s)).toEqual(render(generated(42, 3).s));
    });

    it('reports what it added: exactly the cells that were empty and now hold a block', () => {
        const { s, result } = generated(9, 2);
        const blocks = s.grid.flat().filter((c) => c === MOVABLE).length;
        expect(result.added.filter((p) => p.kind === MOVABLE)).toHaveLength(blocks);
        expect(result.added.every((p) => s.grid[p.y][p.x] === p.kind)).toBe(true);
        expect(result.removed).toEqual([]);
    });
});

describe('generateBlocks: difficulty target', () => {
    // A board "meets" the target when no clear exists within target - 1 moves. The search is strict:
    // running out of its state budget fails the test instead of counting as "meets".
    const meets = (s: State, score: number) => oracleMinOf(s, targetSolve(score) - 1, 800000, true) === null;
    const SEEDS = 100;

    it.each([0, 4])('at score %i at least half of the boards are not easier than the target', (score) => {
        let ok = 0;
        for (let seed = 1; seed <= SEEDS; seed++) if (meets(generated(seed, score).s, score)) ok++;
        expect(ok).toBeGreaterThanOrEqual(SEEDS / 2);
    });

    it('at score 8 (target 10) at least one board still reaches the target', () => {
        let ok = 0;
        for (let seed = 1; seed <= SEEDS; seed++) if (meets(generated(seed, 8).s, 8)) ok++;
        expect(ok).toBeGreaterThanOrEqual(1);
    });

    // Characterization (measured over 100 seeds per score, not a spec requirement): the median optimum is
    // 10 at every score, i.e. it does not rise with the score, and boards of 2 moves or fewer are 0% at
    // scores 0-2, 2-3% at 4-6 and 6% at 8 and above (the crowded board cannot always reach the target and
    // the best candidate is used). Pinned here so a change is noticed; a finding for game-balance.
    it('keeps boards of two moves or fewer rare (at most 10%) at every score', () => {
        for (const score of [0, 4, 8, 12]) {
            let easy = 0;
            for (let seed = 1; seed <= SEEDS; seed++) {
                const min = oracleMinOf(generated(seed, score).s, 40, 600000, true);
                if (min === null) expect.fail(`seed ${seed}, score ${score}: no clear`);
                if (min <= 2) easy++;
            }
            if (easy > SEEDS / 10) expect.fail(`score ${score}: ${easy}/${SEEDS} boards solvable in 2 moves or fewer`);
        }
    });

    // The choice among candidates that miss the target: the one with the longest optimum wins (step 9).
    // (A property such as "more attempts never give an easier board" does not hold, because a candidate
    // whose search ran out of its node budget counts as "hard enough" and is taken at once.)
    it('replaces the best candidate only by one with a strictly longer optimum', () => {
        expect(isHarder(5, 3)).toBe(true);
        expect(isHarder(1, -1)).toBe(true); // the first candidate always becomes the best
        expect(isHarder(3, 5)).toBe(false);
        expect(isHarder(4, 4)).toBe(false);
    });
});

describe('generateBlocks: thinning leftovers', () => {
    const LEFTOVERS = ['ooo..', 'ooo..', '.....', '.....', '.....', '..@..'];
    const ORIGINALS: [number, number][] = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];

    it('keeps two leftover movable blocks and reports the others as removed', () => {
        const s = board(LEFTOVERS);
        const result = generateBlocks(s, seeded(3), [], frozenClock);
        expect(result.removed).toHaveLength(4);
        const removedKeys = new Set(result.removed.map((p) => `${p.x},${p.y}`));
        const survivors = ORIGINALS.filter(([x, y]) => !removedKeys.has(`${x},${y}`));
        expect(survivors).toHaveLength(2);
        expect(survivors.every(([x, y]) => s.grid[y][x] === MOVABLE)).toBe(true);
    });

    it('does not thin when there are no more than two leftovers', () => {
        const s = board(['o....', '.o...', '.....', '.....', '.....', '..@..']);
        const result = generateBlocks(s, seeded(3), [], frozenClock);
        expect(result.removed).toEqual([]);
        expect(s.grid[0][0]).toBe(MOVABLE);
        expect(s.grid[1][1]).toBe(MOVABLE);
    });

    it('also thins when the single-push arrangement (step 10) is used', () => {
        const s = board(LEFTOVERS);
        const clock = cutOffAfter(1); // no attempt runs at all
        const result = generateBlocks(s, seeded(3), [], clock.now);
        expect(result.removed).toHaveLength(4);
        expect(oracleMinOf(s, 40, 600000)).not.toBeNull();
        expect(fullLineExists(s.grid)).toBe(false);
    });

    it('reports a thinned cell that is filled again in both lists (removed and added)', () => {
        let both = 0;
        for (let seed = 1; seed <= 300; seed++) {
            const s = board(LEFTOVERS);
            const result = generateBlocks(s, seeded(seed), [], frozenClock);
            const added = new Set(result.added.map((p) => `${p.x},${p.y}`));
            for (const p of result.removed) {
                if (added.has(`${p.x},${p.y}`)) {
                    both++;
                    if (s.grid[p.y][p.x] !== MOVABLE) expect.fail(`seed ${seed}: ${p.x},${p.y} reported added but empty`);
                }
            }
        }
        expect(both).toBeGreaterThan(0);
    });
});

describe('eligibleLines: the lines a generation may aim at', () => {
    const names = (s: State, avoid: LineRef[]) =>
        eligibleLines(s, avoid).map((l) => `${l.horizontal ? 'row' : 'col'}${l.index}`).sort();

    it('is every line except the character\'s own row and column', () => {
        // the character is at (2, 5)
        expect(names(board(EMPTY_ROWS), [])).toEqual(
            ['col0', 'col1', 'col3', 'col4', 'row0', 'row1', 'row2', 'row3', 'row4'],
        );
    });

    it('leaves out the lines that were just cleared', () => {
        expect(names(board(EMPTY_ROWS), [...rowsOf([0, 3]), ...colsOf([4])])).toEqual(
            ['col0', 'col1', 'col3', 'row1', 'row2', 'row4'],
        );
    });

    it('does not mistake a column for the row with the same index', () => {
        // avoiding row 1 must keep column 1, and avoiding column 1 must keep row 1
        expect(names(board(EMPTY_ROWS), rowsOf([1]))).toContain('col1');
        expect(names(board(EMPTY_ROWS), colsOf([1]))).toContain('row1');
        expect(names(board(EMPTY_ROWS), rowsOf([1]))).not.toContain('row1');
        expect(names(board(EMPTY_ROWS), colsOf([1]))).not.toContain('col1');
    });

    it('follows the character: a character in the middle excludes row 3 and column 1', () => {
        const s = board(['.....', '.....', '.....', '.@...', '.....', '.....']);
        const lines = names(s, []);
        expect(lines).not.toContain('row3');
        expect(lines).not.toContain('col1');
        expect(lines).toContain('row5');
        expect(lines).toContain('col2');
    });

    it('is empty when everything else is avoided', () => {
        expect(names(board(EMPTY_ROWS), [...rowsOf([0, 1, 2, 3, 4]), ...colsOf([0, 1, 3, 4])])).toEqual([]);
    });
});

describe('generateBlocks: which line it aims at', () => {
    // These use the single-push arrangement (no attempts), whose geometry is easy to read: one line
    // gets all its other cells filled and one feeder cell sits next to the gap.
    const NO_ATTEMPTS = () => cutOffAfter(1).now;

    it('chooses only row 0 when every other line is avoided', () => {
        const avoid = [...rowsOf([1, 2, 3, 4, 5]), ...colsOf([0, 1, 2, 3, 4])];
        for (let seed = 1; seed <= 10; seed++) {
            const s = board(EMPTY_ROWS);
            generateBlocks(s, seeded(seed), avoid, NO_ATTEMPTS());
            const row0 = s.grid[0].filter((c) => c === MOVABLE).length;
            if (row0 !== 4) expect.fail(`seed ${seed}: row 0 holds ${row0} blocks\n${render(s).join('\n')}`);
            const gap = s.grid[0].indexOf(0);
            if (s.grid[1][gap] !== MOVABLE) expect.fail(`seed ${seed}: no feeder under the gap\n${render(s).join('\n')}`);
        }
    });

    it('never targets the character\'s column even when every row is avoided', () => {
        // the character is in column 2; only columns 0, 1, 3, 4 may be targets
        for (let seed = 1; seed <= 20; seed++) {
            const s = board(EMPTY_ROWS);
            generateBlocks(s, seeded(seed), rowsOf([0, 1, 2, 3, 4, 5]), NO_ATTEMPTS());
            const full = [0, 1, 3, 4].filter((x) => movablesIn(s, [0, 1, 2, 3, 4, 5].map((y): [number, number] => [x, y])) >= 5);
            if (full.length !== 1) expect.fail(`seed ${seed}: target columns ${full}\n${render(s).join('\n')}`);
            const inColumn2 = movablesIn(s, [0, 1, 2, 3, 4, 5].map((y): [number, number] => [2, y]));
            if (inColumn2 > 1) expect.fail(`seed ${seed}: column 2 holds ${inColumn2} blocks`);
        }
    });

    it('never targets the character\'s row even when every column is avoided', () => {
        // the character is in row 5; only rows 0-4 may be targets
        for (let seed = 1; seed <= 20; seed++) {
            const s = board(EMPTY_ROWS);
            generateBlocks(s, seeded(seed), colsOf([0, 1, 2, 3, 4]), NO_ATTEMPTS());
            const inRow5 = s.grid[5].filter((c) => c === MOVABLE).length;
            if (inRow5 > 1) expect.fail(`seed ${seed}: row 5 holds ${inRow5} blocks\n${render(s).join('\n')}`);
            const targets = [0, 1, 2, 3, 4].filter((y) => s.grid[y].filter((c) => c === MOVABLE).length >= 4);
            if (targets.length !== 1) expect.fail(`seed ${seed}: target rows ${targets}\n${render(s).join('\n')}`);
        }
    });

    it('adds nothing when no line is allowed (the character\'s lines are the only ones left)', () => {
        const avoid = [...rowsOf([0, 1, 2, 3, 4]), ...colsOf([0, 1, 2, 3, 4])];
        const s = board(EMPTY_ROWS);
        const result = generateBlocks(s, seeded(1), avoid, frozenClock);
        expect(result.added).toEqual([]);
        expect(count(s.grid, MOVABLE)).toBe(0);
    });

    // Smoke test only: with real attempts the target line is internal and not observable, so this checks
    // the result stays valid. (The character's own lines are excluded redundantly: a block on the
    // character's cell would also be rejected later, so the two tests above pin the behaviour, not the guard.)
    it('smoke: with the real attempts and all but row 0 avoided, the board stays valid', () => {
        for (let seed = 1; seed <= 20; seed++) {
            const s = board(EMPTY_ROWS);
            generateBlocks(s, seeded(seed), [...rowsOf([1, 2, 3, 4, 5]), ...colsOf([0, 1, 2, 3, 4])], frozenClock);
            // only row 0 can be the target, so the line the solution clears is row 0 or a decoy line:
            // the board must still be clearable and free of completed lines
            if (fullLineExists(s.grid)) expect.fail(`seed ${seed}: a completed line`);
            if (oracleMinOf(s, 40, 600000) === null && count(s.grid, MOVABLE) > 0) expect.fail(`seed ${seed}: not clearable`);
        }
    });
});

describe('generateBlocks: time limit, attempt budget and fallbacks', () => {
    it('stops trying exactly when the time limit has passed, then uses the best candidate so far', () => {
        // reads: 1 at the start, then one before each attempt; the 4th read is past the limit
        const clock = cutOffAfter(3);
        const { s } = generated(2, 12, clock.now);
        expect(clock.readings()).toBe(4); // two attempts ran, the third check cut it off
        expect(oracleMinOf(s, 40, 800000)).not.toBeNull();
    });

    it('with no attempt possible it falls back to a single push arrangement without decoys', () => {
        const s = board(EMPTY_ROWS);
        const result = generateBlocks(s, seeded(1), [], cutOffAfter(1).now);
        // the other cells of one line plus the feeder, nothing else: 4 + 1 for a row, 5 + 1 for a column
        const blocks = count(s.grid, MOVABLE);
        expect([5, 6]).toContain(blocks);
        expect(result.added).toHaveLength(blocks);
        expect(oracleMinOf(s, 40, 600000)).not.toBeNull();
        expect(fullLineExists(s.grid)).toBe(false);
    });

    it('spends at most the attempt budget when no candidate can be made (one read per attempt)', () => {
        const clock = countingClock();
        const avoid = [...rowsOf([0, 1, 2, 3, 4]), ...colsOf([0, 1, 2, 3, 4])]; // nothing to aim at
        generateBlocks(board(EMPTY_ROWS), seeded(1), avoid, clock.now);
        expect(clock.readings()).toBe(1 + PARAMS.spawnAttempts);
    });

    it('adds nothing but still thins when no arrangement exists at all', () => {
        // No completed line anywhere and the free cells (a diagonal plus the character) are all walled in
        // by fixed blocks, so no target line has an empty gap with room for a feeder and a pusher.
        const s = board(['.xxxo', 'o.xxx', 'xx.ox', 'xxx.x', 'xxxx.', 'xx@xx']);
        expect(fullLineExists(s.grid)).toBe(false);
        const result = generateBlocks(s, seeded(1), [], frozenClock);
        expect(result.added).toEqual([]);
        expect(result.removed).toHaveLength(1); // three movable blocks, two are kept
        expect(count(s.grid, MOVABLE)).toBe(2);
        expect(count(s.grid, FIXED)).toBe(21);
    });
});
