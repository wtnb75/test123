// One attempt at the climb: owns the field, the climber and the single falling mino. Pure logic, no Phaser.
import { P } from '../params';
import { planRandom, type Plan } from './ai';
import { clearLines, createGrid, lockPiece, type Grid, type Piece } from './board';
import { stepPiece } from './fall';
import {
    createPlayer, heightOf, reachedGoal, shiftForClears, stepPlayer, type MoveInput, type Player,
} from './player';
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

export class Round {
    readonly grid: Grid = createGrid();
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

    constructor(private readonly rng: () => number) {
        this.wellCol = rng() < 0.5 ? 0 : P.COLS - 1;
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

        if (this.status === 'playing' && (reachedBeforeFlow || reachedGoal(this.player))) {
            this.status = 'cleared';
        }
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
                this.flow = { kind: 'drop', piece, plan: flow.plan };
            }
        } else {
            this.advanceDrop(flow.piece, flow.plan, dt);
        }
    }

    private advanceDrop(piece: Piece, plan: Plan, dt: number): void {
        const res = stepPiece(this.grid, piece, dt, this.player);
        if (res.crushed) {
            this.lose('crushed');
            return;
        }
        if (res.lockedRow === null) {
            this.flow = { kind: 'drop', piece: res.piece, plan };
            return;
        }
        lockPiece(this.grid, res.piece, res.lockedRow);
        this.flow = { kind: 'wait', timer: P.SPAWN_DELAY };
        if (res.lockedRow < P.TOP_OUT_ROW) {
            this.lose('toppedOut');
            return;
        }
        const absolute = res.piece.cells.map(({ c, r }) => ({ c: res.piece.col + c, r: res.lockedRow! + r }));
        const cleared = clearLines(this.grid);
        this.events.push({ kind: 'locked', cells: cellsAfterClear(absolute, cleared) });
        if (cleared.length > 0) {
            this.events.push({ kind: 'cleared', rows: cleared });
            this.player = shiftForClears(this.player, cleared);
        }
    }

    private lose(reason: LoseReason): void {
        this.status = 'lost';
        this.loseReason = reason;
    }
}
