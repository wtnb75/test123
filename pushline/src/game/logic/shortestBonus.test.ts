// The shortest-clear bonus (docs/spec.md "最短ボーナス", docs/spec/board-generation.md "最短手数の測定").
import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { topUpFixed } from './fixed';
import { canUndo, createState, earnsShortestBonus, measureShortest, move, undo } from './rules';
import { generateBlocks } from './spawn';
import { tensionOf } from './tension';
import { board, countingClock, depsOf, EMPTY_ROWS, oracleMinOf, oracleSolve, render, seeded } from './testkit';

// One push down (the block at (4, 4) into (4, 5)) completes the bottom row: the shortest clear is 1 move.
const ONE_PUSH = ['.....', '.....', '.....', '....@', '....o', 'oooo.'];

describe('earnsShortestBonus', () => {
    it.each([
        [5, 6, true],
        [6, 6, true],
        [7, 6, false],
        [1, 1, true],
        [2, 1, false],
    ])('spent %i against a shortest of %i gives %s', (spent, shortest, expected) => {
        expect(earnsShortestBonus(spent, shortest)).toBe(expected);
    });

    it('never earns anything on a board whose shortest could not be measured', () => {
        expect(earnsShortestBonus(0, null)).toBe(false);
        expect(earnsShortestBonus(1, null)).toBe(false);
    });
});

describe('move: the bonus on top of the base recovery', () => {
    it('adds the bonus when the clear takes no more moves than the shortest (20 - 1 + 11 + 4 = 34)', () => {
        const s = board(ONE_PUSH, { moves: 20, shortest: 1 });
        const res = move(s, 'down', depsOf(7));
        expect(res.bonus).toBe(true);
        expect(res.recovered).toBe(PARAMS.movesPerLine + PARAMS.shortestBonus);
        expect(s.moves).toBe(34);
        expect(s.bonusCount).toBe(1);
    });

    it('gives only the base recovery when the clear took one move more than the shortest', () => {
        const s = board(ONE_PUSH, { moves: 20, shortest: 1, spent: 1 });
        const res = move(s, 'down', depsOf(7));
        expect(res.bonus).toBe(false);
        expect(res.recovered).toBe(PARAMS.movesPerLine);
        expect(s.moves).toBe(30);
        expect(s.bonusCount).toBe(0);
    });

    it('gives no bonus on a board whose shortest is unknown', () => {
        const s = board(ONE_PUSH, { moves: 20, shortest: null });
        const res = move(s, 'down', depsOf(7));
        expect(res.bonus).toBe(false);
        expect(s.moves).toBe(30);
    });

    it('cuts base plus bonus at the cap, and the popup N is what was actually gained (35 -> 34 -> 40 gives 6)', () => {
        const s = board(ONE_PUSH, { moves: 35, shortest: 1 });
        const res = move(s, 'down', depsOf(7));
        expect(s.moves).toBe(PARAMS.maxMoves);
        expect(res.recovered).toBe(6);
        expect(res.bonus).toBe(true);
    });

    it('still reports the bonus when the cap leaves a gain of only 1 (40 -> 39 -> 40)', () => {
        const s = board(ONE_PUSH, { moves: PARAMS.maxMoves, shortest: 1 });
        const res = move(s, 'down', depsOf(7));
        expect(res.recovered).toBe(1);
        expect(res.bonus).toBe(true);
    });

    it('scores one line for a bonus clear, not more', () => {
        const s = board(ONE_PUSH, { shortest: 1 });
        move(s, 'down', depsOf(7));
        expect(s.score).toBe(1);
    });

    it('stops the low-moves warning when the bonus lifts the moves above the warning level (3 -> 2 -> 17)', () => {
        const s = board(ONE_PUSH, { moves: 3, shortest: 1 });
        expect(tensionOf(s.moves)).toBe('critical');
        move(s, 'down', depsOf(7));
        expect(s.moves).toBe(17);
        expect(tensionOf(s.moves)).toBe('none');
    });

    it('keeps the start moves at 30, the cap at 40 and the numbers of the spec table', () => {
        expect(PARAMS.startMoves).toBe(30);
        expect(PARAMS.maxMoves).toBe(40);
        expect(PARAMS.movesPerLine).toBe(11);
        expect(PARAMS.shortestBonus).toBe(4);
    });
});

describe('the spent-move count of a board', () => {
    it('counts every cell actually moved, a push included', () => {
        const s = board(EMPTY_ROWS);
        move(s, 'up', depsOf(1));
        move(s, 'left', depsOf(1));
        expect(s.spent).toBe(2);
    });

    it('does not count a blocked move', () => {
        const s = board(['.....', '.....', '.....', '.....', '.....', '@....']);
        expect(move(s, 'left', depsOf(1)).moved).toBe(false);
        expect(s.spent).toBe(0);
    });

    it('is not taken back by Undo, and moving again counts again (3 cells, undo, 1 more: 3 + 1)', () => {
        const s = board(EMPTY_ROWS);
        move(s, 'up', depsOf(1));
        move(s, 'up', depsOf(1));
        move(s, 'left', depsOf(1));
        expect(canUndo(s)).toBe(true);
        undo(s);
        expect(s.spent).toBe(3);
        move(s, 'up', depsOf(1));
        expect(s.spent).toBe(4);
    });

    it('loses the bonus when a detour was undone before the shortest push', () => {
        const s = board(ONE_PUSH, { shortest: 1 });
        move(s, 'left', depsOf(7));
        undo(s);
        const res = move(s, 'down', depsOf(7));
        expect(res.bonus).toBe(false);
    });

    it('goes back to 0 after a clear, with the shortest measured for the new board (independent oracle)', () => {
        const s = board(ONE_PUSH, { shortest: 1 });
        move(s, 'down', depsOf(7));
        expect(s.spent).toBe(0);
        expect(s.shortest).toBe(oracleMinOf(s, PARAMS.maxMoves, 600000));
    });
});

describe('measureShortest', () => {
    it('is null for a board with nothing to clear (no movable block at all)', () => {
        expect(measureShortest(board(EMPTY_ROWS))).toBeNull();
    });

    it('is null for a block that can never complete a line, and exact for one that can', () => {
        expect(measureShortest(board(['.....', '.....', '.....', '.....', '.....', '@.o..']))).toBeNull();
        expect(measureShortest(board(ONE_PUSH))).toBe(1);
    });

    it('reads no clock and consumes no random numbers: a new run equals the same steps without it', () => {
        const draws = { n: 0 };
        const counted = (seed: number) => {
            const r = seeded(seed);
            return () => {
                draws.n += 1;
                return r();
            };
        };
        const clockA = countingClock();
        const run = createState({ rng: counted(11), now: clockA.now });
        const drawsRun = draws.n;

        draws.n = 0;
        const clockB = countingClock();
        const ref = board(EMPTY_ROWS, { moves: PARAMS.startMoves });
        const rng = counted(11);
        topUpFixed(ref, rng);
        generateBlocks(ref, rng, [], clockB.now);

        expect(run.grid).toEqual(ref.grid);
        expect(drawsRun).toBe(draws.n);
        expect(clockA.readings()).toBe(clockB.readings());
    });
});

describe('a new run', () => {
    it('starts with 0 spent, 0 bonus clears and the exact shortest of the first board, on 100 seeds', () => {
        let measured = 0;
        for (let seed = 1; seed <= 100; seed++) {
            const s = createState(depsOf(seed));
            if (s.spent !== 0 || s.bonusCount !== 0) expect.fail(`seed ${seed}: counters did not start at 0`);
            const expected = oracleMinOf(s, PARAMS.maxMoves, 600000);
            if (s.shortest !== expected) expect.fail(`seed ${seed}: shortest ${s.shortest}, oracle ${expected}`);
            if (s.shortest !== null) measured++;
        }
        expect(measured).toBeGreaterThan(90); // not vacuous: nearly every board can be measured
    }, 120000);
});

describe('playing the shortest way, round after round', () => {
    it('earns the bonus on every clear and raises the moves by the base plus the bonus (or up to the cap)', () => {
        let rounds = 0;
        for (let seed = 1; seed <= 20; seed++) {
            const deps = depsOf(seed);
            const s = createState(deps);
            for (let round = 1; round <= 5; round++) {
                const plan = oracleSolve(render(s), PARAMS.maxMoves, 600000);
                if (plan === null) break;
                const before = s.moves;
                const bonusBefore = s.bonusCount;
                const res = plan.map((dir) => move(s, dir, deps)).at(-1);
                if (!res?.bonus || s.bonusCount !== bonusBefore + 1) {
                    expect.fail(`seed ${seed}, round ${round}: the shortest way did not earn the bonus`);
                }
                const expected = Math.min(PARAMS.maxMoves, before - plan.length + PARAMS.movesPerLine + PARAMS.shortestBonus);
                if (s.moves !== expected) expect.fail(`seed ${seed}, round ${round}: moves ${s.moves}, expected ${expected}`);
                rounds++;
            }
        }
        expect(rounds).toBeGreaterThan(80);
    }, 300000);
});
