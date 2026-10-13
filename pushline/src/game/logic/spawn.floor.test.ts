// The generator's use of the floor: classification, adoption priority, rounds, the clock and relocation
// (docs/spec/board-generation.md "採用の優先順位", 手順 9, "押せないブロックの置き直し"). The search that judges a
// candidate and the single-block check are replaced so each rule can be driven on purpose.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PARAMS } from '../params';
import { topUpFixed } from './fixed';
import * as floor from './floor';
import { key } from './grid';
import * as solve from './solve';
import { generateBlocks } from './spawn';
import { board, count, countingClock, EMPTY_ROWS, render, renderGrid, seeded, singleClearOracle } from './testkit';
import { EMPTY, FIXED, MOVABLE, type Grid, type LineRef, type State } from './types';

vi.mock('./floor', async (orig) => {
    const actual = await orig<typeof import('./floor')>();
    return { ...actual, hasSingleBlockClear: vi.fn(actual.hasSingleBlockClear), relocateFixed: vi.fn(actual.relocateFixed) };
});
vi.mock('./solve', async (orig) => {
    const actual = await orig<typeof import('./solve')>();
    return { ...actual, minClearMoves: vi.fn(actual.minClearMoves) };
});

const hasSingle = vi.mocked(floor.hasSingleBlockClear);
const relocate = vi.mocked(floor.relocateFixed);
const minMoves = vi.mocked(solve.minClearMoves);

const ROUNDS = 1 + PARAMS.relocateMax;
const ROUND_CAP = Math.floor(PARAMS.spawnAttempts / ROUNDS);

beforeEach(async () => {
    const realFloor = await vi.importActual<typeof import('./floor')>('./floor');
    const realSolve = await vi.importActual<typeof import('./solve')>('./solve');
    hasSingle.mockReset().mockImplementation(realFloor.hasSingleBlockClear);
    relocate.mockReset().mockImplementation(realFloor.relocateFixed);
    minMoves.mockReset().mockImplementation(realSolve.minClearMoves);
});

/** A board at `score` with its fixed blocks topped up (the state right before a generation). */
function crowded(score: number, seed = 3): { s: State; rng: () => number } {
    const s = board(EMPTY_ROWS, { score });
    const rng = seeded(seed);
    topUpFixed(s, rng);
    return { s, rng };
}

/** The fixed blocks only, as ASCII (movable blocks shown as empty). */
const fixedOnly = (grid: Grid): string[] => renderGrid(grid).map((r) => r.replace(/o/g, '.'));

/** A clock that returns the given readings in order, then a far future. */
function sequenceClock(values: number[]): { now: () => number; readings: () => number } {
    let n = 0;
    return { now: () => (n < values.length ? values[n++] : (n++, 1e9)), readings: () => n };
}

/** `found` and "no single block clears" for each judged candidate, by order; later ones are the worst. */
function judgeBySequence(found: number[], noSingle: boolean[]): { grids: string[][] } {
    const grids: string[][] = [];
    let i = 0;
    let j = 0;
    minMoves.mockImplementation((grid) => {
        grids.push(renderGrid(grid));
        const f = found[i++];
        return f === undefined ? 2 : f;
    });
    hasSingle.mockImplementation(() => !(noSingle[j++] ?? false));
    return { grids };
}

describe('generateBlocks: adoption by priority', () => {
    it('takes the first ideal candidate at once (reaches the target, no single block clears) and never relocates', () => {
        const { s, rng } = crowded(2);
        minMoves.mockImplementation(() => null); // no clear within target - 1: at least the target
        hasSingle.mockImplementation(() => false);
        const result = generateBlocks(s, rng, [], countingClock().now);
        expect(hasSingle).toHaveBeenCalledTimes(1);
        expect(relocate).not.toHaveBeenCalled();
        expect(result.relocated).toEqual([]);
    });

    it('a candidate that only meets the floor uses the whole first round, then is adopted without relocating', () => {
        const { s, rng } = crowded(0); // target 6, floor 5
        const seen = judgeBySequence([], []);
        minMoves.mockImplementation((grid) => {
            seen.grids.push(renderGrid(grid));
            return PARAMS.floorMin; // 5: meets (A), short of the target
        });
        hasSingle.mockImplementation(() => false);
        const clock = countingClock();
        const before = fixedOnly(s.grid);
        const result = generateBlocks(s, rng, [], clock.now);
        expect(clock.readings()).toBe(1 + ROUND_CAP); // the clock: once at the start, once per attempt
        expect(relocate).not.toHaveBeenCalled();
        expect(result.relocated).toEqual([]);
        expect(fixedOnly(s.grid)).toEqual(before);
        // equal candidates: the first one found wins
        expect(renderGrid(s.grid)).toEqual(seen.grids[0]);
    });

    it('relocates only after a whole round without an ideal or pass candidate, up to the maximum, with one attempt cap overall', () => {
        const { s, rng } = crowded(8);
        minMoves.mockImplementation(() => 3); // below the floor of 8
        hasSingle.mockImplementation(() => true);
        const clock = countingClock();
        generateBlocks(s, rng, [], clock.now);
        expect(relocate).toHaveBeenCalledTimes(PARAMS.relocateMax);
        expect(clock.readings()).toBe(1 + PARAMS.spawnAttempts);
    });

    it('hands each relocation the blocks moved and the cells vacated so far', async () => {
        const { s, rng } = crowded(8);
        minMoves.mockImplementation(() => 3);
        hasSingle.mockImplementation(() => true);
        const realFloor = await vi.importActual<typeof import('./floor')>('./floor');
        const calls: { grid: string[]; moved: string[]; vacated: string[] }[] = [];
        relocate.mockImplementation((grid, px, py, r, moved, vacated) => {
            calls.push({ grid: fixedOnly(grid), moved: [...moved].sort(), vacated: [...vacated].sort() });
            return realFloor.relocateFixed(grid, px, py, r, moved, vacated);
        });
        generateBlocks(s, rng, [], countingClock().now);
        expect(calls).toHaveLength(PARAMS.relocateMax);
        const [first, second] = calls;
        expect(first.moved).toEqual([]);
        expect(first.vacated).toEqual([]);
        const firstMoves = relocate.mock.results[0].value.moves as { from: { x: number; y: number }; to: { x: number; y: number } }[];
        expect(second.moved).toEqual(firstMoves.map((m) => key(m.to.x, m.to.y)).sort());
        expect(second.vacated).toEqual(firstMoves.map((m) => key(m.from.x, m.from.y)).sort());
        // the second relocation starts from the first one's board
        expect(second.grid).not.toEqual(first.grid);
    });

    it('adopts a candidate that meets the floor after a relocation, and reports the move', () => {
        const { s, rng } = crowded(8); // target 10, floor 8
        const original = fixedOnly(s.grid);
        minMoves.mockImplementation((grid) => (fixedOnly(grid).join() === original.join() ? 3 : 8));
        hasSingle.mockImplementation(() => false);
        const clock = countingClock();
        const result = generateBlocks(s, rng, [], clock.now);
        expect(relocate).toHaveBeenCalledTimes(1);
        expect(clock.readings()).toBe(1 + 2 * ROUND_CAP); // rounds 0 and 1 were used up, round 2 never started
        expect(fixedOnly(s.grid)).not.toEqual(original);
        expect(count(s.grid, FIXED)).toBe(7); // the number never changes
        expect(result.relocated).toHaveLength(PARAMS.relocateCount);
        for (const m of result.relocated) {
            expect(s.grid[m.to.y][m.to.x]).toBe(FIXED);
            expect(result.added).toContainEqual({ x: m.to.x, y: m.to.y, kind: FIXED });
            expect(original[m.from.y][m.from.x]).toBe('x');
            expect(fixedOnly(s.grid)[m.from.y][m.from.x]).toBe('.');
        }
    });

    it('among candidates that all miss the floor, one that no single block clears beats a longer one that does', () => {
        const { s, rng } = crowded(8);
        const seen = judgeBySequence([4, 3], [false, true]); // #0 longer but cleared by one block
        generateBlocks(s, rng, [], countingClock().now);
        expect(renderGrid(s.grid)).toEqual(seen.grids[1]);
    });

    it('with the same single-block answer, the longer optimum wins', () => {
        const { s, rng } = crowded(8);
        const seen = judgeBySequence([3, 4], [true, true]);
        generateBlocks(s, rng, [], countingClock().now);
        expect(renderGrid(s.grid)).toEqual(seen.grids[1]);
    });

    it('with everything equal, the candidate found first wins', () => {
        const { s, rng } = crowded(8);
        const seen = judgeBySequence([4, 4], [true, true]);
        generateBlocks(s, rng, [], countingClock().now);
        expect(renderGrid(s.grid)).toEqual(seen.grids[0]);
    });

    it('a relocated candidate that fails the floor does not displace an equal one from before the relocation', () => {
        const { s, rng } = crowded(2);
        const original = fixedOnly(s.grid);
        minMoves.mockImplementation(() => 4);
        hasSingle.mockImplementation(() => true); // every candidate fails, all alike
        const result = generateBlocks(s, rng, [], countingClock().now);
        expect(fixedOnly(s.grid)).toEqual(original);
        expect(result.relocated).toEqual([]);
    });
});

describe('generateBlocks: what a relocation leaves behind', () => {
    /** Wraps the real relocation and remembers the fixed layout of every board it returns. */
    async function trackRelocations(): Promise<string[][]> {
        const realFloor = await vi.importActual<typeof import('./floor')>('./floor');
        const layouts: string[][] = [];
        relocate.mockImplementation((grid, px, py, r, moved, vacated) => {
            const res = realFloor.relocateFixed(grid, px, py, r, moved, vacated);
            if (res) layouts.push(fixedOnly(res.grid));
            return res;
        });
        return layouts;
    }

    it('after two relocations the record holds every moved block once, from the original cell to the final one', async () => {
        const { s, rng } = crowded(8);
        const original = fixedOnly(s.grid);
        const layouts = await trackRelocations();
        // only a board laid out as after the SECOND relocation meets the floor
        minMoves.mockImplementation((grid) => (layouts.length >= 2 && fixedOnly(grid).join() === layouts[1].join() ? 8 : 3));
        hasSingle.mockImplementation(() => false);
        const result = generateBlocks(s, rng, [], countingClock().now);
        expect(relocate).toHaveBeenCalledTimes(2);
        const moved = relocate.mock.results.flatMap((r) => (r.value as { moves: unknown[] }).moves).length;
        expect(moved).toBeGreaterThan(PARAMS.relocateCount); // the second round moved blocks too
        expect(result.relocated).toHaveLength(moved);
        const froms = result.relocated.map((m) => key(m.from.x, m.from.y));
        const tos = result.relocated.map((m) => key(m.to.x, m.to.y));
        expect(new Set(froms).size).toBe(froms.length); // no block is listed twice
        expect(new Set(tos).size).toBe(tos.length);
        expect(froms.filter((f) => tos.includes(f))).toEqual([]); // nothing goes back, nothing is moved twice
        // the board is the original minus the sources plus the destinations
        const nowFixed = new Set<string>();
        fixedOnly(s.grid).forEach((row, y) => [...row].forEach((c, x) => { if (c === 'x') nowFixed.add(key(x, y)); }));
        const expected = new Set<string>();
        original.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'x' && !froms.includes(key(x, y))) expected.add(key(x, y)); }));
        tos.forEach((k) => expected.add(k));
        expect([...nowFixed].sort()).toEqual([...expected].sort());
    });

    it('a candidate that still fails the floor after a relocation is adopted with its record when it is the best', () => {
        const { s, rng } = crowded(2);
        const original = fixedOnly(s.grid);
        minMoves.mockImplementation((grid) => (fixedOnly(grid).join() === original.join() ? 3 : 4));
        hasSingle.mockImplementation(() => true); // all alike on (B); only the longer optimum differs
        const result = generateBlocks(s, rng, [], countingClock().now);
        expect(fixedOnly(s.grid)).not.toEqual(original);
        // the earliest relocated candidate wins the tie, so only the first relocation is on the board
        expect(relocate.mock.calls.length).toBeGreaterThanOrEqual(1);
        expect(result.relocated).toHaveLength((relocate.mock.results[0].value as { moves: unknown[] }).moves.length);
        const froms = result.relocated.map((m) => key(m.from.x, m.from.y));
        const tos = result.relocated.map((m) => key(m.to.x, m.to.y));
        const expected = new Set<string>();
        original.forEach((row, y) => [...row].forEach((c, x) => { if (c === 'x' && !froms.includes(key(x, y))) expected.add(key(x, y)); }));
        tos.forEach((k) => expected.add(k));
        const nowFixed = new Set<string>();
        fixedOnly(s.grid).forEach((row, y) => [...row].forEach((c, x) => { if (c === 'x') nowFixed.add(key(x, y)); }));
        expect([...nowFixed].sort()).toEqual([...expected].sort()); // original - sources + destinations
    });

    it('the floor boundaries: one move short of it relocates, exactly at it is adopted, at the target ends at once', () => {
        const atFloor = floor.floorMoves(solve.targetSolve(0)); // score 0: target 6, floor 5
        expect(atFloor).toBe(5);
        const { s, rng } = crowded(0);
        minMoves.mockImplementation(() => atFloor - 1);
        hasSingle.mockImplementation(() => false);
        generateBlocks(s, rng, [], countingClock().now);
        expect(relocate.mock.calls.length).toBeGreaterThan(0); // 4 < 5: not a pass

        relocate.mockClear();
        const again = crowded(0);
        minMoves.mockImplementation(() => atFloor);
        const clock = countingClock();
        generateBlocks(again.s, again.rng, [], clock.now);
        expect(relocate).not.toHaveBeenCalled(); // 5 >= 5: a pass
        expect(clock.readings()).toBe(1 + ROUND_CAP);

        hasSingle.mockClear();
        const third = crowded(0);
        minMoves.mockImplementation(() => null); // at least the target
        generateBlocks(third.s, third.rng, [], countingClock().now);
        expect(hasSingle).toHaveBeenCalledTimes(1); // ideal: adopted at the first candidate
    });

    it('reaching the target is not enough while one block clears alone: the candidate is not ideal', () => {
        const { s, rng } = crowded(0);
        minMoves.mockImplementation(() => null);
        hasSingle.mockImplementation(() => true);
        generateBlocks(s, rng, [], countingClock().now);
        expect(relocate.mock.calls.length).toBeGreaterThan(0); // no pass, so it relocates
    });

    it('with the real single-block check, the adopted board is one no single block clears (many seeds)', async () => {
        const realFloor = await vi.importActual<typeof import('./floor')>('./floor');
        let rejected = 0;
        let checked = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const { s, rng } = crowded(0, seed);
            minMoves.mockImplementation(() => null); // always at least the target
            hasSingle.mockImplementation((grid, px, py) => {
                const single = realFloor.hasSingleBlockClear(grid, px, py);
                if (single) rejected++;
                return single;
            });
            generateBlocks(s, rng, [], countingClock().now);
            checked++;
            if (singleClearOracle(render(s)) && count(s.grid, MOVABLE) > 0) expect.fail(`seed ${seed}: a single block clears alone`);
        }
        expect(checked).toBe(40);
        expect(rejected).toBeGreaterThan(0); // the check really turned candidates down
    });
});

describe('generateBlocks: the record of relocated blocks', () => {
    function relocatedRun(fresh: { x: number; y: number }[] | 'all') {
        const { s, rng } = crowded(8);
        const original = fixedOnly(s.grid);
        minMoves.mockImplementation((grid) => (fixedOnly(grid).join() === original.join() ? 3 : 8));
        hasSingle.mockImplementation(() => false);
        const cells: { x: number; y: number }[] = [];
        s.grid.forEach((row, y) => row.forEach((c, x) => { if (c === FIXED) cells.push({ x, y }); }));
        const result = generateBlocks(s, rng, [], countingClock().now, fresh === 'all' ? cells : fresh);
        return { s, result, original };
    }

    it('lists every moved block as a (from, to) pair', () => {
        const { s, result, original } = relocatedRun([]);
        expect(result.relocated).toHaveLength(PARAMS.relocateCount);
        const nowFixed = fixedOnly(s.grid);
        for (const m of result.relocated) {
            expect(original[m.from.y][m.from.x]).toBe('x');
            expect(nowFixed[m.to.y][m.to.x]).toBe('x');
        }
        expect(new Set(result.relocated.map((m) => key(m.from.x, m.from.y))).size).toBe(result.relocated.length);
    });

    it('leaves out blocks the same clear just placed (they appear only at the new cell)', () => {
        const withFresh = relocatedRun('all');
        const without = relocatedRun([]);
        expect(withFresh.result.relocated).toEqual([]);
        expect(renderGrid(withFresh.s.grid)).toEqual(renderGrid(without.s.grid)); // the same board either way
        // the new cells are still reported as added, so they pop in
        for (const m of without.result.relocated) {
            expect(withFresh.result.added).toContainEqual({ x: m.to.x, y: m.to.y, kind: FIXED });
        }
    });

    it('with only one of the moved blocks fresh, only the other one is listed (both appear at their new cells)', () => {
        const all = relocatedRun([]);
        expect(all.result.relocated.length).toBeGreaterThanOrEqual(2);
        const one = relocatedRun([all.result.relocated[0].from]);
        expect(one.result.relocated).toEqual(all.result.relocated.slice(1));
        for (const m of all.result.relocated) {
            expect(one.result.added).toContainEqual({ x: m.to.x, y: m.to.y, kind: FIXED });
        }
    });

    it('reports a block placed on a vacated cell as added (the cell was not empty before)', () => {
        let seen = 0;
        for (let seed = 1; seed <= 25; seed++) {
            const { s, rng } = crowded(8, seed);
            const original = fixedOnly(s.grid);
            minMoves.mockImplementation((grid) => (fixedOnly(grid).join() === original.join() ? 3 : 8));
            hasSingle.mockImplementation(() => false);
            const result = generateBlocks(s, rng, [], countingClock().now);
            for (const m of result.relocated) {
                if (s.grid[m.from.y][m.from.x] === MOVABLE) {
                    seen++;
                    expect(result.added).toContainEqual({ x: m.from.x, y: m.from.y, kind: MOVABLE });
                }
            }
        }
        expect(seen).toBeGreaterThan(0);
    });
});

describe('generateBlocks: the clock and the budget across rounds', () => {
    // A real clock (performance.now) does not start at 0: every deadline is relative to the first reading.
    const BASE = 5000;
    const at = (...offsets: number[]) => offsets.map((o) => BASE + o);

    beforeEach(() => {
        minMoves.mockImplementation(() => 3);
        hasSingle.mockImplementation(() => true); // nothing is ever adopted early
    });

    it('carries the reading that ended a round into the next round instead of reading again', () => {
        const { s, rng } = crowded(8);
        // exactly one reading is a round boundary (40 ms in); every other reading is at the start. If the
        // boundary reading is carried it is the next attempt's reading, so the whole budget is spent on
        // 1 + 3000 readings; reading again would cost one more.
        let reads = 0;
        const now = () => BASE + (reads++ === 5 ? 40 : 0);
        generateBlocks(s, rng, [], now);
        expect(reads).toBe(1 + PARAMS.spawnAttempts);
        expect(relocate).toHaveBeenCalledTimes(PARAMS.relocateMax);
    });

    it('ends a round at its deadline, relative to the first reading', () => {
        const { s, rng } = crowded(8);
        // start 5000; attempt at +10; +40 is past round 0 (33.3 ms) and is carried; attempt at +40 (round 1's
        // first); attempt at +50; +120 is past the limit and ends everything
        const clock = sequenceClock(at(0, 10, 40, 50, 120));
        generateBlocks(s, rng, [], clock.now);
        expect(clock.readings()).toBe(5);
        expect(relocate).toHaveBeenCalledTimes(1);
    });

    it('skips a round whose deadline the carried reading already passed (one relocation, no attempts in it)', () => {
        const { s, rng } = crowded(8);
        // +70 is past rounds 0 and 1 (66.7 ms): round 2 gets the carried reading
        const clock = sequenceClock(at(0, 10, 70, 80, 150));
        generateBlocks(s, rng, [], clock.now);
        expect(clock.readings()).toBe(5);
        expect(relocate).toHaveBeenCalledTimes(1);
    });

    it('a reading past the time limit cuts everything at once: no relocation', () => {
        const { s, rng } = crowded(8);
        const clock = sequenceClock(at(0, 10, 150));
        generateBlocks(s, rng, [], clock.now);
        expect(clock.readings()).toBe(3);
        expect(relocate).not.toHaveBeenCalled();
    });

    it('a reading exactly at the time limit still allows an attempt; one past it cuts', () => {
        const { s, rng } = crowded(8);
        const limit = PARAMS.spawnTimeLimitMs;
        // +100 is past the deadlines of rounds 0 and 1 but not the limit itself: one relocation (skipping
        // round 1), then round 2 takes the carried reading for an attempt; +101 cuts
        const clock = sequenceClock(at(0, limit, limit + 1));
        generateBlocks(s, rng, [], clock.now);
        expect(clock.readings()).toBe(3);
        expect(relocate).toHaveBeenCalledTimes(1);
    });

    it('a first reading that is far from 0 does not cut the first attempt', () => {
        const { s, rng } = crowded(8);
        const clock = sequenceClock(at(0, 1, 2, 3, 150));
        generateBlocks(s, rng, [], clock.now);
        expect(clock.readings()).toBe(5); // 3 attempts at +1..+3, then the cut
    });

    it('stops after the first round when no fixed block can be moved', () => {
        const s = board(EMPTY_ROWS, { score: 0 }); // no fixed blocks at all
        const clock = countingClock();
        generateBlocks(s, seeded(1), [], clock.now);
        expect(relocate).toHaveBeenCalledTimes(1);
        expect(relocate.mock.results[0].value).toBeNull();
        expect(clock.readings()).toBe(1 + ROUND_CAP);
    });

    it('with no candidate at all, relocations are not applied and the fixed blocks stay where they were', () => {
        const { s, rng } = crowded(8);
        const original = fixedOnly(s.grid);
        const avoid: LineRef[] = [0, 1, 2, 3, 4, 5].map((index) => ({ horizontal: true, index }))
            .concat([0, 1, 2, 3, 4].map((index) => ({ horizontal: false, index })));
        const clock = countingClock();
        const result = generateBlocks(s, rng, avoid, clock.now);
        expect(fixedOnly(s.grid)).toEqual(original);
        expect(result.relocated).toEqual([]);
        expect(clock.readings()).toBe(1 + PARAMS.spawnAttempts); // all rounds ran: relocation was possible
    });

    it('when every attempt is turned down but a single-push arrangement exists, the relocations are discarded', () => {
        const { s, rng } = crowded(8);
        const original = fixedOnly(s.grid);
        const params = PARAMS as unknown as { scrambleMinPulls: number };
        const saved = params.scrambleMinPulls;
        params.scrambleMinPulls = 99; // no attempt can pull that often: no candidate in any round
        let result;
        try {
            result = generateBlocks(s, rng, [], countingClock().now);
        } finally {
            params.scrambleMinPulls = saved;
        }
        expect(relocate).toHaveBeenCalledTimes(PARAMS.relocateMax); // the rounds did relocate
        expect(result.relocated).toEqual([]);
        expect(fixedOnly(s.grid)).toEqual(original);
        // the single-push arrangement: the other cells of one line plus a feeder (step 10)
        expect(count(s.grid, MOVABLE)).toBeGreaterThanOrEqual(5);
    });

    it('an injected clock that cuts after n attempts ends the whole generation after n attempts, relocation included', () => {
        const { s, rng } = crowded(8);
        let reads = 0;
        const n = ROUND_CAP + 5; // more than round 0 allows: relocation happens, then 5 attempts in round 1
        const now = () => BASE + (reads++ <= n ? 0 : 1e9);
        generateBlocks(s, rng, [], now);
        expect(reads).toBe(n + 2); // the start, n attempts, then the cutting reading
        expect(relocate).toHaveBeenCalledTimes(1);
    });
});

describe('generateBlocks: the floor is only a goal, never a requirement', () => {
    it('still returns a board that can be cleared when nothing meets the floor', () => {
        const { s, rng } = crowded(8);
        minMoves.mockImplementation(() => 1); // everything looks trivial
        hasSingle.mockImplementation(() => true);
        generateBlocks(s, rng, [], countingClock().now);
        expect(count(s.grid, MOVABLE)).toBeGreaterThan(0);
        expect(s.grid[s.py][s.px]).toBe(EMPTY);
    });
});
