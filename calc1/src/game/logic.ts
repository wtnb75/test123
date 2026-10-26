export type Operation = {
    label: string;
    apply: (value: number) => number;
};

export const OPERATION_POOL: Operation[] = [
    { label: '+1',  apply: (v) => v + 1  },
    { label: '+2',  apply: (v) => v + 2  },
    { label: '+5',  apply: (v) => v + 5  },
    { label: '+10', apply: (v) => v + 10 },
    { label: '-1',  apply: (v) => v - 1  },
    { label: '-2',  apply: (v) => v - 2  },
    { label: '-5',  apply: (v) => v - 5  },
    { label: '×2',  apply: (v) => v * 2  },
    { label: '×3',  apply: (v) => v * 3  },
    { label: '×5',  apply: (v) => v * 5  },
    { label: '/2',  apply: (v) => Math.floor(v / 2) },
    { label: '/3',  apply: (v) => Math.floor(v / 3) },
];

export type DifficultyLevel = {
    initialValueMin: number;
    initialValueMax: number;
    targetMin: number;
    targetMax: number;
    maxTurns: number;
};

export const DIFFICULTY_TABLE: DifficultyLevel[] = [
    { initialValueMin: 1, initialValueMax: 5,  targetMin: 20,  targetMax: 50,  maxTurns: 12 },
    { initialValueMin: 1, initialValueMax: 10, targetMin: 50,  targetMax: 100, maxTurns: 10 },
    { initialValueMin: 1, initialValueMax: 15, targetMin: 80,  targetMax: 150, maxTurns: 9  },
    { initialValueMin: 1, initialValueMax: 20, targetMin: 100, targetMax: 200, maxTurns: 8  },
    { initialValueMin: 1, initialValueMax: 20, targetMin: 150, targetMax: 300, maxTurns: 8  },
    { initialValueMin: 1, initialValueMax: 20, targetMin: 150, targetMax: 300, maxTurns: 7  },
    { initialValueMin: 1, initialValueMax: 20, targetMin: 150, targetMax: 300, maxTurns: 6  },
];

export const ROUND_TIME_MS = 60000;
export const OPTION_COUNT = 4;
export const LEVEL_STORAGE_KEY = 'calcRushLevel';

export function getDifficulty(level: number): DifficultyLevel {
    const idx = Math.min(level - 1, DIFFICULTY_TABLE.length - 1);
    return DIFFICULTY_TABLE[Math.max(0, idx)];
}

export function pickOperations(pool: Operation[], count: number, rng: () => number = Math.random): Operation[] {
    const source = [...pool];
    for (let i = source.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [source[i], source[j]] = [source[j], source[i]];
    }
    return source.slice(0, count);
}

export function applyOperation(value: number, op: Operation): number {
    return op.apply(value);
}

export function checkWin(current: number, target: number): boolean {
    return current === target;
}

export function loadLevel(_storage: Pick<Storage, 'getItem'>): number {
    // The spec requires startup from Lv.1 always.
    return 1;
}

export function saveLevel(level: number, storage: Pick<Storage, 'setItem'>): void {
    storage.setItem(LEVEL_STORAGE_KEY, String(level));
}

export type TurnSlot = {
    options: Operation[];
    selected: Operation | null;
};

export type ProgressRow = {
    turn: number;
    selected: Operation | null;
    value: number;
    isAutoSkip: boolean;
};

export type ProgressState = {
    currentValue: number;
    won: boolean;
    wonAtTurn: number | null;
    rows: ProgressRow[];
};

export function createTurnSlots(
    turnCount: number,
    pool: Operation[] = OPERATION_POOL,
    rng: () => number = Math.random,
): TurnSlot[] {
    return Array.from({ length: turnCount }, () => ({
        options: pickOperations(pool, OPTION_COUNT, rng),
        selected: null,
    }));
}

export function evaluateProgress(
    initialValue: number,
    targetValue: number,
    slots: TurnSlot[],
): ProgressState {
    let value = initialValue;
    let won = false;
    let wonAtTurn: number | null = null;

    const rows = slots.map((slot, index) => {
        if (won) {
            return {
                turn: index + 1,
                selected: null,
                value,
                isAutoSkip: true,
            };
        }

        if (slot.selected !== null) {
            value = applyOperation(value, slot.selected);
        }

        if (checkWin(value, targetValue)) {
            won = true;
            wonAtTurn = index + 1;
        }

        return {
            turn: index + 1,
            selected: slot.selected,
            value,
            isAutoSkip: false,
        };
    });

    return {
        currentValue: value,
        won,
        wonAtTurn,
        rows,
    };
}

export function handleLossLevelChoice(
    currentLevel: number,
    choice: 'restart' | 'continue',
    storage: Pick<Storage, 'setItem'>,
): number {
    if (choice === 'restart') {
        saveLevel(1, storage);
        return 1;
    }
    return currentLevel;
}

/** Highest level reached in this run: a clear raises it, a loss never lowers it. */
export function nextReachedLevel(reached: number, clearedTo: number): number {
    return Math.max(reached, clearedTo);
}

/** Level after a clear: the next one. */
export function levelAfterClear(level: number): number {
    return level + 1;
}

/** A round still takes input while its clock has not passed the deadline (the deadline itself is still open). */
export function isRoundOpen(nowMs: number, deadlineMs: number): boolean {
    return nowMs <= deadlineMs;
}

// ────────────────────────────────────────────────────────────
// Score of a clear and the best record (docs/spec.md: スコア条件)

export const SCORE_TIME_WEIGHT = 1;
export const SCORE_MOVE_WEIGHT = 2;
export const BEST_STORAGE_KEY = 'calcRushBest';

export type Best = { level: number; score: number };

/** Score = whole seconds left × time weight + (max moves − used moves) × move weight. */
export function computeScore(remainingMs: number, maxMoves: number, usedMoves: number): number {
    const seconds = Math.floor(Math.max(0, remainingMs) / 1000);
    return seconds * SCORE_TIME_WEIGHT + (maxMoves - usedMoves) * SCORE_MOVE_WEIGHT;
}

/** Non-skip selections among the turns up to and including the winning turn (1-based). */
export function countUsedMoves(slots: TurnSlot[], wonAtTurn: number): number {
    return slots.slice(0, wonAtTurn).filter((slot) => slot.selected !== null).length;
}

/** The saved best, or null when there is none or it cannot be read as a best (treated as no save). */
export function loadBest(storage: Pick<Storage, 'getItem'>): Best | null {
    try {
        const raw = storage.getItem(BEST_STORAGE_KEY);
        if (raw === null) return null;
        const parsed = JSON.parse(raw) as Partial<Best> | null;
        if (parsed !== null && typeof parsed === 'object'
            && typeof parsed.level === 'number' && typeof parsed.score === 'number') {
            return { level: parsed.level, score: parsed.score };
        }
        return null;
    } catch {
        return null;
    }
}

/** The candidate replaces the stored best only when its score is strictly higher (ties keep the stored one). */
export function updateBest(stored: Best | null, candidate: Best): Best {
    if (stored === null || candidate.score > stored.score) return candidate;
    return stored;
}

/**
 * The best shown on the clear result: the stored pair when no write is needed, the new pair once it is saved, and
 * null (shown as "ベスト —") when the write fails.
 */
export function bestToShow(stored: Best | null, next: Best, save: (best: Best) => boolean): Best | null {
    if (next === stored) return next;
    return save(next) ? next : null;
}

/**
 * The score of a clear and the best to show on its result. The best's level is the cleared level (N), passed in
 * explicitly, not the level after the clear.
 */
export function clearResult(input: {
    remainingMs: number;
    maxMoves: number;
    usedMoves: number;
    clearedLevel: number;
    stored: Best | null;
    save: (best: Best) => boolean;
}): { score: number; shownBest: Best | null } {
    const score = computeScore(input.remainingMs, input.maxMoves, input.usedMoves);
    const candidate: Best = { level: input.clearedLevel, score };
    const next = updateBest(input.stored, candidate);
    return { score, shownBest: bestToShow(input.stored, next, input.save) };
}

/** Writes the best; false when the storage refuses (the game goes on). */
export function saveBest(best: Best, storage: Pick<Storage, 'setItem'>): boolean {
    try {
        storage.setItem(BEST_STORAGE_KEY, JSON.stringify(best));
        return true;
    } catch {
        return false;
    }
}

// ────────────────────────────────────────────────────────────
// Problem generation with solution path guarantee
// ────────────────────────────────────────────────────────────

export type HistoryEntry = {
    operation: Operation | null;
    resultValue: number;
    options?: Operation[];
};

/**
 * Find a solution path from initial to target using BFS.
 * Returns array of (operation, resultValue) pairs, or null if impossible.
 */
export function findSolutionPath(
    initial: number,
    target: number,
    pool: Operation[],
    maxTurns: number,
): HistoryEntry[] | null {
    if (initial === target) return [];

    interface QueueItem {
        current: number;
        path: HistoryEntry[];
    }

    const visited = new Set<number>();
    const queue: QueueItem[] = [{ current: initial, path: [] }];
    visited.add(initial);

    while (queue.length > 0) {
        const { current, path } = queue.shift()!;

        // Out of turns
        if (path.length >= maxTurns) continue;

        for (const op of pool) {
            const next = applyOperation(current, op);

            // Prune obviously bad branches (prevent overflow)
            if (next < -1000000 || next > 1000000) continue;

            if (next === target) {
                return [...path, {
                    operation: op,
                    resultValue: next,
                    options: [op],
                }];
            }

            if (!visited.has(next)) {
                visited.add(next);
                queue.push({
                    current: next,
                    path: [...path, {
                        operation: op,
                        resultValue: next,
                        options: [op],
                    }],
                });
            }
        }
    }

    return null;
}

/**
 * Find a solution path constrained to the actual options presented each turn.
 * Returns the path, or null if no solution exists within those options.
 */
export function findSolutionFromOptions(
    initial: number,
    target: number,
    turnOptions: Operation[][],
): HistoryEntry[] | null {
    function dfs(
        current: number,
        turnIdx: number,
        path: HistoryEntry[],
    ): HistoryEntry[] | null {
        if (current === target) return path;
        if (turnIdx >= turnOptions.length) return null;

        const opts = turnOptions[turnIdx];
        for (const op of [...opts, null]) {
            if (op === null) {
                const entry: HistoryEntry = { operation: null, resultValue: current, options: opts };
                const result = dfs(current, turnIdx + 1, [...path, entry]);
                if (result !== null) return result;
                continue;
            }
            const next = applyOperation(current, op);
            const entry: HistoryEntry = { operation: op, resultValue: next, options: opts };
            const result = dfs(next, turnIdx + 1, [...path, entry]);
            if (result !== null) return result;
        }
        return null;
    }

    return dfs(initial, 0, []);
}

/**
 * Find the shortest solution path constrained to the actual options presented each turn.
 * "Shortest" means the earliest turn index that can reach the target.
 */
export function findShortestSolutionFromOptions(
    initial: number,
    target: number,
    turnOptions: Operation[][],
): HistoryEntry[] | null {
    if (initial === target) return [];

    type State = {
        turnIdx: number;
        current: number;
        path: HistoryEntry[];
    };

    let frontier: State[] = [{ turnIdx: 0, current: initial, path: [] }];
    const visited = new Set<string>(['0:' + initial]);

    while (frontier.length > 0) {
        const nextFrontier: State[] = [];

        for (const state of frontier) {
            if (state.turnIdx >= turnOptions.length) continue;

            const opts = turnOptions[state.turnIdx];
            for (const op of [...opts, null]) {
                const nextValue = op === null ? state.current : applyOperation(state.current, op);
                const entry: HistoryEntry = {
                    operation: op,
                    resultValue: nextValue,
                    options: opts,
                };
                const nextPath = [...state.path, entry];

                if (nextValue === target) {
                    return nextPath;
                }

                const nextTurn = state.turnIdx + 1;
                const key = `${nextTurn}:${nextValue}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    nextFrontier.push({ turnIdx: nextTurn, current: nextValue, path: nextPath });
                }
            }
        }

        frontier = nextFrontier;
    }

    return null;
}

/**
 * Check if a problem has a solution.
 */
export function canReachTarget(
    initial: number,
    target: number,
    pool: Operation[],
    maxTurns: number,
): boolean {
    return findSolutionPath(initial, target, pool, maxTurns) !== null;
}

// ────────────────────────────────────────────────────────────
// Problem acceptance by the number of winning selection sequences
// ────────────────────────────────────────────────────────────

export type WinCountRange = { min: number; max: number };

/** Per level (the last entry also serves every later level); inclusive bounds. */
export const WIN_COUNT_RANGES: WinCountRange[] = [
    { min: 500000, max: 2200000 },
    { min: 6000, max: 42000 },
    { min: 500, max: 5500 },
    { min: 50, max: 800 },
    { min: 15, max: 480 },
    { min: 3, max: 100 },
    { min: 1, max: 25 },
];

export const MAX_GENERATION_ATTEMPTS = 200;

export function getWinCountRange(level: number): WinCountRange {
    const idx = Math.min(level - 1, WIN_COUNT_RANGES.length - 1);
    return WIN_COUNT_RANGES[Math.max(0, idx)];
}

/**
 * Number of selection sequences that win: choices per turn are the turn's options plus skip, and a sequence is
 * counted once at the first turn where the value equals the target (later turns are auto-skip). Counted per
 * (turn, value) instead of enumerating every sequence.
 */
export function countWinningSequences(initial: number, target: number, turnOptions: Operation[][]): number {
    let counts = new Map<number, number>([[initial, 1]]);
    let wins = 0;
    for (const options of turnOptions) {
        const next = new Map<number, number>();
        for (const [value, n] of counts) {
            const results = options.map((op) => applyOperation(value, op));
            results.push(value); // skip
            for (const result of results) {
                if (result === target) wins += n;
                else next.set(result, (next.get(result) ?? 0) + n);
            }
        }
        counts = next;
    }
    return wins;
}

/** Log distance from a count to the range: 0 inside it. */
export function winCountDistance(count: number, range: WinCountRange): number {
    if (count < range.min) return Math.log(range.min / count);
    if (count > range.max) return Math.log(count / range.max);
    return 0;
}

export type Problem = {
    initialValue: number;
    targetValue: number;
    slots: TurnSlot[];
    shortestPath: HistoryEntry[];
};

const randomBetween = (rng: () => number, min: number, max: number): number =>
    Math.floor(rng() * (max - min + 1)) + min;

/**
 * Makes a solvable problem whose winning-sequence count is in the level's range; after MAX_GENERATION_ATTEMPTS
 * the solvable one closest to the range (earlier on a tie), and only without any solvable one the old fallback.
 */
export function generateProblem(level: number, rng: () => number = Math.random): Problem {
    const diff = getDifficulty(level);
    const range = getWinCountRange(level);
    let closest: { initialValue: number; targetValue: number; slots: TurnSlot[] } | null = null;
    let closestDistance = Infinity;
    const withPath = (p: { initialValue: number; targetValue: number; slots: TurnSlot[] }): Problem => ({
        ...p,
        // A problem with a winning sequence is solvable, so the shortest path exists.
        shortestPath: findShortestSolutionFromOptions(p.initialValue, p.targetValue, p.slots.map((slot) => slot.options))!,
    });
    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
        const initialValue = randomBetween(rng, diff.initialValueMin, diff.initialValueMax);
        const targetValue = randomBetween(rng, diff.targetMin, diff.targetMax);
        const slots = createTurnSlots(diff.maxTurns, OPERATION_POOL, rng);
        const count = countWinningSequences(initialValue, targetValue, slots.map((slot) => slot.options));
        if (count === 0) continue; // unsolvable
        const distance = winCountDistance(count, range);
        if (distance === 0) return withPath({ initialValue, targetValue, slots });
        if (distance < closestDistance) {
            closestDistance = distance;
            closest = { initialValue, targetValue, slots };
        }
    }
    if (closest !== null) return withPath(closest);

    // Safety fallback: always start with a solvable board.
    const initialValue = randomBetween(rng, diff.initialValueMin, diff.initialValueMax);
    const slots = createTurnSlots(diff.maxTurns, OPERATION_POOL, rng);
    const guaranteedOp = slots[0].options[0];
    const targetValue = applyOperation(initialValue, guaranteedOp);
    return {
        initialValue,
        targetValue,
        slots,
        shortestPath: [{ operation: guaranteedOp, resultValue: targetValue, options: slots[0].options }],
    };
}
