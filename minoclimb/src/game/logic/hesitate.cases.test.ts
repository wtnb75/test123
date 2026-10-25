import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { shapeCells } from './pieces';
import { Round } from './round';

// Boundary and spec-example cases of the hesitating drop (docs/spec.md テスト観点 の 躊躇（追加）).

const NONE = { left: false, right: false, jump: false };
const DT = 1 / 60;
const I = 0;

const plan = (kind: number, rot: number, col: number, row: number) => ({ kind, rot, col, row });

/** A round whose falling I (rotation 0, column 0) starts at `y` and lands at `row`. */
const fallingAt = (y: number, row: number): Round => {
    const round = new Round(() => 0.5, { crumble: false });
    round.flow = {
        kind: 'drop',
        piece: { kind: I, rot: 0, cells: shapeCells(I, 0), col: 0, y },
        plan: plan(I, 0, 0, row),
    };
    return round;
};

describe('the stop threshold is exact (no tolerance: y ≥ HESITATE_AT × landing row)', () => {
    it('a mino that already stands at the stop row holds on its first frame', () => {
        // landing row 14 -> stop row 7; the mino starts at 7, so the rule applies at once
        const round = fallingAt(7, 14);
        round.step(DT, NONE);
        expect(round.flow.kind).toBe('drop');
        if (round.flow.kind === 'drop') expect(round.flow.piece.y).toBe(7);
        // it is still held (no fall) on the second frame
        round.step(DT, NONE);
        if (round.flow.kind === 'drop') expect(round.flow.piece.y).toBe(7);
    });

    it('the stop frame consumes exactly the time to the stop, and the hold takes the remainder of that frame', () => {
        // start 5, stop 7, speed 40: exactly 0.05 s to the stop, which is the largest frame step (MAX_DT)
        const round = fallingAt(5, 14);
        round.step(P.MAX_DT, NONE);
        if (round.flow.kind === 'drop') expect(round.flow.piece.y).toBe(7);
    });
});

describe('the spec example: a landing at row 10 stops at row 5 and a player under it is crushed on the first stopped frame', () => {
    it('stops at row 5 (HESITATE_AT × 10) for HESITATE_TIME (15 frames), then falls on', () => {
        const round = fallingAt(0, 10);
        const ys: number[] = [];
        for (let i = 0; i < 40 && round.flow.kind === 'drop'; i++) {
            round.step(DT, NONE);
            if (round.flow.kind === 'drop') ys.push(round.flow.piece.y);
        }
        // the mino reaches 5 at the end of its 8th frame (5 / (40 × DT) = 7.5 frames); the first frames are at 5
        const first = ys.findIndex((y) => Math.abs(y - 5) < 1e-9);
        expect(first).toBeGreaterThanOrEqual(0);
        // the stop lasts 15 frames of time (0.25 s): the frames at exactly 5 run from `first` for 15 frames,
        // the first of them holding the remainder of the frame that reached the stop
        const stationary = ys.slice(first, first + 15);
        for (const y of stationary) expect(Math.abs(y - 5)).toBeLessThan(1e-9);
        expect(ys[first + 15]).toBeGreaterThan(5);
    });

    it('a player under the mino at row 5 is crushed on the first frame of the stop', () => {
        const round = fallingAt(5, 10); // already at the stop row
        round.player = { x: 1, y: 5.2, vy: 0, onGround: false };
        round.step(DT, NONE);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('crushed');
    });
});

describe('the switch for the baseline (RoundOptions.hesitate = false)', () => {
    it('with the switch off the same placement never stops (the pre-pause baseline of the measurements)', () => {
        const round = new Round(() => 0.5, { crumble: false, hesitate: false });
        round.flow = {
            kind: 'drop',
            piece: { kind: I, rot: 0, cells: shapeCells(I, 0), col: 0, y: 0 },
            plan: plan(I, 0, 0, 14),
        };
        let last = -1;
        for (let i = 0; i < 12 && round.flow.kind === 'drop'; i++) {
            round.step(DT, NONE);
            if (round.flow.kind === 'drop') {
                expect(round.flow.piece.y).toBeGreaterThan(last);
                last = round.flow.piece.y;
            }
        }
    });
});
