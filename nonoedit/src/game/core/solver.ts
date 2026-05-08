import type { AnalysisResult, BinaryCell, DifficultyRank, SolveTechnique } from './types';

type KnownCell = BinaryCell | null;

type LineContext = {
    hints: number[];
    known: KnownCell[];
    maxMillis: number;
    startTime: number;
};

const weights: Record<SolveTechnique, number> = {
    'full-line-fill': 1,
    'full-line-empty': 1,
    'edge-overlap': 2,
    'candidate-common': 5,
};

const orderedTechniques: SolveTechnique[] = [
    'full-line-fill',
    'full-line-empty',
    'edge-overlap',
    'candidate-common',
];

const now = (): number => Date.now();

const elapsed = (startedAt: number): number => now() - startedAt;

const isTimeout = (startedAt: number, maxMillis: number): boolean => elapsed(startedAt) >= maxMillis;

const normalizeHints = (hints: number[]): number[] => (hints.length === 1 && hints[0] === 0 ? [] : hints.slice());

const sum = (arr: number[]): number => arr.reduce((acc, cur) => acc + cur, 0);

const matchesKnown = (candidate: BinaryCell[], known: KnownCell[]): boolean => {
    for (let i = 0; i < candidate.length; i += 1) {
        if (known[i] !== null && candidate[i] !== known[i]) {
            return false;
        }
    }
    return true;
};

const generateCandidates = (ctx: LineContext): BinaryCell[][] => {
    const hints = normalizeHints(ctx.hints);
    const length = ctx.known.length;

    if (hints.length === 0) {
        const allZero = Array.from({ length }, () => 0 as BinaryCell);
        return matchesKnown(allZero, ctx.known) ? [allZero] : [];
    }

    const candidates: BinaryCell[][] = [];

    const dfs = (index: number, hintIndex: number, line: BinaryCell[]): void => {
        if (isTimeout(ctx.startTime, ctx.maxMillis)) {
            return;
        }
        if (hintIndex === hints.length) {
            for (let i = index; i < length; i += 1) {
                line[i] = 0;
            }
            if (matchesKnown(line, ctx.known)) {
                candidates.push(line.slice() as BinaryCell[]);
            }
            return;
        }

        const blockLen = hints[hintIndex];
        const remainingHints = hints.slice(hintIndex + 1);
        const minRemaining = remainingHints.length > 0 ? sum(remainingHints) + remainingHints.length : 0;
        const maxStart = length - blockLen - minRemaining;

        for (let start = index; start <= maxStart; start += 1) {
            const next = line.slice() as BinaryCell[];
            for (let i = index; i < start; i += 1) {
                next[i] = 0;
            }
            for (let i = start; i < start + blockLen; i += 1) {
                next[i] = 1;
            }

            const nextIndex = start + blockLen;
            if (hintIndex < hints.length - 1) {
                next[nextIndex] = 0;
                dfs(nextIndex + 1, hintIndex + 1, next);
            } else {
                dfs(nextIndex, hintIndex + 1, next);
            }
        }
    };

    dfs(0, 0, Array.from({ length }, () => 0 as BinaryCell));
    return candidates;
};

const applyFullLineFill = (ctx: LineContext): { updates: Array<[number, BinaryCell]> } => {
    const hints = normalizeHints(ctx.hints);
    if (hints.length === 0) {
        return { updates: [] };
    }
    if (sum(hints) + hints.length - 1 !== ctx.known.length) {
        return { updates: [] };
    }

    const updates: Array<[number, BinaryCell]> = [];
    let cursor = 0;
    for (let h = 0; h < hints.length; h += 1) {
        for (let i = 0; i < hints[h]; i += 1) {
            if (ctx.known[cursor] === null) {
                updates.push([cursor, 1]);
            }
            cursor += 1;
        }
        if (h < hints.length - 1) {
            cursor += 1;
        }
    }
    return { updates };
};

const applyFullLineEmpty = (ctx: LineContext): { updates: Array<[number, BinaryCell]> } => {
    const hints = normalizeHints(ctx.hints);
    const targetFilled = sum(hints);
    const currentFilled = ctx.known.filter((v) => v === 1).length;
    if (currentFilled !== targetFilled) {
        return { updates: [] };
    }

    const updates: Array<[number, BinaryCell]> = [];
    for (let i = 0; i < ctx.known.length; i += 1) {
        if (ctx.known[i] === null) {
            updates.push([i, 0]);
        }
    }
    return { updates };
};

const leftMostPlacement = (hints: number[], length: number): BinaryCell[] => {
    const out = Array.from({ length }, () => 0 as BinaryCell);
    const norm = normalizeHints(hints);
    if (norm.length === 0) {
        return out;
    }
    let cursor = 0;
    for (let h = 0; h < norm.length; h += 1) {
        for (let i = 0; i < norm[h]; i += 1) {
            out[cursor] = 1;
            cursor += 1;
        }
        if (h < norm.length - 1) {
            cursor += 1;
        }
    }
    return out;
};

const rightMostPlacement = (hints: number[], length: number): BinaryCell[] => {
    const reversed = leftMostPlacement([...hints].reverse(), length).reverse();
    return reversed as BinaryCell[];
};

const applyEdgeOverlap = (ctx: LineContext): { updates: Array<[number, BinaryCell]> } => {
    const hints = normalizeHints(ctx.hints);
    if (hints.length === 0) {
        return { updates: [] };
    }

    const left = leftMostPlacement(hints, ctx.known.length);
    const right = rightMostPlacement(hints, ctx.known.length);
    const updates: Array<[number, BinaryCell]> = [];

    for (let i = 0; i < ctx.known.length; i += 1) {
        if (ctx.known[i] === null && left[i] === 1 && right[i] === 1) {
            updates.push([i, 1]);
        }
    }
    return { updates };
};

const applyCandidateCommon = (ctx: LineContext): { updates: Array<[number, BinaryCell]> } => {
    const candidates = generateCandidates(ctx);
    if (candidates.length === 0) {
        return { updates: [] };
    }

    const updates: Array<[number, BinaryCell]> = [];
    for (let i = 0; i < ctx.known.length; i += 1) {
        if (ctx.known[i] !== null) {
            continue;
        }
        const value = candidates[0][i];
        let allSame = true;
        for (let c = 1; c < candidates.length; c += 1) {
            if (candidates[c][i] !== value) {
                allSame = false;
                break;
            }
        }
        if (allSame) {
            updates.push([i, value]);
        }
    }
    return { updates };
};

const applyTechnique = (tech: SolveTechnique, ctx: LineContext): { updates: Array<[number, BinaryCell]> } => {
    if (tech === 'full-line-fill') {
        return applyFullLineFill(ctx);
    }
    if (tech === 'full-line-empty') {
        return applyFullLineEmpty(ctx);
    }
    if (tech === 'edge-overlap') {
        return applyEdgeOverlap(ctx);
    }
    return applyCandidateCommon(ctx);
};

const countUnknown = (grid: KnownCell[][]): number => {
    let count = 0;
    for (const row of grid) {
        for (const cell of row) {
            if (cell === null) {
                count += 1;
            }
        }
    }
    return count;
};

const isGridConsistent = (grid: KnownCell[][], rowHints: number[][], colHints: number[][], maxMillis: number, startedAt: number): boolean => {
    const width = grid[0].length;
    const height = grid.length;

    for (let y = 0; y < height; y += 1) {
        if (isTimeout(startedAt, maxMillis)) {
            return false;
        }
        const candidates = generateCandidates({ hints: rowHints[y], known: grid[y], maxMillis, startTime: startedAt });
        if (candidates.length === 0) {
            return false;
        }
    }

    for (let x = 0; x < width; x += 1) {
        if (isTimeout(startedAt, maxMillis)) {
            return false;
        }
        const known: KnownCell[] = [];
        for (let y = 0; y < height; y += 1) {
            known.push(grid[y][x]);
        }
        const candidates = generateCandidates({ hints: colHints[x], known, maxMillis, startTime: startedAt });
        if (candidates.length === 0) {
            return false;
        }
    }

    return true;
};

const estimateDifficulty = (score: number, logical: boolean): DifficultyRank => {
    if (!logical) {
        return 'unsolved';
    }
    if (score <= 20) {
        return 'easy';
    }
    if (score <= 60) {
        return 'normal';
    }
    return 'hard';
};

export const analyzePuzzle = (solution: BinaryCell[][], rowHints: number[][], colHints: number[][], maxMillis = 3000): AnalysisResult => {
    const startedAt = now();
    const height = solution.length;
    const width = solution[0]?.length ?? 0;
    const known: KnownCell[][] = Array.from({ length: height }, () => Array.from({ length: width }, () => null));
    const techniquesUsed: Partial<Record<SolveTechnique, number>> = {};

    let progressed = true;
    let timedOut = false;

    while (progressed && !timedOut) {
        progressed = false;

        for (const tech of orderedTechniques) {
            if (isTimeout(startedAt, maxMillis)) {
                timedOut = true;
                break;
            }

            for (let y = 0; y < height; y += 1) {
                const result = applyTechnique(tech, {
                    hints: rowHints[y],
                    known: known[y],
                    maxMillis,
                    startTime: startedAt,
                });
                let lineProgressed = false;
                for (const [x, value] of result.updates) {
                    if (known[y][x] === null) {
                        known[y][x] = value;
                        lineProgressed = true;
                        progressed = true;
                    }
                }
                if (lineProgressed) {
                    techniquesUsed[tech] = (techniquesUsed[tech] ?? 0) + 1;
                }
            }

            for (let x = 0; x < width; x += 1) {
                const line: KnownCell[] = [];
                for (let y = 0; y < height; y += 1) {
                    line.push(known[y][x]);
                }
                const result = applyTechnique(tech, {
                    hints: colHints[x],
                    known: line,
                    maxMillis,
                    startTime: startedAt,
                });
                let lineProgressed = false;
                for (const [y, value] of result.updates) {
                    if (known[y][x] === null) {
                        known[y][x] = value;
                        lineProgressed = true;
                        progressed = true;
                    }
                }
                if (lineProgressed) {
                    techniquesUsed[tech] = (techniquesUsed[tech] ?? 0) + 1;
                }
            }
        }
    }

    const remainingCells = countUnknown(known);
    const logical = !timedOut && remainingCells === 0;
    // Validate by counting up to 2 solutions with backtracking.
    let solutions = 0;
    const search = (grid: KnownCell[][]): void => {
        if (timedOut || isTimeout(startedAt, maxMillis) || solutions >= 2) {
            return;
        }

        // Find first unknown.
        let targetX = -1;
        let targetY = -1;
        for (let y = 0; y < height && targetY < 0; y += 1) {
            for (let x = 0; x < width; x += 1) {
                if (grid[y][x] === null) {
                    targetY = y;
                    targetX = x;
                    break;
                }
            }
        }

        if (targetY < 0) {
            if (isGridConsistent(grid, rowHints, colHints, maxMillis, startedAt)) {
                solutions += 1;
            }
            return;
        }

        for (const value of [0, 1] as BinaryCell[]) {
            const next = grid.map((row) => row.slice()) as KnownCell[][];
            next[targetY][targetX] = value;
            if (!isGridConsistent(next, rowHints, colHints, maxMillis, startedAt)) {
                continue;
            }
            search(next);
        }
    };

    const seed = known.map((row) => row.slice()) as KnownCell[][];
    search(seed);

    if (isTimeout(startedAt, maxMillis)) {
        timedOut = true;
    }

    const solvable = !timedOut && solutions > 0;
    const unique = !timedOut && solutions === 1;

    let score = 0;
    for (const tech of orderedTechniques) {
        score += (techniquesUsed[tech] ?? 0) * weights[tech];
    }

    const difficulty = estimateDifficulty(score, logical && solvable);

    return {
        solvable,
        unique,
        logical,
        remainingCells,
        techniquesUsed,
        score,
        difficulty,
        timedOut,
    };
};
