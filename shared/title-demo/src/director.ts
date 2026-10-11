// The flow of a Title demo, independent of the game: waits, one action per call, the fade between runs.
// Phaser-free; time is passed in, so tests drive it with plain numbers (see ../README.md for the contract).

/** `waiting` -> `stepping` -> `waiting` ...; after the last round of a run `fading-out` -> `fading-in` -> `waiting`. */
export type DemoPhase = 'waiting' | 'stepping' | 'fading-out' | 'fading-in';

/** The actions that finish the current round, `null` when there is none, or `'pending'` while still being worked out. */
export type Plan<A> = A[] | null | 'pending';

export interface PlayResult<R> {
    /** False when the action could not be played (the plan is dropped and made again). */
    moved: boolean;
    /** True when this action finished the round (a line cleared, a stage completed). */
    roundDone: boolean;
    /** How many rounds this action finished (default 1). Only meaningful with `roundDone`; counts toward `rounds`. */
    roundsDone?: number;
    /** What the Scene needs to play the effects of this action. */
    detail: R;
}

export interface DemoGame<S, A, R> {
    /** A fresh state for a new run (called at construction and at every rebuild). */
    start(): S;
    plan(state: S): Plan<A>;
    play(state: S, action: A): PlayResult<R>;
    /**
     * Optional. Called when the wait after a finished round is over (and the run has rounds left), before the
     * next round is planned: the game moves on to its next round (for example the next stage).
     */
    advance?(state: S): void;
}

export interface DemoTiming {
    /** Between two actions of one plan. */
    stepMs: number;
    /** A wait: after a run starts, after a round, after a rebuild. */
    waitMs: number;
    /** One way of the fade (out, then in). */
    fadeMs: number;
}

export interface DemoOptions {
    /** Rounds shown in one run before it is rebuilt. */
    rounds: number;
    timing: DemoTiming;
}

export type DemoEvent<R> =
    /** One action was played: play the effects of `detail`. */
    | { kind: 'action'; detail: R }
    /** `advance` ran: the state changed, redraw it. */
    | { kind: 'advance' }
    /** The board starts fading away: drop the effects that are still playing. */
    | { kind: 'fade-out' }
    /** A new run's state is in place (fully transparent now): redraw it. */
    | { kind: 'fade-in' };

export class DemoDirector<S, A, R> {
    state: S;
    phase: DemoPhase = 'waiting';
    /** Rounds finished in the current run. */
    rounds = 0;

    /** When the current phase began: a wait's start, the time of the last action, a fade's start. */
    private phaseAt: number;
    /** The plan for this wait; undefined until it has been asked for. */
    private plan: Plan<A> | undefined;
    private queue: A[] = [];
    /** The current wait follows a finished round (the one `advance` is called after). */
    private afterRound = false;

    constructor(
        private readonly game: DemoGame<S, A, R>,
        private readonly options: DemoOptions,
        now: number,
    ) {
        this.state = game.start();
        this.phaseAt = now;
    }

    /** 0..1 opacity of the board: it fades out and back in between runs. */
    opacity(now: number): number {
        const { fadeMs } = this.options.timing;
        // a fade of no length is over at once (never 0 / 0)
        const t = fadeMs > 0 ? Math.min(1, Math.max(0, (now - this.phaseAt) / fadeMs)) : 1;
        if (this.phase === 'fading-out') return 1 - t;
        return this.phase === 'fading-in' ? t : 1;
    }

    /** Advances to `now`; at most one action or one event per call. */
    tick(now: number): DemoEvent<R> | null {
        switch (this.phase) {
            case 'waiting':
                return this.tickWaiting(now);
            case 'stepping':
                return now >= this.phaseAt + this.options.timing.stepMs ? this.step(now) : null;
            case 'fading-out':
                if (now - this.phaseAt < this.options.timing.fadeMs) return null;
                this.state = this.game.start();
                this.rounds = 0;
                this.phase = 'fading-in';
                this.phaseAt = now;
                return { kind: 'fade-in' };
            default:
                if (now - this.phaseAt >= this.options.timing.fadeMs) this.beginWait(now);
                return null;
        }
    }

    private beginWait(now: number, afterRound = false): void {
        this.phase = 'waiting';
        this.phaseAt = now;
        this.plan = undefined;
        this.queue = [];
        this.afterRound = afterRound;
    }

    private fadeOut(now: number): DemoEvent<R> {
        this.phase = 'fading-out';
        this.phaseAt = now;
        return { kind: 'fade-out' };
    }

    private tickWaiting(now: number): DemoEvent<R> | null {
        const over = now - this.phaseAt >= this.options.timing.waitMs;
        if (this.rounds >= this.options.rounds) return over ? this.fadeOut(now) : null;
        if (this.afterRound && this.game.advance) {
            if (!over) return null;
            this.game.advance(this.state);
            this.beginWait(now);
            return { kind: 'advance' };
        }
        // The plan is asked for on a frame after the wait began (so it does not share a frame with whatever
        // started the wait), or at the end of the wait if no frame came in between.
        const wanted = this.plan === undefined || this.plan === 'pending';
        if (wanted && (over || now > this.phaseAt)) this.plan = this.game.plan(this.state);
        const plan = this.plan;
        if (!over || plan === undefined || plan === 'pending') return null;
        if (plan === null) return this.fadeOut(now);
        this.queue = plan.slice();
        this.phase = 'stepping';
        return this.step(now);
    }

    /** Plays the next action of the plan. A finished round, or a plan that does not work, starts a new wait. */
    private step(now: number): DemoEvent<R> | null {
        if (this.queue.length === 0) {
            this.beginWait(now);
            return null;
        }
        const action = this.queue.shift() as A;
        const result = this.game.play(this.state, action);
        if (!result.moved) {
            this.beginWait(now);
            return null;
        }
        if (result.roundDone) {
            this.rounds += result.roundsDone ?? 1;
            this.beginWait(now, true);
        } else if (this.queue.length === 0) {
            this.beginWait(now);
        } else {
            this.phaseAt = now;
        }
        return { kind: 'action', detail: result.detail };
    }
}
