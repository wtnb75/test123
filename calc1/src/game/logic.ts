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
