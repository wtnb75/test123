// One attempt at the climb: owns the field, the climber and the single falling mino. Pure logic, no Phaser.
import { P } from '../params';
import { planRandom, type Plan } from './ai';
import { canPlace, clearLines, createGrid, lockPiece, type Grid, type Piece } from './board';
import { hesitates, pieceCrushesPlayer, stepPiece } from './fall';
import {
    createPlayer, heightOf, reachedGoal, shiftForClears, stepPlayer, type MoveInput, type Player,
} from './player';
import { Crumble } from './crumble';
import { cellsAfterClear } from './effects';
import { shapeCells, type Cell } from './pieces';

/** The pause is cut into this many quarters; each has its own sway step, and the last one always returns. */
const SWAY_QUARTERS = 4;

/** A fixed, repeatable stream (mulberry32): the default sway source, so tests and the demo runs repeat exactly. */
const fixedStream = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

export type RoundStatus = 'playing' | 'cleared' | 'lost';
export type LoseReason = 'crushed' | 'toppedOut';

/** What just happened, for the presentation layer (it never has to infer this from the state). */
export type RoundEvent =
    | { kind: 'locked'; cells: Cell[] } // positions after any line clear of the same frame
    | { kind: 'cleared'; rows: number[] }; // row indices at the moment of the clear

export type Flow =
    | { kind: 'wait'; timer: number }
    | { kind: 'telegraph'; plan: Plan; t: number }
    | { kind: 'drop'; piece: Piece; plan: Plan };

export interface RoundOptions {
    /** False turns the stuck-crumble off (a baseline for tests); the game always leaves it on. */
    crumble?: boolean;
    /** False turns the hesitating drop off (the baseline of docs/spec.md's 躊躇 measurements); the game leaves it on. */
    hesitate?: boolean;
    /**
     * The random source of the pause's sway, apart from the field's, so a sway never changes the mino sequence.
     * The game passes Math.random; by default it is a fixed stream, so tests and the demo runs repeat.
     */
    swayRng?: () => number;
}

export class Round {
    readonly grid: Grid = createGrid();
    /** The sealed-in timer and the blinking wall cell (docs/spec/stuck-crumble.md). */
    readonly crumble = new Crumble();
    player: Player = createPlayer();
    flow: Flow = { kind: 'wait', timer: P.SPAWN_DELAY };
    status: RoundStatus = 'playing';
    loseReason: LoseReason | null = null;
    /** Events not yet read by the presentation layer; drain with `drainEvents`. */
    private readonly events: RoundEvent[] = [];
    /** Highest HUD height reached in any frame, airborne or not. */
    maxHeight = 0;
    /** The column kept open by the landing AI: the left or right edge, fixed for the round. */
    readonly wellCol: number;

    private readonly crumbleEnabled: boolean;
    private readonly hesitateEnabled: boolean;
    private readonly swayRng: () => number;
    /** Seconds left of the current hesitation pause (0 when the mino is not paused). */
    private hold = 0;
    /** True once the current falling mino has used its one hesitation. */
    private hesitated = false;
    /** The sway step (in units of HESITATE_SWAY, -1 / 0 / +1) of each quarter of the current pause. */
    private sway: number[] = [];

    constructor(private readonly rng: () => number, options: RoundOptions = {}) {
        this.wellCol = rng() < 0.5 ? 0 : P.COLS - 1;
        this.crumbleEnabled = options.crumble ?? true;
        this.hesitateEnabled = options.hesitate ?? true;
        this.swayRng = options.swayRng ?? fixedStream(1);
    }

    /** Hands the pending events to `handle`, oldest first, and forgets them. */
    drainEvents(handle: (event: RoundEvent) => void): void {
        for (const event of this.events) handle(event);
        this.events.length = 0;
    }

    get height(): number {
        return heightOf(this.player);
    }

    /** Advances one frame. Does nothing once the round has ended. */
    step(dtRaw: number, input: MoveInput): void {
        if (this.status !== 'playing') return;
        const dt = Math.min(dtRaw, P.MAX_DT);

        this.player = stepPlayer(this.grid, this.player, input, dt);
        const reachedBeforeFlow = reachedGoal(this.player);

        this.advanceFlow(dt);

        if (this.status === 'playing' && reachedBeforeFlow) {
            this.status = 'cleared';
        }
        if (this.status === 'playing' && this.crumbleEnabled) this.crumble.step(this.grid, this.player, dt);
        this.maxHeight = Math.max(this.maxHeight, this.height);
        // Nothing is shown for the frame that ends the round, so its events are not left for later readers.
        if (this.status !== 'playing') this.events.length = 0;
    }

    private advanceFlow(dt: number): void {
        const flow = this.flow;
        if (flow.kind === 'wait') {
            flow.timer -= dt;
            if (flow.timer <= 0) {
                this.flow = { kind: 'telegraph', plan: planRandom(this.grid, this.rng, this.wellCol), t: 0 };
            }
        } else if (flow.kind === 'telegraph') {
            flow.t += dt;
            if (flow.t >= P.TELEGRAPH_TIME) {
                const { kind, rot, col } = flow.plan;
                const piece: Piece = { kind, rot, cells: shapeCells(kind, rot), col, y: 0 };
                this.hold = 0;
                this.hesitated = false;
                this.flow = { kind: 'drop', piece, plan: flow.plan };
            }
        } else {
            this.advanceDrop(flow.piece, flow.plan, dt);
        }
    }

    /**
     * One frame of the fall. The hesitating drop (docs/spec.md "1 個のミノの流れ" 2): a placement picked by `hesitates`
     * stops once at HESITATE_AT of its fall for HESITATE_TIME on the round's clock; the frame's leftover time pays for
     * the stop, and whatever is left after the stop falls on. During the stop the mino sways sideways and comes back to
     * its landing column. A player under the stopped mino is crushed as usual.
     */
    private advanceDrop(piece: Piece, plan: Plan, dt: number): void {
        let current = piece;
        let left = dt;
        if (this.hesitateEnabled && !this.hesitated && hesitates(plan)) {
            const toStop = Math.max(0, (P.HESITATE_AT * plan.row - current.y) / P.DROP_SPEED);
            if (toStop <= left) {
                const moved = this.fall(current, plan, toStop);
                if (moved === null) return;
                current = moved;
                left -= toStop;
                this.hesitated = true;
                this.hold = P.HESITATE_TIME;
                this.sway = this.drawSway();
            }
        }
        if (this.hold > 0) {
            current = { ...current, col: this.swayCol(current, plan) };
            if (pieceCrushesPlayer(current, this.player)) {
                this.lose('crushed');
                return;
            }
            const used = Math.min(this.hold, left);
            this.hold -= used;
            left -= used;
            if (left <= 0) {
                this.flow = { kind: 'drop', piece: current, plan };
                return;
            }
            current = { ...current, col: plan.col };
        }
        this.fall(current, plan, left);
    }

    /**
     * The sway of one pause: a random step of -1, 0 or +1 for each quarter but the last, which is 0 (back on the
     * landing column). Drawn once when the pause starts, from `swayRng`; the stop itself stays free of randomness.
     */
    private drawSway(): number[] {
        const steps = Array.from({ length: SWAY_QUARTERS - 1 }, () => Math.floor(this.swayRng() * 3) - 1);
        return [...steps, 0];
    }

    /**
     * The column the paused mino is shown at: it takes its quarter's sway step (HESITATE_SWAY columns per unit), and
     * stays on its landing column for a quarter whose step is blocked by the field.
     */
    private swayCol(piece: Piece, plan: Plan): number {
        const elapsed = P.HESITATE_TIME - this.hold;
        const quarter = Math.min(SWAY_QUARTERS - 1, Math.floor(elapsed / (P.HESITATE_TIME / SWAY_QUARTERS)));
        const target = plan.col + this.sway[quarter] * P.HESITATE_SWAY;
        const top = Math.floor(piece.y);
        const free = canPlace(this.grid, piece.cells, target, top) && canPlace(this.grid, piece.cells, target, top + 1);
        return free ? target : plan.col;
    }

    /** Drops the piece for `time` seconds; returns the piece while it still falls, or null when it crushed or locked. */
    private fall(piece: Piece, plan: Plan, time: number): Piece | null {
        const res = stepPiece(this.grid, piece, time, this.player);
        if (res.crushed) {
            this.lose('crushed');
            return null;
        }
        if (res.lockedRow === null) {
            this.flow = { kind: 'drop', piece: res.piece, plan };
            return res.piece;
        }
        this.lock(res.piece, res.lockedRow);
        return null;
    }

    private lock(piece: Piece, lockedRow: number): void {
        lockPiece(this.grid, piece, lockedRow);
        this.flow = { kind: 'wait', timer: P.SPAWN_DELAY };
        if (lockedRow < P.TOP_OUT_ROW) {
            this.lose('toppedOut');
            return;
        }
        const absolute = piece.cells.map(({ c, r }) => ({ c: piece.col + c, r: lockedRow + r }));
        const cleared = clearLines(this.grid);
        this.events.push({ kind: 'locked', cells: cellsAfterClear(absolute, cleared) });
        if (cleared.length > 0) {
            this.events.push({ kind: 'cleared', rows: cleared });
            this.crumble.followClears(cleared);
            this.player = shiftForClears(this.grid, this.player, cleared);
        }
    }

    private lose(reason: LoseReason): void {
        this.status = 'lost';
        this.loseReason = reason;
    }
}
