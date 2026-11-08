// One play's state: the board, the moves left and the score (docs/spec.md "ルール"). Pure: the Scene animates
// the steps this returns; nothing here knows about Phaser or time.
import { BONUS_PER_EXTRA_GEM, COLORS, COLS, MOVES, ROWS, SCORE_PER_GEM, SHUFFLE_MAX_TRIES } from '../params';
import {
    type Added,
    type Board,
    type Fall,
    type Kinds,
    type Pos,
    type Rng,
    canSwap,
    collapse,
    createBoard,
    hasMove,
    normalKinds,
    refill,
    shuffleBoard,
    swapCells,
} from './board';
import { scoreFor } from './score';
import { applyFalls, planClear, type ClearPlan, type Spawn } from './special';

/** One clear → fall → refill round of a chain. */
export interface Step {
    /** 1-based position in the chain of this swap. */
    chain: number;
    /** Stones that vanish. */
    cleared: Pos[];
    /** Special stones that appear (at a cell whose stone stays on the board). */
    spawned: Spawn[];
    /** Stones that count for the points: `cleared` plus the stones that turn into special stones. */
    count: number;
    gain: number;
    falls: Fall[];
    added: Added[];
}

export type NextState = 'idle' | 'shuffle' | 'ending';

export type SwapOutcome = { accepted: false } | { accepted: true; steps: Step[]; next: NextState };

export class Round {
    readonly board: Board;
    /** The kind of every stone (docs/spec/special-gems.md), laid out like `board`. */
    readonly kinds: Kinds;
    moves = MOVES;
    score = 0;

    constructor(private readonly rng: Rng) {
        this.board = createBoard(ROWS, COLS, COLORS, rng);
        this.kinds = normalKinds(ROWS, COLS);
    }

    /**
     * Swaps two stones. With no match (and no colour stone in the swap) the board is left as it was (accepted:
     * false, no move used). Otherwise a move is used and the whole chain is played out on the board; the Scene
     * replays `steps`.
     */
    swap(a: Pos, b: Pos): SwapOutcome {
        if (this.moves <= 0 || !canSwap(a, b, ROWS, COLS)) return { accepted: false };
        this.swapStones(a, b);
        const first = planClear(this.board, this.kinds, [a, b]);
        if (!first) {
            this.swapStones(a, b);
            return { accepted: false };
        }
        this.moves--;
        const steps = this.resolve(first);
        return { accepted: true, steps, next: this.nextState() };
    }

    /** Rearranges a stuck board. Returns true when it had to be built anew. */
    reshuffle(): boolean {
        return shuffleBoard(this.board, COLORS, this.rng, SHUFFLE_MAX_TRIES, this.kinds);
    }

    private swapStones(a: Pos, b: Pos) {
        swapCells(this.board, a, b);
        const kind = this.kinds[a.r][a.c];
        this.kinds[a.r][a.c] = this.kinds[b.r][b.c];
        this.kinds[b.r][b.c] = kind;
    }

    private nextState(): NextState {
        if (this.moves <= 0) return 'ending';
        return hasMove(this.board) ? 'idle' : 'shuffle';
    }

    private resolve(first: ClearPlan): Step[] {
        const steps: Step[] = [];
        let plan: ClearPlan | null = first;
        for (let chain = 1; plan; chain++) {
            const { cleared, spawned, count } = plan;
            const gain = scoreFor(count, chain, SCORE_PER_GEM, BONUS_PER_EXTRA_GEM);
            this.score += gain;
            for (const p of cleared) {
                this.board[p.r][p.c] = null;
                this.kinds[p.r][p.c] = 'normal';
            }
            for (const s of spawned) {
                this.board[s.r][s.c] = s.color;
                this.kinds[s.r][s.c] = s.kind;
            }
            const falls = collapse(this.board);
            applyFalls(this.kinds, falls);
            const added = refill(this.board, COLORS, this.rng);
            steps.push({ chain, cleared, spawned, count, gain, falls, added });
            plan = planClear(this.board, this.kinds, []);
        }
        return steps;
    }
}
