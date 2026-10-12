import { describe, expect, it } from 'vitest';
import { KIND_COUNT, ROTATION_COUNT, shapeCells, shapeWidth, type Cell } from './pieces';

const key = (cells: readonly Cell[]): string =>
    cells.map(({ c, r }) => `${c},${r}`).sort().join(' ');

/** Independent oracle: rotate clockwise on a bitmap (new column = maxRow - row, new row = old column). */
const rotateClockwise = (cells: readonly Cell[]): Cell[] => {
    const maxR = Math.max(...cells.map((x) => x.r));
    return cells.map(({ c, r }) => ({ c: maxR - r, r: c }));
};

describe('shapeCells', () => {
    it('has 7 kinds and 4 rotations', () => {
        expect(KIND_COUNT).toBe(7);
        expect(ROTATION_COUNT).toBe(4);
    });

    it('rotation 0 of every kind matches the spec table', () => {
        const expected = [
            '0,0 1,0 2,0 3,0', // I
            '0,0 0,1 1,0 1,1', // O
            '0,0 1,0 1,1 2,0', // T
            '0,1 1,0 1,1 2,0', // S
            '0,0 1,0 1,1 2,1', // Z
            '0,0 0,1 1,1 2,1', // J
            '0,1 1,1 2,0 2,1', // L
        ];
        for (let kind = 0; kind < KIND_COUNT; kind++) {
            expect(key(shapeCells(kind, 0))).toBe(expected[kind]);
        }
    });

    it('packs every rotation into the bounding box corner with four distinct cells', () => {
        for (let kind = 0; kind < KIND_COUNT; kind++) {
            for (let rot = 0; rot < ROTATION_COUNT; rot++) {
                const cells = shapeCells(kind, rot);
                expect(cells).toHaveLength(4);
                expect(Math.min(...cells.map((x) => x.c))).toBe(0);
                expect(Math.min(...cells.map((x) => x.r))).toBe(0);
                expect(new Set(cells.map((x) => `${x.c},${x.r}`)).size).toBe(4);
            }
        }
    });

    it('matches an independently written clockwise rotation for every kind and rotation', () => {
        let compared = 0;
        for (let kind = 0; kind < KIND_COUNT; kind++) {
            let expected = [...shapeCells(kind, 0)];
            for (let rot = 1; rot <= ROTATION_COUNT; rot++) {
                expected = rotateClockwise(expected);
                expect(key(shapeCells(kind, rot))).toBe(key(expected));
                compared++;
            }
        }
        expect(compared).toBe(28);
    });

    it('returns to the original shape after four rotations', () => {
        for (let kind = 0; kind < KIND_COUNT; kind++) {
            expect(key(shapeCells(kind, 4))).toBe(key(shapeCells(kind, 0)));
        }
    });

    it('wraps negative rotations', () => {
        expect(key(shapeCells(2, -1))).toBe(key(shapeCells(2, 3)));
    });

    it('rotates a vertical I from the horizontal one', () => {
        expect(key(shapeCells(0, 1))).toBe('0,0 0,1 0,2 0,3');
    });

    it('rotates T so its nub points left when turned once', () => {
        // (c, r) -> (-r, c) gives (0,0)(0,1)(0,2)(-1,1); shifted by +1 column.
        expect(key(shapeCells(2, 1))).toBe('0,1 1,0 1,1 1,2');
    });

    it('keeps O identical in all four rotations', () => {
        for (let rot = 1; rot < ROTATION_COUNT; rot++) {
            expect(key(shapeCells(1, rot))).toBe(key(shapeCells(1, 0)));
        }
    });
});

describe('shapeWidth', () => {
    it('is 4 for a horizontal I and 1 for a vertical I', () => {
        expect(shapeWidth(shapeCells(0, 0))).toBe(4);
        expect(shapeWidth(shapeCells(0, 1))).toBe(1);
    });

    it('is 2 for O and 3 for the other kinds in rotation 0', () => {
        expect(shapeWidth(shapeCells(1, 0))).toBe(2);
        for (const kind of [2, 3, 4, 5, 6]) expect(shapeWidth(shapeCells(kind, 0))).toBe(3);
    });
});
