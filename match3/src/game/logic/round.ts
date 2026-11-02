// One play's state: the board, the moves left and the score (docs/spec.md "ルール"). Pure: the Scene animates
// the steps this returns; nothing here knows about Phaser or time.
import { BONUS_PER_EXTRA_GEM, COLORS, COLS, MOVES, ROWS, SCORE_PER_GEM, SHUFFLE_MAX_TRIES } from '../params';
import {
    type Added,
    type Board,
    type Fall,
    type Pos,
    type Rng,
    canSwap,
    collapse,
    createBoard,
    findMatches,
    hasMove,
    refill,
    shuffleBoard,
    swapCells,
} from './board';
import { scoreFor } from './score';

/** One clear → fall → refill round of a chain. */
export interface Step {
    /** 1-based position in the chain of this swap. */
    chain: number;
    cleared: Pos[];
    gain: number;
    falls: Fall[];
    added: Added[];
}

export type NextState = 'idle' | 'shuffle' | 'ending';

export type SwapOutcome = { accepted: false } | { accepted: true; steps: Step[]; next: NextState };

export class Round {
    readonly board: Board;
    moves = MOVES;
    score = 0;

    constructor(private readonly rng: Rng) {
        this.board = createBoard(ROWS, COLS, COLORS, rng);
    }

    /**
     * Swaps two stones. With no match the board is left as it was (accepted: false, no move used). Otherwise a
     * move is used and the whole chain is played out on the board; the Scene replays `steps`.
     */
    swap(a: Pos, b: Pos): SwapOutcome {
        if (this.moves <= 0 || !canSwap(a, b, ROWS, COLS)) return { accepted: false };
        swapCells(this.board, a, b);
        if (findMatches(this.board).length === 0) {
            swapCells(this.board, a, b);
            return { accepted: false };
        }
        this.moves--;
        const steps = this.resolve();
        return { accepted: true, steps, next: this.nextState() };
    }

    /** Rearranges a stuck board. Returns true when it had to be built anew. */
    reshuffle(): boolean {
        return shuffleBoard(this.board, COLORS, this.rng, SHUFFLE_MAX_TRIES);
    }

    private nextState(): NextState {
        if (this.moves <= 0) return 'ending';
        return hasMove(this.board) ? 'idle' : 'shuffle';
    }

    private resolve(): Step[] {
        const steps: Step[] = [];
        for (let chain = 1; ; chain++) {
            const cleared = findMatches(this.board);
            if (cleared.length === 0) return steps;
            const gain = scoreFor(cleared.length, chain, SCORE_PER_GEM, BONUS_PER_EXTRA_GEM);
            this.score += gain;
            for (const p of cleared) this.board[p.r][p.c] = null;
            const falls = collapse(this.board);
            const added = refill(this.board, COLORS, this.rng);
            steps.push({ chain, cleared, gain, falls, added });
        }
    }
}
