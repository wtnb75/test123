import { describe, expect, it } from 'vitest';
import { P } from '../params';
import type { Piece } from './board';
import { shapeCells } from './pieces';
import type { MoveInput, Player } from './player';
import { Round, type RoundEvent } from './round';

const O = 1;
const NONE: MoveInput = { left: false, right: false, jump: false };
const DT = 0.05;

const newRound = (): Round => new Round(() => 0.9);
const piece = (kind: number, rot: number, col: number, y: number): Piece => ({
    kind, rot, cells: shapeCells(kind, rot), col, y,
});
const away: Player = { x: 8, y: 5, vy: 0, onGround: false };
const cells = (...pairs: [number, number][]) => pairs.map(([c, r]) => ({ c, r }));

const drain = (round: Round): RoundEvent[] => {
    const out: RoundEvent[] = [];
    round.drainEvents((e) => out.push(e));
    return out;
};

describe('Round events for the presentation layer', () => {
    it('reports where a fixed mino landed, then forgets the event', () => {
        const round = newRound();
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 10), plan: { kind: O, rot: 0, col: 0, row: 18 } };
        const waiting = (): boolean => round.flow.kind === 'wait';
        for (let i = 0; i < 100 && !waiting(); i++) round.step(DT, NONE);
        expect(drain(round)).toEqual([{ kind: 'locked', cells: cells([0, 18], [1, 18], [0, 19], [1, 19]) }]);
        expect(drain(round)).toEqual([]);
    });

    it('reports a cleared row, with the fixed cells at their positions after the clear', () => {
        const round = newRound();
        for (let c = 2; c < P.COLS; c++) round.grid[19][c] = 1; // row 19 missing columns 0-1
        round.player = away;
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 17.9), plan: { kind: O, rot: 0, col: 0, row: 18 } };
        round.step(DT, NONE);
        // The O filled rows 18 and 19; row 19 is cleared and the upper half comes down onto row 19.
        expect(drain(round)).toEqual([
            { kind: 'locked', cells: cells([0, 19], [1, 19]) },
            { kind: 'cleared', rows: [19] },
        ]);
    });

    it('reports several cleared rows in ascending order and no cells when all of them were cleared', () => {
        const round = newRound();
        for (const r of [18, 19]) for (let c = 2; c < P.COLS; c++) round.grid[r][c] = 1;
        round.player = away;
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 17.9), plan: { kind: O, rot: 0, col: 0, row: 18 } };
        round.step(DT, NONE);
        expect(drain(round)).toEqual([
            { kind: 'locked', cells: [] },
            { kind: 'cleared', rows: [18, 19] },
        ]);
    });

    it('leaves no events behind when the same frame also clears the goal', () => {
        const round = newRound();
        for (let c = 3; c <= 6; c++) round.grid[5][c] = 1; // a platform at the goal row
        round.player = { x: 4.65, y: 5 - P.PLAYER_H - 1e-6, vy: 0, onGround: true };
        for (let c = 2; c < P.COLS; c++) round.grid[19][c] = 1;
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 17.9), plan: { kind: O, rot: 0, col: 0, row: 18 } };
        round.step(DT, NONE);
        expect(round.status).toBe('cleared');
        expect(drain(round)).toEqual([]);
    });

    it('reports nothing when the round ends on a crush', () => {
        const round = newRound();
        round.flow = { kind: 'drop', piece: piece(O, 0, 4, 2), plan: { kind: O, rot: 0, col: 4, row: 18 } };
        for (let i = 0; i < 200 && round.status === 'playing'; i++) round.step(DT, NONE);
        expect(round.loseReason).toBe('crushed');
        expect(drain(round)).toEqual([]);
    });

    it('reports nothing when the round ends on a top-out', () => {
        const round = newRound();
        for (let r = P.TOP_OUT_ROW; r < P.ROWS; r++) {
            round.grid[r][0] = 1;
            round.grid[r][1] = 1;
        }
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 0), plan: { kind: O, rot: 0, col: 0, row: 0 } };
        round.step(DT, NONE);
        expect(round.loseReason).toBe('toppedOut');
        expect(drain(round)).toEqual([]);
    });
});
