import { describe, expect, it } from 'vitest';
import { P } from '../params';
import type { Piece } from './board';
import { shapeCells } from './pieces';
import { createPlayer, feetY, type MoveInput, type Player } from './player';
import { Round } from './round';

const O = 1;
const I = 0;
const NONE: MoveInput = { left: false, right: false, jump: false };
const DT = 0.05;

const constant = (v: number) => () => v;
const piece = (kind: number, rot: number, col: number, y: number): Piece => ({
    kind, rot, cells: shapeCells(kind, rot), col, y,
});
const standingOn = (x: number, platformRow: number): Player => ({
    x, y: platformRow - P.PLAYER_H - 1e-6, vy: 0, onGround: true,
});
const newRound = (): Round => new Round(constant(0.9));

/** Frames until `done` holds (bounded), returning the elapsed seconds. */
const stepUntil = (round: Round, done: () => boolean, input: MoveInput = NONE): number => {
    let t = 0;
    for (let i = 0; i < 2000 && !done(); i++) {
        round.step(DT, input);
        t += DT;
    }
    return t;
};

describe('Round setup', () => {
    it('keeps the left edge open when the first roll is below 0.5', () => {
        expect(new Round(constant(0.3)).wellCol).toBe(0);
    });

    it('keeps the right edge open when the first roll is 0.5 or more', () => {
        expect(new Round(constant(0.5)).wellCol).toBe(P.COLS - 1);
        expect(new Round(constant(0.7)).wellCol).toBe(P.COLS - 1);
    });

    it('starts playing, on the floor, waiting SPAWN_DELAY for the first mino', () => {
        const round = newRound();
        expect(round.status).toBe('playing');
        expect(round.loseReason).toBeNull();
        expect(round.flow).toEqual({ kind: 'wait', timer: P.SPAWN_DELAY });
        expect(round.height).toBe(0);
        expect(round.maxHeight).toBe(0);
        expect(round.grid.flat().every((v) => v === 0)).toBe(true);
    });
});

describe('Round flow', () => {
    it('starts the telegraph SPAWN_DELAY after the round begins', () => {
        const round = newRound();
        const t = stepUntil(round, () => round.flow.kind === 'telegraph');
        expect(t).toBeGreaterThanOrEqual(P.SPAWN_DELAY);
        expect(t).toBeLessThan(P.SPAWN_DELAY + 2 * DT);
        expect(round.flow).toMatchObject({ kind: 'telegraph', t: 0 });
    });

    it('shows a hovering mino for TELEGRAPH_TIME before dropping it from row 0', () => {
        const round = newRound();
        stepUntil(round, () => round.flow.kind === 'telegraph');
        const plan = round.flow.kind === 'telegraph' ? round.flow.plan : null;
        const t = stepUntil(round, () => round.flow.kind === 'drop');
        expect(t).toBeGreaterThanOrEqual(P.TELEGRAPH_TIME - 1e-9);
        expect(t).toBeLessThan(P.TELEGRAPH_TIME + 2 * DT);
        expect(round.flow.kind).toBe('drop');
        if (round.flow.kind === 'drop' && plan) {
            expect(round.flow.piece).toMatchObject({ kind: plan.kind, rot: plan.rot, col: plan.col, y: 0 });
            expect(round.flow.plan).toEqual(plan);
        }
    });

    it('does not crush a player standing under the hovering mino', () => {
        const round = newRound();
        round.player = standingOn(4.65, P.ROWS); // on the floor
        round.flow = { kind: 'telegraph', plan: { kind: I, rot: 1, col: 4, row: 16 }, t: 0 };
        for (let i = 0; i < 10; i++) round.step(DT, NONE);
        expect(round.status).toBe('playing');
        expect(round.flow.kind).toBe('telegraph');
    });

    it('fixes the mino, then waits SPAWN_DELAY before the next one', () => {
        const round = newRound();
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 10), plan: { kind: O, rot: 0, col: 0, row: 18 } };
        stepUntil(round, () => round.flow.kind === 'wait');
        expect(round.grid[19][0]).toBe(O + 1);
        expect(round.grid[18][1]).toBe(O + 1);
        expect(round.flow).toEqual({ kind: 'wait', timer: P.SPAWN_DELAY });
        round.step(DT, NONE);
        expect(round.flow.kind).toBe('wait');
    });

    it('clamps a very long frame to MAX_DT', () => {
        const round = newRound();
        round.step(10, NONE);
        expect(round.flow).toEqual({ kind: 'wait', timer: P.SPAWN_DELAY - P.MAX_DT });
    });
});

describe('Round: losing', () => {
    it('is crushed when a falling mino lands on the player', () => {
        const round = newRound();
        round.flow = { kind: 'drop', piece: piece(O, 0, 4, 2), plan: { kind: O, rot: 0, col: 4, row: 18 } };
        stepUntil(round, () => round.status !== 'playing');
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('crushed');
    });

    it.each([0, P.TOP_OUT_ROW - 1])('tops out when a mino is fixed with its top edge on row %i', (row) => {
        const round = newRound();
        for (let r = row + 2; r < P.ROWS; r++) {
            round.grid[r][0] = 1;
            round.grid[r][1] = 1;
        }
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 0), plan: { kind: O, rot: 0, col: 0, row } };
        stepUntil(round, () => round.status !== 'playing' || round.flow.kind === 'wait');
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('toppedOut');
        expect(round.grid[row][0]).toBe(O + 1);
    });

    it('does not top out when the fixed mino starts exactly on TOP_OUT_ROW', () => {
        const round = newRound();
        for (let r = P.TOP_OUT_ROW + 2; r < P.ROWS; r++) {
            round.grid[r][0] = 1;
            round.grid[r][1] = 1;
        }
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 0), plan: { kind: O, rot: 0, col: 0, row: 2 } };
        stepUntil(round, () => round.flow.kind === 'wait');
        expect(round.status).toBe('playing');
        expect(round.grid[P.TOP_OUT_ROW][0]).toBe(O + 1);
    });

    it('reports a crush, not a top-out, when both happen on the same fixing', () => {
        const round = newRound();
        for (let r = P.TOP_OUT_ROW; r < P.ROWS; r++) {
            round.grid[r][0] = 1;
            round.grid[r][1] = 1;
        }
        round.player = { x: 0.2, y: 0.1, vy: 0, onGround: false };
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 0), plan: { kind: O, rot: 0, col: 0, row: 0 } };
        round.step(DT, NONE);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('crushed');
    });

    it('stops changing once the round has ended', () => {
        const round = newRound();
        round.flow = { kind: 'drop', piece: piece(O, 0, 4, 2), plan: { kind: O, rot: 0, col: 4, row: 18 } };
        stepUntil(round, () => round.status !== 'playing');
        const snapshot = JSON.stringify([round.grid, round.player, round.flow, round.status, round.maxHeight]);
        round.step(DT, { ...NONE, left: true });
        round.step(DT, { ...NONE, jump: true });
        expect(JSON.stringify([round.grid, round.player, round.flow, round.status, round.maxHeight])).toBe(snapshot);
    });

    it('ends within two minutes when the player never moves', () => {
        const round = new Round(constant(0.6));
        const elapsed = stepUntil(round, () => round.status !== 'playing');
        expect(elapsed).toBeLessThan(120);
        expect(round.status).toBe('lost');
        expect(round.loseReason).not.toBeNull();
    });
});

describe('Round: clearing', () => {
    const platform = (round: Round): void => {
        for (let c = 3; c <= 6; c++) round.grid[5][c] = 1;
        round.player = standingOn(4.65, 5);
        round.flow = { kind: 'wait', timer: 100 };
    };

    it('clears when the feet reach the goal row', () => {
        const round = newRound();
        platform(round);
        round.step(DT, NONE);
        expect(round.status).toBe('cleared');
        expect(round.height).toBe(P.ROWS - P.GOAL_ROW);
        expect(round.maxHeight).toBe(P.ROWS - P.GOAL_ROW);
    });

    it('does not clear one row lower', () => {
        const round = newRound();
        for (let c = 3; c <= 6; c++) round.grid[6][c] = 1;
        round.player = standingOn(4.65, 6);
        round.flow = { kind: 'wait', timer: 100 };
        round.step(DT, NONE);
        expect(round.status).toBe('playing');
        expect(round.height).toBe(P.ROWS - P.GOAL_ROW - 1);
    });

    it('is game over, not a clear, when a mino crushes the player in the same frame', () => {
        const round = newRound();
        platform(round);
        // A vertical I lands right on the player at the goal row.
        round.flow = { kind: 'drop', piece: piece(I, 1, 4, 1.5), plan: { kind: I, rot: 1, col: 4, row: 1 } };
        round.step(DT, NONE);
        expect(round.status).toBe('lost');
        expect(round.loseReason).toBe('crushed');
    });

    it('still clears when a line clear in the same frame moves the player back down', () => {
        const round = newRound();
        platform(round);
        // Row 19 is full except columns 0-1; an O fixed there completes it and shifts everything down.
        for (let c = 2; c < P.COLS; c++) round.grid[19][c] = 1;
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 17.9), plan: { kind: O, rot: 0, col: 0, row: 18 } };
        round.step(DT, NONE);
        expect(feetY(round.player)).toBeGreaterThan(P.GOAL_ROW + 0.5); // it was moved down by the clear
        expect(round.status).toBe('cleared');
    });
});

describe('Round: line clears', () => {
    it('removes a completed row and carries the standing player down with the stack', () => {
        const round = newRound();
        for (let c = 2; c < P.COLS; c++) round.grid[19][c] = 1; // row 19 missing columns 0-1
        for (let c = 4; c <= 6; c++) round.grid[18][c] = 1; // the platform the player stands on
        round.player = standingOn(4.65, 18);
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 17.9), plan: { kind: O, rot: 0, col: 0, row: 18 } };
        const before = feetY(round.player);
        round.step(DT, NONE);

        expect(round.status).toBe('playing');
        expect(round.flow).toEqual({ kind: 'wait', timer: P.SPAWN_DELAY });
        expect(round.grid[18].every((v) => v === 0)).toBe(true);
        expect([0, 1, 4, 5, 6].every((c) => round.grid[19][c] !== 0)).toBe(true);
        expect(round.grid[19].filter((v) => v !== 0)).toHaveLength(5);
        expect(feetY(round.player)).toBeCloseTo(before + 1, 6);
    });

    it('leaves a player who stands below the cleared row where they are', () => {
        const round = newRound();
        for (let c = 2; c < P.COLS; c++) round.grid[10][c] = 1; // row 10 missing columns 0-1
        for (let r = 11; r < P.ROWS; r++) {
            round.grid[r][0] = 1; // support so the O lands on rows 9-10
            round.grid[r][1] = 1;
        }
        round.flow = { kind: 'drop', piece: piece(O, 0, 0, 7.9), plan: { kind: O, rot: 0, col: 0, row: 9 } };
        const before = round.player.y;
        stepUntil(round, () => round.flow.kind === 'wait');
        // The row really was cleared: the old row 9 (just the O's top half) is now row 10.
        expect(round.grid[10][5]).toBe(0);
        expect(round.grid[10][0]).toBe(O + 1);
        expect(round.grid[10][1]).toBe(O + 1);
        expect(round.player.y).toBeCloseTo(before, 6);
    });
});

describe('Round: max height', () => {
    it('remembers the highest height reached, including airborne frames', () => {
        const round = newRound();
        round.flow = { kind: 'wait', timer: 100 };
        round.player = { x: 4.65, y: 8, vy: 0, onGround: false }; // feet at 8.9 -> height 11
        round.step(DT, NONE);
        const high = round.maxHeight;
        expect(high).toBe(11); // feet at 9.0 after one frame of falling: floor(20 - 9.0 + 0.01)
        round.player = createPlayer();
        round.step(DT, NONE);
        expect(round.height).toBe(0);
        expect(round.maxHeight).toBe(high);
    });
});
