// The Title demo: a solver-guided auto-play on its own board (docs/spec.md "Title" > "デモ").
// The flow (waits, one action per call, the fade between games) lives in the shared `title-demo` package;
// this file supplies the game: its board, its rules and the plan that clears a line.
// Phaser-free: time is passed in, so tests drive it with plain numbers. The Scene feeds it the clock,
// plays the effects of the events it returns, and draws the board with the opacity it reports.
import { DemoDirector, type DemoGame, type DemoPhase, type Plan as SharedPlan } from 'title-demo';
import { PARAMS } from '../params';
import { createState, move } from './rules';
import { minClearPlan } from './solve';
import type { Deps, Dir, MoveResult, State } from './types';

export type { DemoPhase };
/** A plan to clear a line, `null` when there is none, or `'pending'` while the planner is still working. */
export type Plan = SharedPlan<Dir>;
export type Planner = (state: State) => Plan;

export type DemoEvent =
    /** One move was made: play the effects of `result`. */
    | { kind: 'move'; result: MoveResult }
    /** The board starts fading away: drop the effects that are still playing. */
    | { kind: 'fade-out' }
    /** A fresh initial board replaced the old one (fully transparent now): redraw it. */
    | { kind: 'fade-in' };

export interface DemoTiming {
    stepMs: number;
    waitMs: number;
    /** Lines cleared in one demo game before the board is rebuilt. */
    lines: number;
    fadeMs: number;
}

export interface DemoOptions {
    timing?: DemoTiming;
    planner?: Planner;
    /** Builds the initial board (the rules' `createState` by default). */
    initial?: (deps: Deps) => State;
}

const DEFAULT_TIMING: DemoTiming = {
    stepMs: PARAMS.demoStepMs,
    waitMs: PARAMS.demoWaitMs,
    lines: PARAMS.demoLines,
    fadeMs: PARAMS.demoFadeMs,
};

/** The shortest line-clearing sequence from the current position, found in one go. */
export const solverPlanner: Planner = (state) => minClearPlan(state.grid, state.px, state.py, PARAMS.maxMoves);

export class Demo {
    private readonly director: DemoDirector<State, Dir, MoveResult>;

    constructor(deps: Deps, now: number, options: DemoOptions = {}) {
        const timing = options.timing ?? DEFAULT_TIMING;
        const planner = options.planner ?? solverPlanner;
        const initial = options.initial ?? createState;
        // No undo in the demo: nothing is kept per move.
        const demoDeps: Deps = { ...deps, maxUndo: 0 };
        const game: DemoGame<State, Dir, MoveResult> = {
            start: () => initial(demoDeps),
            plan: planner,
            play: (state, dir) => {
                // The demo has no move budget: it never runs out, whatever the plan costs.
                state.moves = PARAMS.maxMoves;
                const result = move(state, dir, demoDeps);
                // A line is a round: a move that clears two lines counts for two, as the score does.
                const lines = result.clearedRows.length + result.clearedCols.length;
                return { moved: result.moved, roundDone: lines > 0, roundsDone: lines, detail: result };
            },
        };
        this.director = new DemoDirector(
            game,
            { rounds: timing.lines, timing: { stepMs: timing.stepMs, waitMs: timing.waitMs, fadeMs: timing.fadeMs } },
            now,
        );
    }

    get state(): State {
        return this.director.state;
    }

    get phase(): DemoPhase {
        return this.director.phase;
    }

    /** Lines cleared in the current demo game. */
    get lines(): number {
        return this.director.state.score;
    }

    /** 0..1 opacity of the board: it fades out and back in between demo games. */
    opacity(now: number): number {
        return this.director.opacity(now);
    }

    /** Advances to `now`; at most one move per call. Returns what the Scene has to act on, if anything. */
    tick(now: number): DemoEvent | null {
        const event = this.director.tick(now);
        if (event === null) return null;
        switch (event.kind) {
            case 'action':
                return { kind: 'move', result: event.detail };
            case 'fade-out':
                return { kind: 'fade-out' };
            case 'fade-in':
                return { kind: 'fade-in' };
            default:
                return null; // 'advance': pushline has no such step
        }
    }
}
