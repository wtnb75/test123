import { describe, expect, it } from 'vitest';
import { MOVES } from '../params';
import { RAINBOW, findMatches, hasMove, type Kind } from './board';
import { Round } from './round';
import { controlled, pos, setBoard, stamp, uniqueBoard } from './testing';

/** A Round whose board is replaced by `rows` (all stones normal); refill colours come from the returned handle. */
function roundWith(rows = uniqueBoard(8, 8)) {
    const ctl = controlled(3);
    const round = new Round(ctl.rng);
    setBoard(round.board, rows);
    return { round, ctl };
}

const setKind = (round: Round, kind: Kind, r: number, c: number) => {
    round.kinds[r][c] = kind;
};

/** Row 7 holds 9 9 . 9 and a 9 above the gap: swapping (6,2) with (7,2) makes a run of 4 in row 7. */
const four = () => stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [7, 3], [6, 2]]);

describe('Round: starting a play', () => {
    it('starts with no special stone anywhere', () => {
        const round = new Round(controlled(5).rng);
        expect(round.kinds).toHaveLength(8);
        expect(round.kinds.every((row) => row.length === 8 && row.every((k) => k === 'normal'))).toBe(true);
        expect(round.board.flat().every((v) => v !== null && v >= 0)).toBe(true);
    });
});

describe('Round.swap leaving a special stone (docs/spec/special-gems.md)', () => {
    it('a run of 4 leaves a column line stone at the swapped cell: 60 points, 3 stones vanish, 4 count', () => {
        const { round, ctl } = roundWith(four());
        ctl.next(0, 0.2, 0.4); // refills for (0,0), (0,1), (0,3)
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted).toBe(true);
        if (!out.accepted) return;
        const step = out.steps[0];
        expect(step.spawned).toEqual([{ r: 7, c: 2, color: 9, kind: 'lineCol' }]);
        expect(step.cleared).toEqual([pos(7, 0), pos(7, 1), pos(7, 3)]);
        expect(step.count).toBe(4);
        expect(step.gain).toBe(60);
        expect(round.score).toBe(60);
        // The stone stays on the board with its kind; the cleared cells were refilled.
        expect(round.board[7][2]).toBe(9);
        expect(round.kinds[7][2]).toBe('lineCol');
        expect(round.kinds.flat().filter((k) => k !== 'normal')).toHaveLength(1);
        expect(ctl.pending()).toBe(0); // only the three refills drew random numbers
    });

    it('a run of 5 leaves a colour stone that has no colour', () => {
        const rows = stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [7, 3], [7, 4], [6, 2]]);
        const { round, ctl } = roundWith(rows);
        ctl.next(0, 0.2, 0.4, 0.6);
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted && out.steps[0].count).toBe(5);
        expect(round.score).toBe(90);
        expect(round.board[7][2]).toBe(RAINBOW);
        expect(round.kinds[7][2]).toBe('rainbow');
    });

    it('a special stone falls with its kind when stones below it are cleared', () => {
        const rows = stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [6, 2]]);
        const { round, ctl } = roundWith(rows);
        setKind(round, 'bomb', 4, 0);
        const stoneAbove = round.board[4][0];
        ctl.next(0, 0.2, 0.4);
        round.swap(pos(6, 2), pos(7, 2));
        expect(round.board[5][0]).toBe(stoneAbove);
        expect(round.kinds[5][0]).toBe('bomb');
        expect(round.kinds[4][0]).toBe('normal');
    });

    it('refills with normal stones only', () => {
        const { round, ctl } = roundWith(four());
        ctl.next(0, 0.2, 0.4);
        const out = round.swap(pos(6, 2), pos(7, 2));
        for (const a of out.accepted ? out.steps.flatMap((s) => s.added) : []) {
            expect(round.kinds[a.r][a.c]).toBe('normal');
            expect(a.color).toBeGreaterThanOrEqual(0);
        }
    });
});

describe('Round.swap setting off special stones', () => {
    it('a column line stone in a row of 3 clears its column: 10 stones, 240 points, no extra chain step', () => {
        const rows = stamp(uniqueBoard(8, 8), 9, [[3, 3], [2, 4], [2, 5]]);
        const { round, ctl } = roundWith(rows);
        setKind(round, 'lineCol', 3, 3);
        // Column 3 is refilled whole (8 draws: 0 1 0 1 ...), then (0,4) and (0,5).
        ctl.next(0, 0.2, 0, 0.2, 0, 0.2, 0, 0.2, 0.4, 0.6);
        const out = round.swap(pos(3, 3), pos(2, 3));
        expect(out.accepted).toBe(true);
        if (!out.accepted) return;
        expect(out.steps).toHaveLength(1);
        expect(out.steps[0].count).toBe(10);
        expect(out.steps[0].spawned).toEqual([]);
        expect(out.steps[0].gain).toBe(240);
        expect(round.score).toBe(240);
        expect(round.kinds.flat().every((k) => k === 'normal')).toBe(true);
        expect(ctl.pending()).toBe(0);
    });

    it('a special stone made in a chain lap goes off like any other', () => {
        // Step 1 clears 4 and leaves a line stone; its refills line up a 3-run with the line stone inside.
        const rows = stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [7, 3], [6, 2]]);
        const { round, ctl } = roundWith(rows);
        ctl.next(0, 0.2, 0.4);
        const first = round.swap(pos(6, 2), pos(7, 2));
        expect(first.accepted && first.steps).toHaveLength(1);
        expect(round.kinds[7][2]).toBe('lineCol');
        // Now make a 3-run through the line stone: (7,2) joins (7,3), (7,4) once a 9 sits next to it.
        stamp(round.board, 9, [[7, 3], [7, 4], [6, 5]]);
        ctl.next(...Array.from({ length: 9 }, (_, i) => (i % 2 ? 0.2 : 0)));
        const second = round.swap(pos(6, 5), pos(7, 5));
        expect(second.accepted).toBe(true);
        if (!second.accepted) return;
        // Row 7: (7,2),(7,3),(7,4),(7,5) are 9 -> a run of 4 including the line stone, which sets off column 2.
        expect(second.steps[0].cleared.filter((p) => p.c === 2)).toHaveLength(8);
    });

    it('a colour stone swapped with a neighbour clears that colour; it needs no match and costs a move', () => {
        const rows = uniqueBoard(8, 8);
        const { round, ctl } = roundWith(rows);
        round.board[3][3] = RAINBOW;
        setKind(round, 'rainbow', 3, 3);
        ctl.next(0, 0.2);
        const out = round.swap(pos(3, 3), pos(3, 4));
        expect(out.accepted).toBe(true);
        if (!out.accepted) return;
        expect(round.moves).toBe(MOVES - 1);
        expect(out.steps[0].count).toBe(2); // the only stone of its colour, and the colour stone
        expect(out.steps[0].gain).toBe(20);
        expect(out.steps[0].cleared).toEqual([pos(3, 3), pos(3, 4)]);
    });

    it('a colour stone is refused like any swap when no moves are left', () => {
        const { round } = roundWith();
        round.board[3][3] = RAINBOW;
        setKind(round, 'rainbow', 3, 3);
        round.moves = 0;
        expect(round.swap(pos(3, 3), pos(3, 4))).toEqual({ accepted: false });
        expect(round.board[3][3]).toBe(RAINBOW);
    });

    it('a colour stone swapped with a non-neighbour is refused and nothing changes', () => {
        const { round } = roundWith();
        round.board[3][3] = RAINBOW;
        setKind(round, 'rainbow', 3, 3);
        const before = JSON.stringify([round.board, round.kinds]);
        expect(round.swap(pos(3, 3), pos(4, 4))).toEqual({ accepted: false });
        expect(JSON.stringify([round.board, round.kinds])).toBe(before);
        expect(round.moves).toBe(MOVES);
    });

    it('a refused ordinary swap still gives the stones and kinds back as they were', () => {
        const { round } = roundWith();
        setKind(round, 'bomb', 0, 0);
        const before = JSON.stringify([round.board, round.kinds]);
        expect(round.swap(pos(0, 0), pos(0, 1))).toEqual({ accepted: false });
        expect(JSON.stringify([round.board, round.kinds])).toBe(before);
        expect(round.moves).toBe(MOVES);
    });

    it('a swapped special stone keeps its kind in its new cell', () => {
        const rows = stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [6, 2]]);
        const { round, ctl } = roundWith(rows);
        setKind(round, 'lineRow', 6, 2); // the line stone is the one moved into the run
        ctl.next(...Array.from({ length: 12 }, (_, i) => (i % 2 ? 0.2 : 0)));
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted).toBe(true);
        // The line stone is at (7,2) in the run of 3: it clears row 7.
        expect(out.accepted && out.steps[0].cleared.filter((p) => p.r === 7)).toHaveLength(8);
    });
});

/** An rng value that picks colour `k` of the six (`floor(rng × 6)` = k). */
const colour = (k: number) => (k + 0.5) / 6;

describe('Round: points of whole clears worked out by hand (docs/spec/special-gems.md "テスト観点")', () => {
    it('a line stone that reaches a bomb in the same clear: 16 stones, (160 + 260) = 420 points in one step', () => {
        const rows = stamp(uniqueBoard(8, 8), 9, [[3, 3], [2, 4], [2, 5]]);
        const { round, ctl } = roundWith(rows);
        setKind(round, 'lineCol', 3, 3);
        setKind(round, 'bomb', 6, 3);
        // Refills, column by column: column 2 (3 cells), column 3 (8), column 4 (4), column 5 (1). Alternating colours
        // keep the refilled stones from lining up.
        ctl.next(
            ...[0, 1, 0, 2, 3, 2, 3, 2, 3, 2, 3, 4, 5, 4, 5, 0].map(colour),
        );
        const out = round.swap(pos(3, 3), pos(2, 3));
        expect(out.accepted).toBe(true);
        if (!out.accepted) return;
        expect(out.steps).toHaveLength(1);
        expect(out.steps[0].count).toBe(16);
        expect(out.steps[0].gain).toBe(420);
        expect(round.score).toBe(420);
        expect(ctl.pending()).toBe(0);
    });

    it('a colour stone swapped with a line stone: 9 stones, (90 + 120) = 210 points in one step', () => {
        const { round, ctl } = roundWith();
        round.board[4][4] = RAINBOW;
        setKind(round, 'rainbow', 4, 4);
        round.board[4][5] = 2; // the only stone of colour 2
        setKind(round, 'lineCol', 4, 5);
        ctl.next(...[2, 3, 2, 3, 2, 3, 2, 3, 0].map(colour)); // column 4 (8 cells), then (0,5)
        const out = round.swap(pos(4, 4), pos(4, 5));
        expect(out.accepted).toBe(true);
        if (!out.accepted) return;
        expect(out.steps).toHaveLength(1);
        expect(out.steps[0].count).toBe(9);
        expect(out.steps[0].gain).toBe(210);
        expect(round.score).toBe(210);
    });

    it('a 4 made by a refill in the second lap leaves a line stone and is worth 4 stones x chain 2: 120', () => {
        const rows = stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [6, 2]]);
        rows[0][3] = 0; // with the refills (0,0)..(0,2) of colour 0 it makes a run of 4 in row 0
        const { round, ctl } = roundWith(rows);
        ctl.next(...[0, 0, 0, 1, 2, 3].map(colour)); // lap 1: (0,0) (0,1) (0,2); lap 2: (0,0) (0,2) (0,3)
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted).toBe(true);
        if (!out.accepted) return;
        expect(out.steps.map((s) => [s.chain, s.count, s.gain])).toEqual([
            [1, 3, 30],
            [2, 4, 120],
        ]);
        expect(out.steps[1].spawned).toEqual([{ r: 0, c: 1, color: 0, kind: 'lineCol' }]);
        expect(round.kinds[0][1]).toBe('lineCol');
        expect(round.score).toBe(150);
        expect(ctl.pending()).toBe(0);
    });
});

describe('Round: moves, ending and shuffling with special stones', () => {
    it('on the last move a special stone is still made, goes off and scores, then the play ends without a shuffle', () => {
        const { round, ctl } = roundWith(four());
        ctl.next(0, 0.2, 0.4);
        round.moves = 1;
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted && out.next).toBe('ending');
        expect(round.moves).toBe(0);
        expect(round.score).toBe(60);
        expect(round.kinds[7][2]).toBe('lineCol');
    });

    it('never asks for a shuffle while a colour stone is on the board', () => {
        const rows = stamp(uniqueBoard(8, 8), 9, [[7, 0], [7, 1], [6, 2]]);
        const { round, ctl } = roundWith(rows);
        round.board[0][7] = RAINBOW;
        setKind(round, 'rainbow', 0, 7);
        ctl.next(0, 0.2, 0.4);
        const out = round.swap(pos(6, 2), pos(7, 2));
        expect(out.accepted && out.next).toBe('idle');
        expect(hasMove(round.board)).toBe(true);
    });

    it('reshuffle keeps every stone with its kind', () => {
        const stuck = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + 2 * c) % 6));
        const { round } = roundWith(stuck);
        setKind(round, 'lineRow', 1, 1);
        setKind(round, 'bomb', 4, 5);
        const pairs = () => round.board.flat().map((v, i) => `${v}:${round.kinds.flat()[i]}`).sort();
        const before = pairs();
        expect(round.reshuffle()).toBe(false);
        expect(pairs()).toEqual(before);
        expect(findMatches(round.board)).toEqual([]);
    });
});
