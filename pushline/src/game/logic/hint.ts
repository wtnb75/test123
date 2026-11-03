// The hint (docs/spec/hint.md): pay a few moves to learn which row or column the shortest way completes.
import { PARAMS } from '../params';
import { minClearLine } from './solve';
import type { LineRef, State } from './types';

export type HintOutcome = { kind: 'used'; line: LineRef } | { kind: 'unusable' };

/** What a press of the Hint button leads to: nothing, a small shake (it cannot be used), or the line to light. */
export type HintPress = { kind: 'ignore' } | { kind: 'shake' } | { kind: 'lit'; line: LineRef };

/**
 * The lit line and when it goes out (docs/spec/hint.md "光る一列が消えるとき"): it stays through no-op inputs
 * and orientation changes, and goes out with the next real 1-cell move, a real Undo, or the end of the Scene.
 */
export class HintLight {
    line: LineRef | null = null;

    /**
     * A press while playing: already lit or run over -> ignored (no shake, no payment); unusable -> shake;
     * otherwise the hint is paid and `line` is set. `playing` is false during the `ending` phase.
     */
    press(state: State, playing: boolean): HintPress {
        if (this.line || !playing || state.over) return { kind: 'ignore' };
        const outcome = takeHint(state);
        if (outcome.kind === 'unusable') return { kind: 'shake' };
        this.line = outcome.line;
        return { kind: 'lit', line: outcome.line };
    }

    /** A move that really moved the character (a blocked input does not call this). Returns whether it went out. */
    onMoved(): boolean {
        return this.clear();
    }

    /** An Undo that really went back one move (an Undo with an empty history does not call this). */
    onUndone(): boolean {
        return this.clear();
    }

    private clear(): boolean {
        const wasLit = this.line !== null;
        this.line = null;
        return wasLit;
    }
}

/** Whether the hint button looks usable: moves enough to pay and still play on, and the run not over. */
export const hintAvailable = (state: State): boolean => !state.over && state.moves >= PARAMS.hintMinMoves;

/**
 * Presses the hint. When it can be used, pays `hintCost` moves and returns the line to light; when the moves
 * are too few, the run is over, or the search finds no clear in reach, nothing changes ('unusable').
 * The board, the history and the spent-move count never change.
 */
export function takeHint(state: State): HintOutcome {
    if (!hintAvailable(state)) return { kind: 'unusable' };
    const line = minClearLine(state.grid, state.px, state.py, PARAMS.maxMoves);
    if (!line) return { kind: 'unusable' };
    state.moves -= PARAMS.hintCost;
    return { kind: 'used', line };
}
