// The Title demo: a solver-guided auto-play on its own board (docs/spec.md "Title" > "デモ").
// Phaser-free: time is passed in, so tests drive it with plain numbers. The Scene feeds it the clock,
// plays the effects of the events it returns, and draws the board with the opacity it reports.
import { PARAMS } from '../params';
import { createState, move } from './rules';
import { minClearPlan } from './solve';
import type { Deps, Dir, MoveResult, State } from './types';

/** `waiting` -> `stepping` -> `waiting` ...; after the last line of a game `fading-out` -> `fading-in` -> `waiting`. */
export type DemoPhase = 'waiting' | 'stepping' | 'fading-out' | 'fading-in';

/** A plan to clear a line, `null` when there is none, or `'pending'` while the planner is still working. */
export type Plan = Dir[] | null | 'pending';
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
    state: State;
    phase: DemoPhase = 'waiting';

    private readonly deps: Deps;
    private readonly timing: DemoTiming;
    private readonly planner: Planner;
    private readonly initial: (deps: Deps) => State;
    /** When the current phase began (a wait's start, the last move's time, a fade's start). */
    private phaseAt: number;
    /** The plan for this wait; undefined until it has been asked for. */
    private plan: Plan | undefined;
    private queue: Dir[] = [];

    constructor(deps: Deps, now: number, options: DemoOptions = {}) {
        // No undo in the demo: nothing is kept per move.
        this.deps = { ...deps, maxUndo: 0 };
        this.timing = options.timing ?? DEFAULT_TIMING;
        this.planner = options.planner ?? solverPlanner;
        this.initial = options.initial ?? createState;
        this.state = this.initial(this.deps);
        this.phaseAt = now;
    }

    /** Lines cleared in the current demo game. */
    get lines(): number {
        return this.state.score;
    }

    /** 0..1 opacity of the board: it fades out and back in between demo games. */
    opacity(now: number): number {
        const t = Math.min(1, Math.max(0, (now - this.phaseAt) / this.timing.fadeMs));
        if (this.phase === 'fading-out') return 1 - t;
        return this.phase === 'fading-in' ? t : 1;
    }

    /** Advances to `now`; at most one move per call. Returns what the Scene has to act on, if anything. */
    tick(now: number): DemoEvent | null {
        switch (this.phase) {
            case 'waiting':
                return this.tickWaiting(now);
            case 'stepping':
                return now >= this.phaseAt + this.timing.stepMs ? this.advance(now) : null;
            case 'fading-out':
                if (now - this.phaseAt < this.timing.fadeMs) return null;
                this.state = this.initial(this.deps);
                this.phase = 'fading-in';
                this.phaseAt = now;
                return { kind: 'fade-in' };
            default:
                if (now - this.phaseAt >= this.timing.fadeMs) this.beginWait(now);
                return null;
        }
    }

    private beginWait(now: number): void {
        this.phase = 'waiting';
        this.phaseAt = now;
        this.plan = undefined;
        this.queue = [];
    }

    private fadeOut(now: number): DemoEvent {
        this.phase = 'fading-out';
        this.phaseAt = now;
        return { kind: 'fade-out' };
    }

    private tickWaiting(now: number): DemoEvent | null {
        const over = now - this.phaseAt >= this.timing.waitMs;
        if (this.lines >= this.timing.lines) return over ? this.fadeOut(now) : null;
        // The plan is asked for on the frame after the wait began (so it does not share a frame with the
        // clear's own board generation), or at the end of the wait if no frame came in between.
        const wanted = this.plan === undefined || this.plan === 'pending';
        if (wanted && (over || now > this.phaseAt)) this.plan = this.planner(this.state);
        const plan = this.plan;
        if (!over || plan === undefined || plan === 'pending') return null;
        if (plan === null) return this.fadeOut(now);
        this.queue = plan.slice();
        this.phase = 'stepping';
        return this.advance(now);
    }

    /** Plays the next move of the plan. A line clear (or a plan that does not work) starts a new wait. */
    private advance(now: number): DemoEvent | null {
        const dir = this.queue.shift();
        if (!dir) {
            this.beginWait(now);
            return null;
        }
        // The demo has no move budget: it never runs out, whatever the plan costs.
        this.state.moves = PARAMS.maxMoves;
        const result = move(this.state, dir, this.deps);
        if (!result.moved) {
            this.beginWait(now);
            return null;
        }
        if (result.clearedRows.length + result.clearedCols.length > 0 || this.queue.length === 0) this.beginWait(now);
        else this.phaseAt = now;
        return { kind: 'move', result };
    }
}
