// One attempt at the climb: owns the field, the climber and the single falling mino. Pure logic, no Phaser.
import { P } from '../params';
import { planRandom, type Plan } from './ai';
import { clearLines, createGrid, lockPiece, type Grid, type Piece } from './board';
import { hesitates, pieceCrushesPlayer, stepPiece } from './fall';
import {
    createPlayer, heightOf, reachedGoal, shiftForClears, stepPlayer, type MoveInput, type Player,
} from './player';
import { Crumble } from './crumble';
import { cellsAfterClear } from './effects';
import { shapeCells, type Cell } from './pieces';

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
    /** Seconds left of the current hesitation pause (0 when the mino is not paused). */
    private hold = 0;
    /** True once the current falling mino has used its one hesitation. */
    private hesitated = false;

    constructor(private readonly rng: () => number, options: RoundOptions = {}) {
        this.wellCol = rng() < 0.5 ? 0 : P.COLS - 1;
        this.crumbleEnabled = options.crumble ?? true;
        this.hesitateEnabled = options.hesitate ?? true;
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
     * the stop, and whatever is left after the stop falls on. A player under the stopped mino is crushed as usual.
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
            }
        }
        if (this.hold > 0) {
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
        }
        this.fall(current, plan, left);
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
