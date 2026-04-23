export type DifficultyRank = 'Easy' | 'Normal' | 'Hard' | 'Expert';

export type BoardCell = {
    hasMine: boolean;
};

export type BoardState = {
    width: number;
    height: number;
    cells: BoardCell[];
    startIndex: number;
};

export type DifficultyEvidence = {
    D: number;
    B: number;
    A: number;
    C: number;
    U: number;
    requiresGuess: boolean;
};

export type DifficultyEvaluation = {
    rank: DifficultyRank;
    evidence: DifficultyEvidence;
    logicallySolvable: boolean;
};

export type EvaluateDifficultyInput = {
    board: BoardState;
};

export type EvaluateDifficultyResult =
    | { ok: true; value: DifficultyEvaluation }
    | { ok: false; code: 'INVALID_BOARD' | 'INVALID_START' | 'CONSTRAINT_VIOLATION'; message: string };

type SolveResult = {
    knownSafe: Set<number>;
    knownMine: Set<number>;
    basicSteps: number;
    advancedSteps: number;
    maxChainDepth: number;
};

const OFFSETS = [-1, 0, 1];

function getNeighbors(index: number, width: number, height: number): number[] {
    const x = index % width;
    const y = Math.floor(index / width);
    const out: number[] = [];

    for (const dy of OFFSETS) {
        for (const dx of OFFSETS) {
            if (dx === 0 && dy === 0) {
                continue;
            }
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                continue;
            }
            out.push(ny * width + nx);
        }
    }

    return out;
}

function hasMineInStartZone(board: BoardState): boolean {
    const zone = getNeighbors(board.startIndex, board.width, board.height);
    zone.push(board.startIndex);
    return zone.some((idx) => board.cells[idx]?.hasMine === true);
}

function computeClues(board: BoardState): number[] {
    const clues: number[] = new Array(board.cells.length).fill(0);
    for (let i = 0; i < board.cells.length; i += 1) {
        const neighbors = getNeighbors(i, board.width, board.height);
        let count = 0;
        for (const n of neighbors) {
            if (board.cells[n].hasMine) {
                count += 1;
            }
        }
        clues[i] = count;
    }
    return clues;
}

function applyBasicRule(
    clues: number[],
    board: BoardState,
    knownSafe: Set<number>,
    knownMine: Set<number>
): { changed: boolean; steps: number } {
    let changed = false;
    let steps = 0;

    for (let i = 0; i < board.cells.length; i += 1) {
        // Only revealed-safe cells provide usable clue numbers.
        if (!knownSafe.has(i)) {
            continue;
        }

        const neighbors = getNeighbors(i, board.width, board.height);
        let knownMinesAround = 0;
        const unknown: number[] = [];

        for (const n of neighbors) {
            if (knownMine.has(n)) {
                knownMinesAround += 1;
            } else if (!knownSafe.has(n)) {
                unknown.push(n);
            }
        }

        const remainingMines = clues[i] - knownMinesAround;
        if (remainingMines < 0) {
            continue;
        }

        if (remainingMines === 0 && unknown.length > 0) {
            for (const u of unknown) {
                if (!knownSafe.has(u) && !knownMine.has(u)) {
                    knownSafe.add(u);
                    changed = true;
                    steps += 1;
                }
            }
        } else if (remainingMines === unknown.length && unknown.length > 0) {
            for (const u of unknown) {
                if (!knownMine.has(u) && !knownSafe.has(u)) {
                    knownMine.add(u);
                    changed = true;
                    steps += 1;
                }
            }
        }
    }

    return { changed, steps };
}

type Equation = {
    cells: number[];
    mines: number;
};

function applyAdvancedRule(
    clues: number[],
    board: BoardState,
    knownSafe: Set<number>,
    knownMine: Set<number>
): { changed: boolean; steps: number } {
    const equations: Equation[] = [];

    for (let i = 0; i < board.cells.length; i += 1) {
        // Advanced constraints also must come from revealed-safe clues only.
        if (!knownSafe.has(i)) {
            continue;
        }

        const neighbors = getNeighbors(i, board.width, board.height);
        const unknown: number[] = [];
        let knownMinesAround = 0;

        for (const n of neighbors) {
            if (knownMine.has(n)) {
                knownMinesAround += 1;
            } else if (!knownSafe.has(n)) {
                unknown.push(n);
            }
        }

        const remainingMines = clues[i] - knownMinesAround;
        if (unknown.length === 0 || remainingMines < 0) {
            continue;
        }

        unknown.sort((a, b) => a - b);
        equations.push({ cells: unknown, mines: remainingMines });
    }

    let changed = false;
    let steps = 0;

    for (let i = 0; i < equations.length; i += 1) {
        for (let j = i + 1; j < equations.length; j += 1) {
            const a = equations[i];
            const b = equations[j];

            let sup: Equation;
            let sub: Equation;
            if (isSubset(a.cells, b.cells)) {
                sup = b;
                sub = a;
            } else if (isSubset(b.cells, a.cells)) {
                sup = a;
                sub = b;
            } else {
                continue;
            }

            const diffCells = sup.cells.filter((c) => !sub.cells.includes(c));
            const diffMines = sup.mines - sub.mines;

            if (diffCells.length === 0 || diffMines < 0) {
                continue;
            }

            if (diffMines === 0) {
                for (const c of diffCells) {
                    if (!knownSafe.has(c) && !knownMine.has(c)) {
                        knownSafe.add(c);
                        changed = true;
                        steps += 1;
                    }
                }
            } else if (diffMines === diffCells.length) {
                for (const c of diffCells) {
                    if (!knownMine.has(c) && !knownSafe.has(c)) {
                        knownMine.add(c);
                        changed = true;
                        steps += 1;
                    }
                }
            }
        }
    }

    return { changed, steps };
}

function isSubset(a: number[], b: number[]): boolean {
    if (a.length > b.length) {
        return false;
    }
    const bSet = new Set(b);
    return a.every((x) => bSet.has(x));
}

function runSolver(board: BoardState, clues: number[], useAdvanced: boolean): SolveResult {
    const knownSafe = new Set<number>();
    const knownMine = new Set<number>();

    // Starting zone is guaranteed safe by precondition.
    knownSafe.add(board.startIndex);
    for (const n of getNeighbors(board.startIndex, board.width, board.height)) {
        knownSafe.add(n);
    }

    let basicSteps = 0;
    let advancedSteps = 0;
    let maxChainDepth = 0;

    while (true) {
        let cycleChanged = false;
        let cycleDepth = 0;

        while (true) {
            const basic = applyBasicRule(clues, board, knownSafe, knownMine);
            basicSteps += basic.steps;
            if (!basic.changed) {
                break;
            }
            cycleChanged = true;
            cycleDepth += 1;
        }

        if (useAdvanced) {
            const adv = applyAdvancedRule(clues, board, knownSafe, knownMine);
            advancedSteps += adv.steps;
            if (adv.changed) {
                cycleChanged = true;
                cycleDepth += 1;
            }
        }

        if (cycleDepth > maxChainDepth) {
            maxChainDepth = cycleDepth;
        }

        if (!cycleChanged) {
            break;
        }
    }

    return { knownSafe, knownMine, basicSteps, advancedSteps, maxChainDepth };
}

export const __test__ = {
    getNeighbors,
    computeClues,
    applyBasicRule,
    applyAdvancedRule,
    runSolver,
    hasMineInStartZone,
    isSubset
};

export function rankFromScore(score: number): DifficultyRank {
    if (score <= 24) {
        return 'Easy';
    }
    if (score <= 49) {
        return 'Normal';
    }
    if (score <= 74) {
        return 'Hard';
    }
    return 'Expert';
}

export function evaluateDifficulty(input: EvaluateDifficultyInput): EvaluateDifficultyResult {
    const board = input.board;

    if (
        !Number.isInteger(board.width) ||
        !Number.isInteger(board.height) ||
        board.width < 2 ||
        board.height < 2 ||
        board.width > 50 ||
        board.height > 50
    ) {
        return { ok: false, code: 'INVALID_BOARD', message: 'Board size must be an integer between 2 and 50.' };
    }

    const expected = board.width * board.height;
    if (board.cells.length !== expected) {
        return { ok: false, code: 'INVALID_BOARD', message: 'Cell length does not match board dimensions.' };
    }

    if (!Number.isInteger(board.startIndex) || board.startIndex < 0 || board.startIndex >= expected) {
        return { ok: false, code: 'INVALID_START', message: 'startIndex is out of range.' };
    }

    if (hasMineInStartZone(board)) {
        return {
            ok: false,
            code: 'CONSTRAINT_VIOLATION',
            message: 'Start zone contains one or more mines.'
        };
    }

    const clues = computeClues(board);

    const basicOnly = runSolver(board, clues, false);
    const full = runSolver(board, clues, true);

    const mineCount = board.cells.filter((c) => c.hasMine).length;
    const totalSafe = expected - mineCount;
    let unresolvedSafe = 0;
    for (let i = 0; i < expected; i += 1) {
        if (!board.cells[i].hasMine && !basicOnly.knownSafe.has(i)) {
            unresolvedSafe += 1;
        }
    }

    const U = Math.min(Math.max(unresolvedSafe / Math.max(totalSafe, 1), 0), 1);

    const b = Math.min(full.basicSteps / 120, 1);
    const a = Math.min(full.advancedSteps / 60, 1);
    const c = Math.min(full.maxChainDepth / 20, 1);
    const u = U;

    const D = Math.round(100 * (0.2 * b + 0.35 * a + 0.25 * c + 0.2 * u));
    const rank = rankFromScore(D);

    const logicallySolvable = full.knownSafe.size + full.knownMine.size === expected;
    const requiresGuess = !logicallySolvable;

    return {
        ok: true,
        value: {
            rank,
            logicallySolvable,
            evidence: {
                D,
                B: full.basicSteps,
                A: full.advancedSteps,
                C: full.maxChainDepth,
                U,
                requiresGuess
            }
        }
    };
}
