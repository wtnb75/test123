// docs/spec/rising.md "テスト観点": the pure rules of the rising rows. Expected values are the spec's hand-worked ones.
import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { createGrid } from './board';
import type { Player } from './player';
import {
    cellsAfterRise, holeColumn, pushUpForRise, riseDue, riseGrid, riseMarker, risingEnabled,
} from './rising';

const standing = (x: number): Player => ({ x, y: P.ROWS - P.PLAYER_H - 1e-6, vy: 0, onGround: true });
const air = (x: number, y: number): Player => ({ x, y, vy: 3, onGround: false });

describe('risingEnabled', () => {
    it.each([[1, false], [2, true], [7, true], [999, true]])('stage %i -> %s', (stage, expected) => {
        expect(risingEnabled(stage)).toBe(expected);
    });
});

describe('holeColumn', () => {
    it.each([[0, 0], [0.5, 5], [0.35, 3], [0.999, 9], [0.1, 1]])('random %f picks column %i', (value, col) => {
        expect(holeColumn(value)).toBe(col);
    });

    it('never goes past the last column even for a value of exactly 1', () => {
        expect(holeColumn(1)).toBe(P.COLS - 1);
    });
});

describe('riseDue', () => {
    it('is not due just before the interval and due at it', () => {
        expect(riseDue(P.RISE_INTERVAL - 0.001)).toBe(false);
        expect(riseDue(P.RISE_INTERVAL)).toBe(true);
    });

    it('forgives floating point error below the interval', () => {
        expect(riseDue(P.RISE_INTERVAL - 1e-10)).toBe(true);
        expect(riseDue(P.RISE_INTERVAL - 1e-6)).toBe(false);
    });
});

describe('riseGrid', () => {
    it('fills the bottom row with RISE_CELL except in the hole column', () => {
        const grid = createGrid();
        expect(riseGrid(grid, 3)).toBe(false);
        expect(grid).toHaveLength(P.ROWS);
        const expected = Array<number>(P.COLS).fill(P.RISE_CELL);
        expected[3] = 0;
        expect(grid[P.ROWS - 1]).toEqual(expected);
        for (let r = 0; r < P.ROWS - 1; r++) expect(grid[r].every((v) => v === 0)).toBe(true);
    });

    it('moves every existing row up by one', () => {
        const grid = createGrid();
        grid[10][4] = 2;
        grid[19][0] = 5;
        riseGrid(grid, 9);
        expect(grid[9][4]).toBe(2);
        expect(grid[10][4]).toBe(0);
        expect(grid[18][0]).toBe(5);
    });

    it('is stacked too high when a cell on TOP_OUT_ROW moves above it', () => {
        const grid = createGrid();
        grid[P.TOP_OUT_ROW][6] = 1;
        expect(riseGrid(grid, 0)).toBe(true);
    });

    it('is not stacked too high when the highest cell lands exactly on TOP_OUT_ROW', () => {
        const grid = createGrid();
        grid[P.TOP_OUT_ROW + 1][6] = 1;
        expect(riseGrid(grid, 0)).toBe(false);
        expect(grid[P.TOP_OUT_ROW][6]).toBe(1);
    });

    it('lets row 0 leave the field without growing it', () => {
        const grid = createGrid();
        grid[0][1] = 3;
        riseGrid(grid, 0);
        expect(grid).toHaveLength(P.ROWS);
        expect(grid.flat().filter((v) => v === 3)).toHaveLength(0);
    });
});

describe('pushUpForRise (the spec examples; the field has risen, hole in column 0 unless noted)', () => {
    const risen = (hole: number, cells: [number, number][] = []) => {
        const grid = createGrid();
        for (const [c, r] of cells) grid[r][c] = 1;
        riseGrid(grid, hole);
        return grid;
    };

    it('lifts a climber standing on the floor by one cell', () => {
        const pushed = pushUpForRise(risen(0), standing(4.65));
        expect(pushed.y).toBeCloseTo(18.1, 4);
    });

    it('lifts a climber whose body covers a solid column even when the hole is under the other one', () => {
        expect(pushUpForRise(risen(4), standing(4.65)).y).toBeCloseTo(18.1, 4);
    });

    it('leaves a climber standing inside the hole column where it is', () => {
        const pl = standing(4.05);
        expect(pushUpForRise(risen(4), pl)).toBe(pl);
    });

    it('lifts an airborne climber by the part of the body the risen cell now covers (0.5 cell)', () => {
        // The cell (4, 18) becomes (4, 17); the feet at 17.5 sink 0.5 into it.
        const pushed = pushUpForRise(risen(0, [[4, 18]]), air(4.65, 16.6));
        expect(pushed.y).toBeCloseTo(16.1, 6);
    });

    it('does not move a climber whose feet only touch the risen cell', () => {
        const pl = air(4.65, 16.1);
        expect(pushUpForRise(risen(0, [[4, 18]]), pl)).toBe(pl);
    });

    it('treats a sink of under 1e-6 cell (floating point error) as touching, not as an overlap', () => {
        const pl = air(4.65, 16.1 + 5e-7);
        expect(pushUpForRise(risen(0, [[4, 18]]), pl)).toBe(pl);
    });

    it('takes the largest sink when the body covers several risen cells (the function contract, not a reachable state)', () => {
        // Cells (4, 17) and (5, 16) after the rise: the feet at 17.5 sink 0.5 and 1.5 into them.
        const pushed = pushUpForRise(risen(0, [[4, 18], [5, 17]]), air(4.65, 16.6));
        expect(pushed.y).toBeCloseTo(16.6 - 1.5, 6);
    });

    it('does not move a climber that stays clear above the risen cell', () => {
        const pl = air(4.65, 16.0);
        expect(pushUpForRise(risen(0, [[4, 18]]), pl)).toBe(pl);
    });

    it('lifts a climber standing on a stack by one cell, staying on top of it', () => {
        const pl: Player = { x: 4.65, y: 18 - P.PLAYER_H - 1e-6, vy: 0, onGround: true };
        const pushed = pushUpForRise(risen(0, [[4, 18]]), pl);
        expect(pushed.y).toBeCloseTo(pl.y - 1, 4);
    });

    it('changes only the vertical position', () => {
        const kick = { side: 1, since: 0.07, jumpHeld: true, kicked: true, barred: 1 } as const;
        const pl: Player = { x: 4.65, y: 19.1, vy: -2, onGround: true, kick };
        const pushed = pushUpForRise(risen(0), pl);
        expect({ ...pushed, y: 0 }).toEqual({ ...pl, y: 0 });
        expect(pushed.y).toBeLessThan(pl.y);
    });

    it('lets the climber go above the top of the field without clamping', () => {
        const pl = air(4.65, -3);
        expect(pushUpForRise(risen(0), pl)).toBe(pl);
    });

    it('pushes a climber whose body ends up above row 0 to a negative y (no clamp)', () => {
        const grid = createGrid();
        grid[0][4] = 1; // a risen cell in the top row (the push is judged on the field as given)
        const pushed = pushUpForRise(grid, air(4.65, -0.5)); // feet at 0.4 sink 0.4 into row 0
        expect(pushed.y).toBeCloseTo(-0.9, 6);
    });
});

describe('cellsAfterRise', () => {
    it('moves cells up one row', () => {
        expect(cellsAfterRise([{ c: 2, r: 19 }, { c: 3, r: 5 }])).toEqual([{ c: 2, r: 18 }, { c: 3, r: 4 }]);
    });
});

describe('riseMarker (RISE_INTERVAL 12, RISE_WARN_TIME 2, RISE_BLINK_HZ 4)', () => {
    it('is hidden before the last RISE_WARN_TIME seconds and shown from 10.0 s on, lit first', () => {
        expect(riseMarker(9.999).visible).toBe(false);
        expect(riseMarker(0).visible).toBe(false);
        expect(riseMarker(10)).toEqual({ visible: true, on: true });
    });

    it('is lit on 600 frames of 1/60 s even if the sum lands a hair under 10', () => {
        let elapsed = 0;
        for (let i = 0; i < 600; i++) elapsed += 1 / 60;
        expect(riseMarker(elapsed)).toEqual({ visible: true, on: true });
    });

    it.each([
        [10.124, true], [10.125, false], [10.249, false], [10.25, true], [10.375, false],
    ])('at %f s the triangles are lit: %s', (elapsed, on) => {
        expect(riseMarker(elapsed).on).toBe(on);
    });

    it('keeps blinking while the rise waits for a mino to lock (past the interval)', () => {
        expect(riseMarker(12)).toEqual({ visible: true, on: true });
        expect(riseMarker(12.125)).toEqual({ visible: true, on: false });
    });
});
