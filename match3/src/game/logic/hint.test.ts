import { describe, expect, it } from 'vitest';
import { COLS, ROWS } from '../params';
import { findMove, normalKinds, RAINBOW, type Board, type Kinds, type Pos } from './board';
import { findHint } from './hint';
import { Round } from './round';
import { pos, seeded, setBoard, stamp, uniqueBoard } from './testing';

const empty = (): { board: Board; kinds: Kinds } => ({ board: uniqueBoard(ROWS, COLS), kinds: normalKinds(ROWS, COLS) });
const key = (m: [Pos, Pos] | null) => (m ? m.map((p) => `${p.r},${p.c}`).sort().join('|') : null);

/** A 3-clear by a vertical swap of (r, 2) and (r + 1, 2): colour `v` at (r, 0), (r, 1) and (r + 1, 2). Lower row r + 1. */
const verticalThree = (board: Board, v: number, r: number) => stamp(board, v, [[r, 0], [r, 1], [r + 1, 2]]);

describe('findHint: which move the hint points at', () => {
    it('returns null when no swap clears anything', () => {
        const { board, kinds } = empty();
        expect(findHint(board, kinds)).toBeNull();
    });

    it('returns the only move when there is just one', () => {
        const { board, kinds } = empty();
        verticalThree(board, 1, 2);
        expect(key(findHint(board, kinds))).toBe(key([pos(2, 2), pos(3, 2)]));
    });

    it('prefers a move whose lower stone is on a lower row over one earlier in the search order', () => {
        const { board, kinds } = empty();
        verticalThree(board, 1, 1); // lower row 2, first in search order
        verticalThree(board, 2, 5); // lower row 6
        expect(key(findHint(board, kinds))).toBe(key([pos(5, 2), pos(6, 2)]));
    });

    it('takes the lowest row of the pair as the row of a vertical swap, and the stone row for a horizontal swap', () => {
        const { board, kinds } = empty();
        verticalThree(board, 1, 4); // vertical swap of rows 4 and 5: row 5, earlier in search order
        stamp(board, 2, [[5, 4], [5, 5], [5, 7]]); // horizontal swap of (5, 6) and (5, 7): row 5, 3 stones
        // Same row 5 and the same count: the search order decides, so the vertical swap (earlier stone) wins.
        expect(key(findHint(board, kinds))).toBe(key([pos(4, 2), pos(5, 2)]));
    });

    it('lets a horizontal swap on a lower row beat a vertical swap whose upper stone is higher', () => {
        const { board, kinds } = empty();
        verticalThree(board, 1, 4); // row 5
        stamp(board, 2, [[6, 4], [6, 5], [6, 7]]); // horizontal swap on row 6
        expect(key(findHint(board, kinds))).toBe(key([pos(6, 6), pos(6, 7)]));
    });

    it.each([
        ['the bigger clear is later in the search order', 'later'],
        ['the bigger clear is earlier in the search order', 'earlier'],
    ])('on the same row prefers the move that clears more stones (%s)', (_name, where) => {
        const { board, kinds } = empty();
        const three = (c: number) => stamp(board, 1, [[3, c], [3, c + 1], [4, c + 2]]); // swap (3, c+2) with (4, c+2)
        const four = (c: number) => stamp(board, 2, [[3, c], [3, c + 1], [3, c + 3], [4, c + 2]]); // 4 in row 3
        if (where === 'later') {
            three(0);
            four(4); // needs c + 3 <= 7
            expect(key(findHint(board, kinds))).toBe(key([pos(3, 6), pos(4, 6)]));
        } else {
            four(0);
            three(5);
            expect(key(findHint(board, kinds))).toBe(key([pos(3, 2), pos(4, 2)]));
        }
    });

    it('breaks a tie of row and count by the search order (top row, left stone first)', () => {
        const { board, kinds } = empty();
        stamp(board, 1, [[3, 4], [3, 5], [4, 6]]);
        stamp(board, 2, [[3, 0], [3, 1], [4, 2]]);
        expect(key(findHint(board, kinds))).toBe(key([pos(3, 2), pos(4, 2)]));
    });

    it('counts the stones a special stone takes with it', () => {
        const { board, kinds } = empty();
        stamp(board, 1, [[3, 0], [3, 1], [4, 2]]); // 3 stones, lower row 4, first in search order
        stamp(board, 2, [[3, 4], [3, 5], [4, 6]]); // 3 stones in the run ...
        kinds[3][4] = 'lineRow'; // ... but the line stone clears the whole of row 3 (8 stones)
        expect(key(findHint(board, kinds))).toBe(key([pos(3, 6), pos(4, 6)]));
    });

    it('puts a colour-stone swap among the others by the same measure: more stones win on the same row', () => {
        const { board, kinds } = empty();
        board[7][3] = RAINBOW;
        kinds[7][3] = 'rainbow';
        stamp(board, 7, [[7, 4], [0, 0], [0, 5], [2, 2], [5, 6]]); // colour 7 has 5 stones: swapping with (7, 4) clears 6
        stamp(board, 1, [[7, 0], [7, 1], [6, 2]]); // a plain 3-clear on row 7, earlier in the search order
        expect(key(findHint(board, kinds))).toBe(key([pos(7, 3), pos(7, 4)]));
    });

    it('does not favour a colour-stone swap that clears fewer stones than a plain move on the same row', () => {
        const { board, kinds } = empty();
        board[7][3] = RAINBOW;
        kinds[7][3] = 'rainbow'; // every neighbour colour is unique: a colour swap clears only 2
        stamp(board, 1, [[7, 0], [7, 1], [6, 2]]); // a plain 3-clear on row 7
        expect(key(findHint(board, kinds))).toBe(key([pos(6, 2), pos(7, 2)]));
    });

    it('lets a colour-stone swap on a lower row beat a bigger plain clear above it', () => {
        const { board, kinds } = empty();
        board[7][3] = RAINBOW;
        kinds[7][3] = 'rainbow'; // only a 2-stone colour swap, on row 7
        stamp(board, 1, [[3, 0], [3, 1], [3, 3], [4, 2]]);
        stamp(board, 1, [[3, 4]]); // a 5-stone plain clear on row 4
        // The colour stone has three swaps (all 2 stones on row 7); the first in search order is the one with (6, 3).
        expect(key(findHint(board, kinds))).toBe(key([pos(6, 3), pos(7, 3)]));
    });

    it('counts the line stone a colour stone is swapped with (its whole row goes too)', () => {
        const { board, kinds } = empty();
        board[7][3] = RAINBOW;
        kinds[7][3] = 'rainbow';
        kinds[7][4] = 'lineRow'; // its colour is unique: the colour swap clears the 2 stones plus all of row 7
        stamp(board, 1, [[7, 0], [7, 1], [6, 2]]); // a plain 3-clear on row 7, earlier in the search order
        expect(key(findHint(board, kinds))).toBe(key([pos(7, 3), pos(7, 4)]));
    });

    it('leaves the board and the kinds as they were and gives the same move every time', () => {
        const { board, kinds } = empty();
        verticalThree(board, 1, 1);
        verticalThree(board, 2, 5);
        kinds[1][0] = 'bomb';
        const before = JSON.stringify([board, kinds]);
        const first = findHint(board, kinds);
        expect(JSON.stringify([board, kinds])).toBe(before);
        expect(findHint(board, kinds)).toEqual(first);
    });
});

/** The oracle's own playground: one Round whose position is overwritten with a copy of `from` before each trial. */
const scratch = new Round(seeded(1));
function cloneRound(from: Round): Round {
    scratch.moves = from.moves;
    setBoard(scratch.board, from.board);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) scratch.kinds[r][c] = from.kinds[r][c];
    return scratch;
}

/**
 * Brute force: try every ordered neighbour pair on a copy of the round, keep the accepted ones with the stones their
 * first clear counts, and sort by the spec's order (lower row, more stones, earlier stone, right before down).
 */
function oracle(round: Round): [Pos, Pos] | null {
    const cands: { a: Pos; b: Pos; row: number; count: number; order: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            for (const [dr, dc] of [[0, 1], [1, 0]]) {
                const a = pos(r, c);
                const b = pos(r + dr, c + dc);
                if (b.r >= ROWS || b.c >= COLS) continue;
                const out = cloneRound(round).swap(a, b);
                const back = cloneRound(round).swap(b, a); // the other stone first: the count must not depend on it
                if (out.accepted !== back.accepted) expect.fail(`order changes acceptance at ${key([a, b])}`);
                if (!out.accepted) continue;
                if (back.accepted && back.steps[0].count !== out.steps[0].count) {
                    expect.fail(`order changes the count at ${key([a, b])}: ${out.steps[0].count} vs ${back.steps[0].count}`);
                }
                cands.push({ a, b, row: Math.max(a.r, b.r), count: out.steps[0].count, order: (r * COLS + c) * 2 + dr });
            }
        }
    }
    cands.sort((x, y) => y.row - x.row || y.count - x.count || x.order - y.order);
    return cands.length > 0 ? [cands[0].a, cands[0].b] : null;
}

describe('findHint against a brute-force oracle on boards reached by real play', () => {
    it('matches the oracle in every state of many seeded plays, and exercises specials and a changed choice', () => {
        let states = 0;
        let withSpecials = 0;
        let differsFromFirstMove = 0;
        for (let seed = 1; seed <= 30; seed++) {
            const round = new Round(seeded(seed));
            for (let turn = 0; turn < 30; turn++) {
                const hint = findHint(round.board, round.kinds);
                const want = oracle(round);
                states++;
                if (key(hint) !== key(want)) expect.fail(`seed ${seed} turn ${turn}: ${key(hint)} != ${key(want)}`);
                if ((hint === null) !== (findMove(round.board) === null)) expect.fail(`seed ${seed} turn ${turn}: move existence differs`);
                if (!hint) break;
                if (round.kinds.some((row) => row.some((k) => k !== 'normal'))) withSpecials++;
                if (key(hint) !== key(findMove(round.board))) differsFromFirstMove++;
                const out = round.swap(hint[0], hint[1]);
                if (!out.accepted) expect.fail(`seed ${seed} turn ${turn}: the hint's move was refused`);
                if (out.next === 'ending') break;
                if (out.next === 'shuffle') round.reshuffle();
            }
        }
        expect(states).toBeGreaterThan(150);
        expect(withSpecials).toBeGreaterThan(0);
        expect(differsFromFirstMove).toBeGreaterThan(30);
    });

    it('finds a move exactly when findMove does (the existence of a move is unchanged)', () => {
        for (let seed = 1; seed <= 30; seed++) {
            const round = new Round(seeded(seed));
            expect(findHint(round.board, round.kinds) === null).toBe(findMove(round.board) === null);
        }
    });
});
