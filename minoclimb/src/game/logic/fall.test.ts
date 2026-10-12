import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { createGrid, type Grid, type Piece } from './board';
import { pieceCrushesPlayer, stepPiece, type FallResult } from './fall';
import { shapeCells } from './pieces';
import type { Player } from './player';

const I = 0;
const O = 1;

const piece = (kind: number, rot: number, col: number, y: number): Piece => ({
    kind, rot, cells: shapeCells(kind, rot), col, y,
});

/** A player with its top-left at (x, y); far from every piece unless stated. */
const playerAt = (x: number, y: number): Player => ({ x, y, vy: 0, onGround: false });
const FAR = playerAt(0, 0);

const fillRow = (grid: Grid, row: number): void => {
    for (let c = 0; c < P.COLS; c++) grid[row][c] = 1;
};

const dropUntilDone = (grid: Grid, start: Piece, player: Player, dt: number): FallResult => {
    let current = start;
    for (let i = 0; i < 1000; i++) {
        const res = stepPiece(grid, current, dt, player);
        if (res.crushed || res.lockedRow !== null) return res;
        current = res.piece;
    }
    throw new Error('piece never settled');
};

describe('pieceCrushesPlayer', () => {
    const cell = piece(O, 0, 4, 10); // covers x 4..6, y 10..12

    it('is true when the player overlaps a cell', () => {
        expect(pieceCrushesPlayer(cell, playerAt(5.0, 11.0))).toBe(true);
        expect(pieceCrushesPlayer(cell, playerAt(3.5, 10.5))).toBe(true);
    });

    it('is false when the rectangles only touch', () => {
        expect(pieceCrushesPlayer(cell, playerAt(6, 10.5))).toBe(false); // right edge x = 6
        expect(pieceCrushesPlayer(cell, playerAt(4 - P.PLAYER_W, 10.5))).toBe(false); // player right edge 4.0
        expect(pieceCrushesPlayer(cell, playerAt(4.5, 10 - P.PLAYER_H))).toBe(false); // feet exactly on the top edge
        expect(pieceCrushesPlayer(cell, playerAt(4.5, 12))).toBe(false); // below the bottom edge y = 12
    });

    it('is false when the player is clear of the piece', () => {
        expect(pieceCrushesPlayer(cell, playerAt(0, 0))).toBe(false);
        expect(pieceCrushesPlayer(cell, playerAt(4.5, 8.0))).toBe(false);
    });

    it('uses the fractional position of a falling piece', () => {
        // Piece top at 10.5: occupies y 10.5..12.5; a player whose feet are at 10.4 is clear, 10.6 is hit.
        const falling = piece(O, 0, 4, 10.5);
        expect(pieceCrushesPlayer(falling, playerAt(4.5, 10.4 - P.PLAYER_H))).toBe(false);
        expect(pieceCrushesPlayer(falling, playerAt(4.5, 10.6 - P.PLAYER_H))).toBe(true);
    });
});

describe('stepPiece', () => {
    it('falls DROP_SPEED cells per second in the open', () => {
        const res = stepPiece(createGrid(), piece(O, 0, 3, 0), 0.01, FAR);
        expect(res.lockedRow).toBeNull();
        expect(res.crushed).toBe(false);
        expect(res.piece.y).toBeCloseTo(P.DROP_SPEED * 0.01, 9);
    });

    it('fixes on the floor at the exact landing row', () => {
        const res = dropUntilDone(createGrid(), piece(O, 0, 3, 5), FAR, P.MAX_DT);
        expect(res.lockedRow).toBe(P.ROWS - 2);
        expect(res.piece.y).toBe(P.ROWS - 2);
    });

    it('fixes right above a locked cell', () => {
        const grid = createGrid();
        grid[10][3] = 1;
        const res = dropUntilDone(grid, piece(O, 0, 3, 2), FAR, P.MAX_DT);
        expect(res.lockedRow).toBe(8); // rows 8 and 9, directly above row 10
    });

    it('does not skip a one-cell-thick floor in a long step', () => {
        const grid = createGrid();
        fillRow(grid, 12); // thin floor
        // dt = 0.2 would move 8 cells in one go.
        const res = stepPiece(grid, piece(I, 0, 2, 5), 0.2, FAR);
        expect(res.lockedRow).toBe(11);
        expect(res.piece.y).toBe(11);
    });

    it('does not skip the floor with a MAX_DT frame (2 cells) either', () => {
        const grid = createGrid();
        fillRow(grid, 12);
        const res = dropUntilDone(grid, piece(I, 0, 2, 8.5), FAR, P.MAX_DT);
        expect(res.lockedRow).toBe(11);
    });

    it('locks at the starting row when blocked immediately', () => {
        const grid = createGrid();
        grid[1][3] = 1;
        const res = stepPiece(grid, piece(O, 0, 3, 0), 0.05, FAR);
        expect(res.lockedRow).toBe(0);
        expect(res.crushed).toBe(false);
    });

    it('crushes a player standing in its path before it lands', () => {
        // Player stands at the floor, feet at 20; piece comes down on the same columns.
        const player = playerAt(4.65, P.ROWS - P.PLAYER_H);
        const res = dropUntilDone(createGrid(), piece(O, 0, 4, 0), player, P.MAX_DT);
        expect(res.crushed).toBe(true);
        expect(res.lockedRow).toBeNull();
    });

    it('does not crush a player beside the piece', () => {
        const player = playerAt(0.5, P.ROWS - P.PLAYER_H);
        const res = dropUntilDone(createGrid(), piece(O, 0, 4, 0), player, P.MAX_DT);
        expect(res.crushed).toBe(false);
        expect(res.lockedRow).toBe(P.ROWS - 2);
    });

    it('crushes a player the piece only overlaps part-way through a long step', () => {
        // A flat I covers y 10..11 at the start and 12..13 after the 2-cell step, never touching the
        // player (y 11.05..11.95); only the intermediate sub-steps overlap it.
        const player = playerAt(2.65, 11.05);
        const start = piece(I, 0, 2, 10);
        expect(pieceCrushesPlayer(start, player)).toBe(false);
        expect(pieceCrushesPlayer({ ...start, y: 12 }, player)).toBe(false);
        const res = stepPiece(createGrid(), start, P.MAX_DT, player);
        expect(res.crushed).toBe(true);
        expect(res.lockedRow).toBeNull();
        expect(res.piece.y).toBeGreaterThan(10);
        expect(res.piece.y).toBeLessThan(12);
    });

    it('crushes at the landing row when the last step ends exactly there', () => {
        // The stack top is row 15; a piece landing at rows 13-14 overlaps a player standing on it.
        const grid = createGrid();
        grid[15][4] = 1;
        grid[15][5] = 1;
        const player = playerAt(4.65, 15 - P.PLAYER_H);
        const res = stepPiece(grid, piece(O, 0, 4, 12.95), 0.00125, player);
        expect(res.crushed).toBe(true);
        expect(res.lockedRow).toBeNull();
        expect(res.piece.y).toBe(13);
    });

    it('fixes normally when the player is only touching the landed piece from below', () => {
        // Stack rows 18-19: the piece lands on rows 16-17 (y 16..18); the player's top edge is at y = 18.
        const grid = createGrid();
        for (const r of [18, 19]) {
            grid[r][4] = 1;
            grid[r][5] = 1;
        }
        const player = playerAt(4.65, 18);
        const res = dropUntilDone(grid, piece(O, 0, 4, 10), player, P.MAX_DT);
        expect(res.crushed).toBe(false);
        expect(res.lockedRow).toBe(16);
    });
});
