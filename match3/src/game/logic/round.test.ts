import { describe, expect, it } from 'vitest';
import { BONUS_PER_EXTRA_GEM, MOVES, SCORE_PER_GEM } from '../params';
import { findMatches, hasMove } from './board';
import { Round } from './round';
import { controlled, pos, setBoard, stamp, uniqueBoard } from './testing';

/** A Round whose board is replaced by `rows`; refill colours come from `next(...)` on the returned handle. */
function roundWith(rows = uniqueBoard(8, 8)) {
    const ctl = controlled(3);
    const round = new Round(ctl.rng);
    setBoard(round.board, rows);
    return { round, ctl };
}

/** Row 7 holds 9 9 . and a 9 above the gap: swapping (6,2) with (7,2) makes a run in row 7. */
const bottomPair = () => stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [6, 2]]);

describe('Round at the start', () => {
    it('has MOVES moves, score 0 and a playable 8 x 8 board', () => {
        const round = new Round(controlled(5).rng);
        expect(round.moves).toBe(MOVES);
        expect(round.score).toBe(0);
        expect(round.board).toHaveLength(8);
        expect(round.board.every((row) => row.length === 8)).toBe(true);
        expect(findMatches(round.board)).toEqual([]);
        expect(hasMove(round.board)).toBe(true);
    });
});

describe('Round.swap with no match (docs/spec.md "交換")', () => {
    it('leaves the board and moves untouched and reports not accepted', () => {
        const { round } = roundWith();
        const before = JSON.stringify(round.board);
        expect(round.swap(pos(0, 0), pos(0, 1))).toEqual({ accepted: false });
        expect(JSON.stringify(round.board)).toBe(before);
        expect(round.moves).toBe(MOVES);
        expect(round.score).toBe(0);
    });

    it('refuses stones that are not neighbours without changing anything', () => {
        const { round } = roundWith(bottomPair());
        const before = JSON.stringify(round.board);
        expect(round.swap(pos(6, 2), pos(7, 3))).toEqual({ accepted: false }); // diagonal
        expect(round.swap(pos(6, 2), pos(6, 2))).toEqual({ accepted: false }); // itself
        expect(JSON.stringify(round.board)).toBe(before);
        expect(round.moves).toBe(MOVES);
    });

    it('refuses any swap once no moves are left', () => {
        const { round } = roundWith(bottomPair());
        round.moves = 0;
        expect(round.swap(pos(6, 2), pos(7, 2))).toEqual({ accepted: false });
        expect(round.board[6][2]).toBe(9);
    });
});

describe('Round.swap with a match', () => {
    it('uses one move, clears 3 stones for 30 points, refills, and reports a stuck board as "shuffle"', () => {
        const { round, ctl } = roundWith(bottomPair());
        ctl.next(0, 1 / 6 + 0.01, 2 / 6 + 0.01); // refill colours 0, 1, 2 for (0,0), (0,1), (0,2)
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted).toBe(true);
        if (!out.accepted) return;
        expect(round.moves).toBe(MOVES - 1);
        expect(out.steps).toHaveLength(1);
        const step = out.steps[0];
        expect(step.chain).toBe(1);
        expect(step.cleared).toEqual([pos(7, 0), pos(7, 1), pos(7, 2)]);
        expect(step.gain).toBe(3 * SCORE_PER_GEM);
        expect(round.score).toBe(30);
        expect(step.added).toEqual([
            { r: 0, c: 0, color: 0 },
            { r: 0, c: 1, color: 1 },
            { r: 0, c: 2, color: 2 },
        ]);
        // Each of columns 0..2 drops its 7 stones above row 7 by one row.
        expect(step.falls).toHaveLength(21);
        expect(step.falls.every((f) => f.to === f.from + 1)).toBe(true);
        expect(ctl.pending()).toBe(0); // exactly three random numbers were drawn
        expect(findMatches(round.board)).toEqual([]);
        expect(hasMove(round.board)).toBe(false);
        expect(out.next).toBe('shuffle');
    });

    it('adds the bonus for 4 stones at once: (4 × 10 + 20) × 1 = 60', () => {
        const rows = stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [7, 3], [6, 2]]);
        const { round, ctl } = roundWith(rows);
        ctl.next(0.1, 0.3, 0.7); // colours 0, 1, 4 for (0,0), (0,1), (0,3): three stones vanish, one stays as a line stone
        const out = round.swap(pos(6, 2), pos(7, 2));
        // Four in a row count for four stones; one of them stays on the board as a line stone (special-gems.md).
        expect(out.accepted && out.steps[0].count).toBe(4);
        expect(out.accepted && out.steps[0].cleared).toHaveLength(3);
        expect(out.accepted && out.steps[0].spawned).toHaveLength(1);
        expect(round.score).toBe(4 * SCORE_PER_GEM + BONUS_PER_EXTRA_GEM);
        expect(round.score).toBe(60);
        expect(ctl.pending()).toBe(0); // exactly three refills drew random numbers
    });

    it('plays a chain: a refill that makes a new match gives step 2 at double value, and chain resets next swap', () => {
        const { round, ctl } = roundWith(bottomPair());
        // Step 1 refills (0,0),(0,1),(0,2) with colour 0 0 0 -> a match in row 0. Step 2 refills with 1 2 3.
        ctl.next(0, 0, 0, 0.2, 0.4, 0.6);
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted).toBe(true);
        if (!out.accepted) return;
        expect(out.steps.map((s) => s.chain)).toEqual([1, 2]);
        expect(out.steps[0].gain).toBe(30);
        expect(out.steps[1].gain).toBe(60); // 3 stones × 10 × chain 2
        expect(out.steps[1].cleared).toEqual([pos(0, 0), pos(0, 1), pos(0, 2)]);
        expect(out.steps[1].falls).toEqual([]); // nothing above row 0 to fall
        expect(round.score).toBe(90);
        expect(ctl.pending()).toBe(0);
    });

    it('starts the chain at step 1 again on the next swap', () => {
        const { round, ctl } = roundWith(bottomPair());
        ctl.next(0, 0, 0, 0.2, 0.4, 0.6); // a two-step chain, as above
        round.swap(pos(6, 2), pos(7, 2));
        // Make a known move in columns 4-6 (untouched by the first chain): two 9s in row 4 and a 9 above the gap.
        stamp(round.board, 9, [[4, 4], [4, 5], [3, 6]]);
        // Clearing (4,4), (4,5), (4,6) leaves one empty cell per column, at row 0: three draws, colours 1, 2, 3.
        ctl.next(0.2, 0.4, 0.6);
        const second = round.swap(pos(3, 6), pos(4, 6));
        expect(second.accepted).toBe(true);
        if (!second.accepted) return;
        expect(second.steps).toHaveLength(1);
        expect(second.steps[0].chain).toBe(1);
        expect(second.steps[0].gain).toBe(30);
        expect(ctl.pending()).toBe(0); // exactly those three numbers were drawn
    });

    it('ends the play when the last move is used, even if no move is left on the board, without shuffling', () => {
        const { round, ctl } = roundWith(bottomPair());
        ctl.next(0, 0.2, 0.4);
        round.moves = 1;
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted && out.next).toBe('ending');
        expect(round.moves).toBe(0);
        expect(hasMove(round.board)).toBe(false);
    });

    it('goes back to idle when moves remain and the board still has a move', () => {
        // After clearing row 7 (cols 0-2) the refill puts colour 5 5 at (0,0),(0,1); a 5 at (1,3)+(2,2)... keep it simple:
        // stamp an independent pair elsewhere that stays a valid move.
        const rows = stamp(bottomPair(), 8, [[0, 5], [0, 6], [1, 4]]); // moving (1,4) up gives 8 8 8 in row 0 (cols 4,5,6)
        const { round, ctl } = roundWith(rows);
        ctl.next(0, 0.2, 0.4);
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted && out.next).toBe('idle');
        expect(hasMove(round.board)).toBe(true);
    });
});

describe('Round.reshuffle', () => {
    // Colour (row + 2 × col) mod 6: every colour is used many times, no run exists and no swap makes one.
    const stuckWithRepeats = () =>
        Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 2 * c) % 6));
    const sorted = (rows: (number | null)[][]) => rows.flat().sort((a, b) => (a as number) - (b as number));

    it('rearranges the same stones of a stuck board into one with a move and no match', () => {
        const { round } = roundWith(stuckWithRepeats());
        expect(findMatches(round.board)).toEqual([]);
        expect(hasMove(round.board)).toBe(false); // the precondition: really stuck
        const before = sorted(round.board);
        const rebuilt = round.reshuffle();
        expect(rebuilt).toBe(false);
        expect(sorted(round.board)).toEqual(before); // the same stones, in a new order
        expect(findMatches(round.board)).toEqual([]);
        expect(hasMove(round.board)).toBe(true);
    });

    it('builds the board anew when the stones cannot be arranged (all different stones)', () => {
        const { round } = roundWith(); // unique stones: no arrangement has a match, so none has a move
        expect(round.reshuffle()).toBe(true);
        expect(findMatches(round.board)).toEqual([]);
        expect(hasMove(round.board)).toBe(true);
    });
});
