import { describe, expect, it } from 'vitest';
import { __test__, evaluateDifficulty, rankFromScore, type BoardState } from './evaluateDifficulty';

// The solver only applies two rules (single-clue and subset). These tests check it against the
// real mine layout and, on small boards, a brute-force enumeration of every consistent layout.

const { computeClues, getNeighbors, runSolver } = __test__;

const lcg = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const boardOfSize = (seed: number, width: number, height: number): BoardState => {
    const rng = lcg(seed * 7 + width * 131 + height);
    const startIndex = Math.floor(rng() * width * height);
    const zone = new Set([startIndex, ...getNeighbors(startIndex, width, height)]);
    const density = 0.1 + rng() * 0.3;

    return {
        width,
        height,
        startIndex,
        cells: Array.from({ length: width * height }, (_, i) => ({ hasMine: !zone.has(i) && rng() < density }))
    };
};

const randomBoard = (seed: number, minSize = 3, maxSize = 8): BoardState => {
    const rng = lcg(seed);
    const width = minSize + Math.floor(rng() * (maxSize - minSize + 1));
    const height = minSize + Math.floor(rng() * (maxSize - minSize + 1));

    return boardOfSize(seed, width, height);
};

const startZone = (board: BoardState): number[] => [
    board.startIndex,
    ...getNeighbors(board.startIndex, board.width, board.height)
];

describe('runSolver against the real mine layout', () => {
    it.each([false, true])('never marks a mine safe or a safe cell as a mine (advanced rule: %s)', (useAdvanced) => {
        let deducedMines = 0;

        for (let seed = 1; seed <= 2000; seed += 1) {
            const board = randomBoard(seed, 3, 10);
            const result = runSolver(board, computeClues(board), useAdvanced);
            const where = `seed=${seed} ${board.width}x${board.height} start=${board.startIndex}`;

            for (const cell of result.knownSafe) {
                if (board.cells[cell].hasMine) {
                    expect.fail(`${where}: mine at ${cell} reported safe`);
                }
            }
            for (const cell of result.knownMine) {
                if (!board.cells[cell].hasMine) {
                    expect.fail(`${where}: safe cell ${cell} reported as a mine`);
                }
            }
            deducedMines += result.knownMine.size;
        }

        expect(deducedMines).toBeGreaterThan(500);
    });

    it('starts from the whole start zone being safe, and never reports a cell as both safe and a mine', () => {
        for (let seed = 1; seed <= 500; seed += 1) {
            const board = randomBoard(seed);
            const result = runSolver(board, computeClues(board), true);

            for (const cell of startZone(board)) {
                expect(result.knownSafe.has(cell), `seed=${seed} zone cell ${cell}`).toBe(true);
            }
            expect([...result.knownMine].some((cell) => result.knownSafe.has(cell)), `seed=${seed}`).toBe(false);
        }
    });

    it('counts one step per deduced cell, and the advanced rule only adds to what the basic rule finds', () => {
        for (let seed = 1; seed <= 1000; seed += 1) {
            const board = randomBoard(seed, 3, 10);
            const clues = computeClues(board);
            const basic = runSolver(board, clues, false);
            const full = runSolver(board, clues, true);
            const zoneSize = new Set(startZone(board)).size;
            const where = `seed=${seed}`;

            expect(basic.advancedSteps, where).toBe(0);
            for (const result of [basic, full]) {
                expect(result.knownSafe.size + result.knownMine.size - zoneSize, where).toBe(
                    result.basicSteps + result.advancedSteps
                );
                const steps = result.basicSteps + result.advancedSteps;
                // Every level of a chain is one productive pass, and a pass deduces at least one cell.
                expect(result.maxChainDepth > 0, where).toBe(steps > 0);
                expect(result.maxChainDepth, where).toBeLessThanOrEqual(steps);
            }
            expect([...basic.knownSafe].every((cell) => full.knownSafe.has(cell)), where).toBe(true);
            expect([...basic.knownMine].every((cell) => full.knownMine.has(cell)), where).toBe(true);
        }
    });
});

describe('runSolver against a brute-force enumeration', () => {
    // Every mine layout that keeps the start zone empty and shows the same clues as the real board
    // on every cell the solver treats as opened.
    const consistentLayouts = (board: BoardState, opened: Set<number>): number[] => {
        const cells = board.cells.length;
        const neighborMasks = Array.from({ length: cells }, (_, i) =>
            getNeighbors(i, board.width, board.height).reduce((mask, n) => mask | (1 << n), 0)
        );
        const popcount = (value: number): number => {
            let count = 0;
            for (let rest = value; rest !== 0; rest &= rest - 1) {
                count += 1;
            }
            return count;
        };
        const truth = board.cells.reduce((mask, cell, i) => (cell.hasMine ? mask | (1 << i) : mask), 0);
        const layouts: number[] = [];
        for (let layout = 0; layout < 1 << cells; layout += 1) {
            let consistent = true;
            for (const cell of opened) {
                if (((layout >> cell) & 1) === 1 || popcount(layout & neighborMasks[cell]) !== popcount(truth & neighborMasks[cell])) {
                    consistent = false;
                    break;
                }
            }
            if (consistent) {
                layouts.push(layout);
            }
        }

        return layouts;
    };

    it.each([
        [3, 4],
        [4, 4]
    ])('everything it deduces on %ix%i boards is certain given the cells it opened', (width, height) => {
        let checked = 0;
        let deduced = 0;

        for (let seed = 1; seed <= 150; seed += 1) {
            const board = boardOfSize(seed, width, height);
            const result = runSolver(board, computeClues(board), true);
            const layouts = consistentLayouts(board, result.knownSafe);

            for (const cell of result.knownMine) {
                if (!layouts.every((layout) => (layout >> cell) & 1)) {
                    expect.fail(`seed=${seed}: mine ${cell} is not certain`);
                }
            }
            for (const cell of result.knownSafe) {
                if (!layouts.every((layout) => ((layout >> cell) & 1) === 0)) {
                    expect.fail(`seed=${seed}: safe ${cell} is not certain`);
                }
            }
            checked += 1;
            deduced += result.knownMine.size;
        }

        expect(checked).toBe(150);
        expect(deduced).toBeGreaterThan(0);
    });
});

describe('evaluateDifficulty', () => {
    it('reports evidence that is consistent with the solver and the score formula', () => {
        for (let seed = 1; seed <= 500; seed += 1) {
            const board = randomBoard(seed, 3, 10);
            const outcome = evaluateDifficulty({ board });
            const where = `seed=${seed}`;

            expect(outcome.ok, where).toBe(true);
            if (!outcome.ok) {
                continue;
            }
            const { rank, evidence, logicallySolvable } = outcome.value;
            const full = runSolver(board, computeClues(board), true);
            const basicOnly = runSolver(board, computeClues(board), false);
            const mines = board.cells.filter((cell) => cell.hasMine).length;
            const safeCells = board.cells.length - mines;
            const unresolved = board.cells.filter((cell, i) => !cell.hasMine && !basicOnly.knownSafe.has(i)).length;

            expect(evidence.B, where).toBe(full.basicSteps);
            expect(evidence.A, where).toBe(full.advancedSteps);
            expect(evidence.C, where).toBe(full.maxChainDepth);
            expect(evidence.U, where).toBeCloseTo(safeCells === 0 ? 0 : unresolved / safeCells, 12);
            expect(evidence.D, where).toBe(
                Math.round(
                    100 *
                        (0.2 * Math.min(evidence.B / 120, 1) +
                            0.35 * Math.min(evidence.A / 60, 1) +
                            0.25 * Math.min(evidence.C / 20, 1) +
                            0.2 * evidence.U)
                )
            );
            expect(evidence.D, where).toBeGreaterThanOrEqual(0);
            expect(evidence.D, where).toBeLessThanOrEqual(100);
            expect(rank, where).toBe(rankFromScore(evidence.D));
            expect(evidence.requiresGuess, where).toBe(!logicallySolvable);

            // "Logically solvable" means every cell is decided, and decided correctly.
            expect(logicallySolvable, where).toBe(full.knownSafe.size + full.knownMine.size === board.cells.length);
            if (logicallySolvable) {
                expect([...full.knownMine].sort((a, b) => a - b), where).toEqual(
                    board.cells.flatMap((cell, i) => (cell.hasMine ? [i] : []))
                );
            }
        }
    });

    it('is not solvable and needs a guess when a cell touches no opened clue', () => {
        // A 2x5 board: the start zone covers columns 0-1, and the mine in the last column is never
        // touched by an opened cell, so it cannot be deduced.
        const board: BoardState = {
            width: 5,
            height: 2,
            startIndex: 0,
            cells: Array.from({ length: 10 }, (_, i) => ({ hasMine: i === 9 }))
        };
        const outcome = evaluateDifficulty({ board });

        expect(outcome.ok && outcome.value.logicallySolvable).toBe(false);
        expect(outcome.ok && outcome.value.evidence.requiresGuess).toBe(true);
    });

    it('is deterministic and does not modify its input', () => {
        const board = randomBoard(7, 6, 8);
        const snapshot = structuredClone(board);

        expect(evaluateDifficulty({ board })).toEqual(evaluateDifficulty({ board }));
        expect(board).toEqual(snapshot);
    });
});

describe('rankFromScore', () => {
    it.each([
        [-10, 'Easy'],
        [0, 'Easy'],
        [24, 'Easy'],
        [25, 'Normal'],
        [49, 'Normal'],
        [50, 'Hard'],
        [74, 'Hard'],
        [75, 'Expert'],
        [100, 'Expert']
    ])('ranks a score of %i as %s', (score, rank) => {
        expect(rankFromScore(score)).toBe(rank);
    });
});

describe('evaluateDifficulty input validation boundaries', () => {
    const emptyBoard = (width: number, height: number, startIndex = 0): BoardState => ({
        width,
        height,
        startIndex,
        cells: Array.from({ length: width * height }, () => ({ hasMine: false }))
    });

    it.each([
        [2, 2],
        [50, 50],
        [2, 50],
        [50, 2]
    ])('accepts a %ix%i board', (width, height) => {
        expect(evaluateDifficulty({ board: emptyBoard(width, height) }).ok).toBe(true);
    });

    // The cell array matches width x height, so only the size check itself can reject these.
    it.each([
        [1, 5],
        [5, 1],
        [51, 5],
        [5, 51],
        [0, 0],
        [1, 1],
        [51, 51]
    ])('rejects a %i x %i board as INVALID_BOARD', (width, height) => {
        expect(evaluateDifficulty({ board: emptyBoard(width, height) })).toMatchObject({
            ok: false,
            code: 'INVALID_BOARD',
            message: 'Board size must be an integer between 2 and 50.'
        });
    });

    it.each([
        [2.5, 4],
        [4, Number.NaN],
        [Infinity, 3]
    ])('rejects a non-integer %s x %s board as INVALID_BOARD', (width, height) => {
        const cellCount = Number.isInteger(width * height) && Number.isFinite(width * height) ? width * height : 0;
        const board = {
            ...emptyBoard(3, 3),
            width,
            height,
            cells: Array.from({ length: cellCount }, () => ({ hasMine: false }))
        };

        expect(evaluateDifficulty({ board })).toMatchObject({
            ok: false,
            code: 'INVALID_BOARD',
            message: 'Board size must be an integer between 2 and 50.'
        });
    });

    it('rejects a board whose cell count does not match its size', () => {
        const board = { ...emptyBoard(4, 4), width: 5 };

        expect(evaluateDifficulty({ board })).toMatchObject({
            ok: false,
            code: 'INVALID_BOARD',
            message: 'Cell length does not match board dimensions.'
        });
    });

    it.each([-1, 9, 1.5, Number.NaN])('rejects startIndex %s as INVALID_START', (startIndex) => {
        expect(evaluateDifficulty({ board: emptyBoard(3, 3, startIndex) })).toMatchObject({
            ok: false,
            code: 'INVALID_START'
        });
    });

    it('accepts the first and last cell as the start, including corners whose start zone is smaller', () => {
        expect(evaluateDifficulty({ board: emptyBoard(4, 4, 0) }).ok).toBe(true);
        expect(evaluateDifficulty({ board: emptyBoard(4, 4, 15) }).ok).toBe(true);
    });

    it('rejects a mine on the start cell or on any neighbor of it', () => {
        for (const cell of [4, 0, 1, 2, 3, 5, 6, 7, 8]) {
            const board = emptyBoard(3, 3, 4);
            board.cells[cell].hasMine = true;

            expect(evaluateDifficulty({ board }), `mine at ${cell}`).toMatchObject({
                ok: false,
                code: 'CONSTRAINT_VIOLATION'
            });
        }
    });

    it('allows a mine just outside the start zone', () => {
        const board = emptyBoard(5, 5, 0);
        board.cells[12].hasMine = true;

        expect(evaluateDifficulty({ board }).ok).toBe(true);
    });
});
