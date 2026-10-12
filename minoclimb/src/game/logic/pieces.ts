// Tetromino shapes. Pure data and helpers, no Phaser.

export interface Cell {
    c: number;
    r: number;
}

/** Rotation-0 cells (column, row) of I, O, T, S, Z, J, L. */
const BASE_SHAPES: readonly (readonly [number, number][])[] = [
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[2, 0], [0, 1], [1, 1], [2, 1]],
];

export const KIND_COUNT = BASE_SHAPES.length;
export const ROTATION_COUNT = 4;

/** Rotates 90 degrees `rotation` times, then moves the bounding box's top-left to (0, 0). */
const buildCells = (kind: number, rotation: number): Cell[] => {
    let cells: Cell[] = BASE_SHAPES[kind].map(([c, r]) => ({ c, r }));
    for (let i = 0; i < rotation; i++) {
        cells = cells.map(({ c, r }) => ({ c: -r, r: c }));
    }
    const minC = Math.min(...cells.map((x) => x.c));
    const minR = Math.min(...cells.map((x) => x.r));
    return cells.map(({ c, r }) => ({ c: c - minC, r: r - minR }));
};

const TABLE: Cell[][][] = BASE_SHAPES.map((_, kind) =>
    Array.from({ length: ROTATION_COUNT }, (__, rot) => buildCells(kind, rot)));

/** Cells of `kind` rotated `rotation` times (any integer; wrapped to 0-3). Do not mutate the result. */
export const shapeCells = (kind: number, rotation: number): readonly Cell[] =>
    TABLE[kind][((rotation % ROTATION_COUNT) + ROTATION_COUNT) % ROTATION_COUNT];

export const shapeWidth = (cells: readonly Cell[]): number => {
    let max = 0;
    for (const { c } of cells) {
        if (c > max) max = c;
    }
    return max + 1;
};
