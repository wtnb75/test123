import type { DemoGame, DemoOptions } from 'title-demo';
import { C } from './palette';
import {
    createTurnSlots,
    evaluateProgress,
    findShortestSolutionFromOptions,
    OPERATION_POOL,
    type HistoryEntry,
    type Operation,
    type ProgressState,
    type TurnSlot
} from './logic';

/** The rows of the demo board. */
export const DEMO_TURNS = 5;
/** Rounds (one puzzle each) in one run, before the demo fades and starts again. */
export const DEMO_ROUNDS = 2;
/** Between two selections of one round. */
export const DEMO_STEP_MS = 700;
/** A run's start, a round's end (the result is shown) and a rebuild's end. */
export const DEMO_WAIT_MS = 1500;
export const DEMO_FADE_MS = 400;
/** The puzzle ranges are the ones of Lv.1. */
export const DEMO_INITIAL_MIN = 1;
export const DEMO_INITIAL_MAX = 5;
export const DEMO_TARGET_MIN = 20;
export const DEMO_TARGET_MAX = 50;
/** A puzzle needs at least this many non-skip turns in its shortest solution. */
export const DEMO_MIN_OPS = 2;
/** How many times a puzzle is drawn again before the fallback (as the Game does). */
export const DEMO_ATTEMPTS = 200;
/** The chance that a correct selection is first made wrong (one is forced when none is drawn). */
export const DEMO_MISTAKE_RATE = 0.4;
/** The most wrong selections in one round. */
export const DEMO_MAX_MISTAKES = 2;

export const DEMO_OPTIONS: DemoOptions = {
    rounds: DEMO_ROUNDS,
    timing: { stepMs: DEMO_STEP_MS, waitMs: DEMO_WAIT_MS, fadeMs: DEMO_FADE_MS }
};

export interface DemoPuzzle {
    initial: number;
    target: number;
    slots: TurnSlot[];
    /** The shortest solution: one entry per turn up to the one that reaches the target. */
    path: HistoryEntry[];
}

export interface DemoState extends DemoPuzzle {
    progress: ProgressState;
    result: 'playing' | 'won';
    /** A wrong selection was made and is not fixed yet. */
    wrong: boolean;
}

/** `pick`: the right operation; `mistake` / `fix`: a wrong one and its correction; `hold`: a step of waiting. */
export type DemoActionKind = 'pick' | 'mistake' | 'hold' | 'fix';

export interface DemoAction {
    kind: DemoActionKind;
    turn: number;
    operation: Operation | null;
}

export interface DemoDetail {
    kind: DemoActionKind;
    turn: number;
    won: boolean;
}

const randomBetween = (rng: () => number, min: number, max: number): number => Math.floor(rng() * (max - min + 1)) + min;

const countOperations = (path: HistoryEntry[]): number => path.filter((entry) => entry.operation !== null).length;

/** A puzzle with a solution that uses at least `DEMO_MIN_OPS` operations (or the one-step fallback). */
export const createDemoPuzzle = (rng: () => number): DemoPuzzle => {
    for (let attempt = 0; attempt < DEMO_ATTEMPTS; attempt += 1) {
        const initial = randomBetween(rng, DEMO_INITIAL_MIN, DEMO_INITIAL_MAX);
        const target = randomBetween(rng, DEMO_TARGET_MIN, DEMO_TARGET_MAX);
        const slots = createTurnSlots(DEMO_TURNS, OPERATION_POOL, rng);
        const path = findShortestSolutionFromOptions(initial, target, slots.map((slot) => slot.options));

        if (path !== null && countOperations(path) >= DEMO_MIN_OPS) {
            return { initial, target, slots, path };
        }
    }

    // The same fallback as the Game: one turn is enough, so the board is always solvable.
    const initial = randomBetween(rng, DEMO_INITIAL_MIN, DEMO_INITIAL_MAX);
    const slots = createTurnSlots(DEMO_TURNS, OPERATION_POOL, rng);
    const operation = slots[0].options[0];
    const target = operation.apply(initial);

    return { initial, target, slots, path: [{ operation, resultValue: target, options: slots[0].options }] };
};

const newState = (rng: () => number): DemoState => {
    const puzzle = createDemoPuzzle(rng);

    return {
        ...puzzle,
        progress: evaluateProgress(puzzle.initial, puzzle.target, puzzle.slots),
        result: 'playing',
        wrong: false
    };
};

/** Whether the board reaches the target with these selections (one per turn). */
const reachesTarget = (state: DemoPuzzle, selections: Array<Operation | null>): boolean =>
    evaluateProgress(state.initial, state.target, state.slots.map((slot, index) => ({ options: slot.options, selected: selections[index] }))).won;

/**
 * One round of the bot: the shortest solution's operations in a random order, some of them first picked wrong,
 * held for a step, and fixed. A wrong pick never reaches the target (the round must not be won by a mistake).
 */
export const planRound = (state: DemoPuzzle, rng: () => number): DemoAction[] => {
    const correct: Array<{ turn: number; operation: Operation }> = [];

    state.path.forEach((entry, turn) => {
        if (entry.operation !== null) {
            correct.push({ turn, operation: entry.operation });
        }
    });

    for (let index = correct.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(rng() * (index + 1));
        [correct[index], correct[swap]] = [correct[swap], correct[index]];
    }

    const candidates = correct.map(() => false);
    let chosen = 0;

    correct.forEach((_, index) => {
        if (rng() < DEMO_MISTAKE_RATE && chosen < DEMO_MAX_MISTAKES) {
            candidates[index] = true;
            chosen += 1;
        }
    });

    if (chosen === 0) {
        candidates[Math.floor(rng() * correct.length)] = true;
    }

    const selections: Array<Operation | null> = state.slots.map(() => null);
    const actions: DemoAction[] = [];

    correct.forEach(({ turn, operation }, index) => {
        const wrongs = candidates[index]
            ? state.slots[turn].options.filter((option) => option.label !== operation.label && !reachesTarget(state, selections.map((current, at) => (at === turn ? option : current))))
            : [];

        if (wrongs.length > 0) {
            const wrong = wrongs[Math.floor(rng() * wrongs.length)];
            actions.push(
                { kind: 'mistake', turn, operation: wrong },
                { kind: 'hold', turn, operation: null },
                { kind: 'fix', turn, operation }
            );
        } else {
            actions.push({ kind: 'pick', turn, operation });
        }

        selections[turn] = operation;
    });

    return actions;
};

/** The game the `DemoDirector` plays: a bot that picks the shortest solution's operations in a random order. */
export const createDemoGame = (rng: () => number): DemoGame<DemoState, DemoAction, DemoDetail> => ({
    start: () => newState(rng),

    plan: (state) => planRound(state, rng),

    play: (state, action) => {
        const detail = (won: boolean): DemoDetail => ({ kind: action.kind, turn: action.turn, won });

        if (state.result === 'won') {
            return { moved: false, roundDone: false, detail: detail(true) };
        }

        if (action.kind === 'hold') {
            return { moved: true, roundDone: false, detail: detail(false) };
        }

        state.slots[action.turn].selected = action.operation;
        state.progress = evaluateProgress(state.initial, state.target, state.slots);
        const won = state.progress.won;

        if (action.kind === 'mistake') {
            state.wrong = true;
        } else if (action.kind === 'fix') {
            state.wrong = false;
        }

        if (won) {
            state.result = 'won';
            state.wrong = false;
        }

        return { moved: true, roundDone: won, detail: detail(won) };
    },

    advance: (state) => {
        Object.assign(state, newState(rng));
    }
});

/** Geometry of the Title (canvas 480 x 960); the demo board uses the Game's own row geometry. */
export const TITLE_LAYOUT = {
    nameY: 192,
    taglineY: 250,
    regionTop: 300,
    regionBottom: 780,
    startY: 806,
    startWidth: 200,
    startHeight: 60,
    hintY: 883,
    headerHeight: 48,
    headerGap: 12,
    rowHeight: 50,
    statusHeight: 40,
    buttonCenters: [40, 120, 200, 280, 360],
    buttonWidth: 72,
    buttonHeight: 28,
    valueX: 404
} as const;

export interface DemoBoardLayout {
    blockTop: number;
    tableTop: number;
    panelHeight: number;
    rowCenters: number[];
    statusY: number;
}

export const computeDemoBoardLayout = (): DemoBoardLayout => {
    const { regionTop, regionBottom, headerHeight, headerGap, rowHeight, statusHeight } = TITLE_LAYOUT;
    const panelHeight = DEMO_TURNS * rowHeight;
    const blockHeight = headerHeight + headerGap + panelHeight + statusHeight;
    const blockTop = regionTop + Math.floor((regionBottom - regionTop - blockHeight) / 2);
    const tableTop = blockTop + headerHeight + headerGap;

    return {
        blockTop,
        tableTop,
        panelHeight,
        rowCenters: Array.from({ length: DEMO_TURNS }, (_, index) => tableTop + rowHeight / 2 + index * rowHeight),
        statusY: tableTop + panelHeight + 26
    };
};

export const DEMO_COLORS = {
    selected: C.SELECTED,
    unselected: C.UNSELECTED,
    skip: C.SKIP,
    disabled: C.DISABLED,
    labelText: '#f8fafc',
    disabledText: '#64748b',
    text: C.TEXT,
    win: C.WIN,
    wrong: C.LOSE
} as const;

export interface DemoButtonView {
    label: string;
    fill: number;
    labelColor: string;
}

export interface DemoRowView {
    value: number;
    buttons: DemoButtonView[];
}

export interface DemoView {
    headerTop: string;
    headerCurrent: string;
    headerCurrentColor: string;
    rows: DemoRowView[];
    status: string;
    statusColor: string;
}

/** What to draw for a state (the Scene only applies it). */
export const describeDemo = (state: DemoState): DemoView => {
    const won = state.result === 'won';

    return {
        headerTop: `目標: ${state.target}  初期値: ${state.initial}`,
        headerCurrent: `現在値: ${state.progress.currentValue}`,
        headerCurrentColor: won ? DEMO_COLORS.win : state.wrong ? DEMO_COLORS.wrong : DEMO_COLORS.text,
        rows: state.slots.map((slot, index) => {
            const row = state.progress.rows[index];
            const choices: Array<Operation | null> = [...slot.options, null];

            return {
                value: row.value,
                buttons: choices.map((operation) => {
                    if (row.isAutoSkip) {
                        return { label: operation?.label ?? '-', fill: DEMO_COLORS.disabled, labelColor: DEMO_COLORS.disabledText };
                    }

                    const selected = operation === null ? slot.selected === null : slot.selected?.label === operation.label;
                    const idle = operation === null ? DEMO_COLORS.skip : DEMO_COLORS.unselected;

                    return {
                        label: operation?.label ?? '-',
                        fill: selected ? DEMO_COLORS.selected : idle,
                        labelColor: DEMO_COLORS.labelText
                    };
                })
            };
        }),
        status: won ? 'クリア!' : '',
        statusColor: DEMO_COLORS.win
    };
};
