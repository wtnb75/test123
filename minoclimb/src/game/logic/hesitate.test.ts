import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { hesitates } from './fall';
import { shapeCells } from './pieces';
import { type MoveInput, type Player } from './player';
import { Round } from './round';

// The hesitating drop (docs/spec.md "1 個のミノの流れ" 2, 完了条件 の躊躇の節): a fixed rule, and one timed pause.

const NONE: MoveInput = { left: false, right: false, jump: false };
const DT = 1 / 60;
const I = 0;
const O = 1;
const T = 2;
const J = 5;

const plan = (kind: number, rot: number, col: number, row: number) => ({ kind, rot, col, row });

describe('hesitates: the fixed rule (no random draw)', () => {
    it('never pauses a placement that lands shallower than HESITATE_MIN_ROWS', () => {
        // the rule value is 0 (would pause), but the landing row 3 is below the minimum of 4
        expect(hesitates(plan(I, 0, 0, 3))).toBe(false);
    });

    it('pauses a placement that lands at HESITATE_MIN_ROWS when its rule value is below HESITATE_BELOW', () => {
        expect(hesitates(plan(I, 0, 0, 4))).toBe(true); // (0 + 0 + 0) mod 10 = 0 < 3
    });

    it('does not pause when the rule value is exactly HESITATE_BELOW', () => {
        // I, rot 0, col 1: (0 + 0 + 3) mod 10 = 3, not below 3
        expect(hesitates(plan(I, 0, 1, 14))).toBe(false);
    });

    it('pauses at rule value 2 (just below the threshold)', () => {
        // I, rot 0, col 4: (0 + 0 + 12) mod 10 = 2 < 3
        expect(hesitates(plan(I, 0, 4, 14))).toBe(true);
    });

    it('matches the hand-worked examples of the spec', () => {
        expect(hesitates(plan(O, 0, 1, 14))).toBe(true); // 7 + 3 = 10 -> 0
        expect(hesitates(plan(T, 1, 0, 14))).toBe(false); // 14 + 5 = 19 -> 9
        expect(hesitates(plan(J, 0, 1, 14))).toBe(false); // 35 + 3 = 38 -> 8
    });

    it('gives the same answer every time it is asked (it is a pure function of the placement)', () => {
        const p = plan(O, 2, 3, 9);
        expect(hesitates(p)).toBe(hesitates(p));
    });
});

/** A round whose falling mino is an I at column 0 with the given rotation, landing at row 14. */
const fallingI = (rot: number, rng: () => number = () => 0.5): Round => {
    const round = new Round(rng, { crumble: false });
    round.flow = {
        kind: 'drop',
        piece: { kind: I, rot, cells: shapeCells(I, rot), col: 0, y: 0 },
        plan: plan(I, rot, 0, 14),
    };
    return round;
};

/** The mino's top row after each frame, until the drop is over or `max` frames have run. */
const trace = (round: Round, max: number): number[] => {
    const ys: number[] = [];
    for (let i = 0; i < max && round.flow.kind === 'drop'; i++) {
        round.step(DT, NONE);
        if (round.flow.kind === 'drop') ys.push(round.flow.piece.y);
    }
    return ys;
};

describe('the pause in Round: timing on the round clock', () => {
    it('stops at half of the landing row (y = HESITATE_AT × 14 = 7), not beyond it', () => {
        const ys = trace(fallingI(0), 12);
        // y after frame 10 is 10 × 40 × DT ≈ 6.667; frame 11 reaches 7 exactly and holds the rest of the frame
        expect(ys[9]).toBeCloseTo(10 * P.DROP_SPEED * DT, 9);
        expect(ys[10]).toBeCloseTo(P.HESITATE_AT * 14, 9);
    });

    it('holds for exactly HESITATE_TIME (15 frames of 1/60 s) and then falls on at DROP_SPEED', () => {
        const ys = trace(fallingI(0), 60);
        const stop = P.HESITATE_AT * 14;
        // frames 11..25 (1-based) are stationary at the stop row: the first holds the leftover half frame,
        // the next fourteen hold a whole frame each, and frame 26 holds half a frame and falls for the other half
        for (let f = 10; f <= 24; f++) expect(ys[f]).toBeCloseTo(stop, 9);
        expect(ys[25]).toBeCloseTo(stop + P.DROP_SPEED * (DT / 2), 9);
    });

    it('pauses once per mino: after the hold it never stops again before it lands', () => {
        const ys = trace(fallingI(0), 400);
        // after the hold (from index 25 on), every frame moves the mino down
        for (let f = 26; f < ys.length; f++) {
            expect(ys[f]).toBeGreaterThan(ys[f - 1]);
        }
    });

    it('a placement that does not hesitate keeps falling every frame', () => {
        // I, rot 1: (0 + 5 + 0) mod 10 = 5, not below 3, so no pause
        const ys = trace(fallingI(1), 10);
        for (let f = 1; f < ys.length; f++) expect(ys[f]).toBeGreaterThan(ys[f - 1]);
    });

    it('a placement that lands shallower than HESITATE_MIN_ROWS does not pause (row 3)', () => {
        const round = new Round(() => 0.5, { crumble: false });
        round.flow = {
            kind: 'drop',
            piece: { kind: I, rot: 0, cells: shapeCells(I, 0), col: 0, y: 0 },
            plan: plan(I, 0, 0, 3),
        };
        const ys = trace(round, 10);
        for (let f = 1; f < ys.length; f++) expect(ys[f]).toBeGreaterThan(ys[f - 1]);
    });
});

describe('the pause in Round: crush and randomness', () => {
    it('crushes a player who is under the stopped mino during the pause (the crush test runs each frame)', () => {
        const round = fallingI(0);
        // run to the stop; the mino covers columns 0-3 at row 7 (top row 7, one cell high)
        trace(round, 11);
        // put the player under the mino, overlapping its cell at column 1 (x 1.0 .. 1.7, feet below row 7)
        const under: Player = { x: 1, y: 7.2, vy: 0, onGround: false };
        round.player = under;
        for (let i = 0; i < 10 && round.status === 'playing'; i++) round.step(DT, NONE);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('crushed');
    });

    it('draws no random value for the rule or the pause', () => {
        let calls = 0;
        const rng = (): number => {
            calls++;
            return 0.5;
        };
        const round = fallingI(0, rng);
        const afterConstruction = calls;
        trace(round, 60);
        expect(calls).toBe(afterConstruction);
    });
});
