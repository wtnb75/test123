import { describe, expect, it } from 'vitest';
import { canPlaceMine } from './board';
import { emptyHistory, recordMove, undo } from './history';
import { paintModeAt, strokeStatus, strokeStatusText } from './paint';
import {
    TOOLS,
    TOOL_DEFAULT,
    applyShape,
    fillRegion,
    frameCells,
    isShapeTool,
    previewCells,
    rectCells,
    shapeCells,
    type Tool
} from './shapes';

/** Cell index of (row, col) on a board `width` cells wide. */
const at = (width: number, y: number, x: number): number => y * width + x;
const cellsAt = (width: number, pairs: [number, number][]): number[] => pairs.map(([y, x]) => at(width, y, x));

/** Mines as a flag array from [row, col] pairs. */
function minesOf(width: number, height: number, pairs: [number, number][]): boolean[] {
    const flags = Array.from({ length: width * height }, () => false);
    for (const [y, x] of pairs) {
        flags[at(width, y, x)] = true;
    }
    return flags;
}

/** A placeable rule for a board with start cell (5,5) on a 12 x 12 board (or no start cell). */
function placeableFor(width: number, height: number, start: [number, number] | null): (index: number) => boolean {
    const startIndex = start === null ? null : at(width, ...start);
    return (index) => canPlaceMine({ width, height, cells: Array.from({ length: width * height }, () => ({ hasMine: false })) }, startIndex, index);
}

describe('tools', () => {
    it('lists the five tools in the order of the sidebar, starting with the pen', () => {
        expect(TOOLS.map((t) => t.tool)).toEqual(['pen', 'line', 'rect', 'frame', 'fill']);
        expect(TOOLS.map((t) => t.label)).toEqual(['ペン', '線', '矩形', '枠', '塗りつぶし']);
        expect(TOOL_DEFAULT).toBe('pen');
    });

    it('treats only line, rect and frame as drag-range tools', () => {
        const flags = TOOLS.map(({ tool }) => isShapeTool(tool as Tool));
        expect(flags).toEqual([false, true, true, true, false]);
    });
});

describe('rectCells', () => {
    it('covers every cell of the rectangle between two corners, row by row', () => {
        // (1,1)→(2,3) on a 12-wide board: 2 rows x 3 columns = 6 cells.
        expect(rectCells(at(12, 1, 1), at(12, 2, 3), 12)).toEqual(cellsAt(12, [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3]]));
    });

    it('gives the same cells whichever corner the drag starts from', () => {
        const expected = cellsAt(12, [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3]]);
        expect(rectCells(at(12, 2, 3), at(12, 1, 1), 12)).toEqual(expected);
        expect(rectCells(at(12, 1, 3), at(12, 2, 1), 12)).toEqual(expected);
        expect(rectCells(at(12, 2, 1), at(12, 1, 3), 12)).toEqual(expected);
    });

    it('is a single cell when both corners are the same cell', () => {
        expect(rectCells(at(12, 4, 7), at(12, 4, 7), 12)).toEqual([at(12, 4, 7)]);
    });

    it('covers the whole board for opposite corners', () => {
        expect(rectCells(0, 143, 12)).toHaveLength(144);
    });
});

describe('frameCells', () => {
    it('is the outline only: 4 x 3 gives 12 − 2 inner cells = 10', () => {
        const cells = frameCells(at(12, 0, 0), at(12, 2, 3), 12);
        expect(cells).toHaveLength(10);
        expect(cells).not.toContain(at(12, 1, 1));
        expect(cells).not.toContain(at(12, 1, 2));
        expect(cells).toContain(at(12, 0, 0));
        expect(cells).toContain(at(12, 2, 3));
        expect(cells).toContain(at(12, 1, 0));
        expect(cells).toContain(at(12, 1, 3));
    });

    it('is the whole rectangle when it is one row, one column or 2 x 2', () => {
        expect(frameCells(at(12, 0, 0), at(12, 0, 3), 12)).toEqual(cellsAt(12, [[0, 0], [0, 1], [0, 2], [0, 3]]));
        expect(frameCells(at(12, 0, 0), at(12, 3, 0), 12)).toEqual(cellsAt(12, [[0, 0], [1, 0], [2, 0], [3, 0]]));
        expect(frameCells(at(12, 0, 0), at(12, 1, 1), 12)).toEqual(cellsAt(12, [[0, 0], [0, 1], [1, 0], [1, 1]]));
    });

    it('is one cell when both corners are the same cell', () => {
        expect(frameCells(at(12, 6, 6), at(12, 6, 6), 12)).toEqual([at(12, 6, 6)]);
    });

    it('is 25 − 9 inner = 16 cells for a 5 x 5 frame (3,3)→(7,7)', () => {
        expect(frameCells(at(12, 3, 3), at(12, 7, 7), 12)).toHaveLength(16);
    });
});

describe('shapeCells', () => {
    it('gives the pen line for the line tool, ascending without repeats', () => {
        // (0,0)→(1,3) walks (0,0),(0,1),(1,2),(1,3).
        expect(shapeCells('line', at(12, 0, 0), at(12, 1, 3), 12)).toEqual(cellsAt(12, [[0, 0], [0, 1], [1, 2], [1, 3]]));
        // Reverse: the same cells, in ascending order rather than walking order.
        expect(shapeCells('line', at(12, 1, 3), at(12, 0, 0), 12)).toEqual(cellsAt(12, [[0, 0], [0, 1], [1, 2], [1, 3]]));
    });

    it('is one cell for a line with equal ends', () => {
        expect(shapeCells('line', 30, 30, 12)).toEqual([30]);
    });

    it('delegates rect and frame to their own functions', () => {
        expect(shapeCells('rect', at(12, 1, 1), at(12, 2, 3), 12)).toEqual(rectCells(at(12, 1, 1), at(12, 2, 3), 12));
        expect(shapeCells('frame', at(12, 0, 0), at(12, 2, 3), 12)).toEqual(frameCells(at(12, 0, 0), at(12, 2, 3), 12));
    });
});

describe('fillRegion', () => {
    // 5 wide x 3 high, a wall of mines in column 2.
    const wall = minesOf(5, 3, [[0, 2], [1, 2], [2, 2]]);

    it('covers the empty cells joined to the clicked one, stopped by the wall', () => {
        expect(fillRegion(wall, at(5, 0, 0), 5, 3)).toEqual(cellsAt(5, [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]));
        expect(fillRegion(wall, at(5, 2, 4), 5, 3)).toEqual(cellsAt(5, [[0, 3], [0, 4], [1, 3], [1, 4], [2, 3], [2, 4]]));
    });

    it('covers the mines joined to a clicked mine', () => {
        expect(fillRegion(wall, at(5, 1, 2), 5, 3)).toEqual(cellsAt(5, [[0, 2], [1, 2], [2, 2]]));
    });

    it('does not join cells that only touch at a corner', () => {
        const diagonal = minesOf(5, 3, [[0, 0], [1, 1]]);
        expect(fillRegion(diagonal, at(5, 0, 0), 5, 3)).toEqual([0]);
        expect(fillRegion(diagonal, at(5, 1, 1), 5, 3)).toEqual([at(5, 1, 1)]);
    });

    it('covers the whole board when there is no mine', () => {
        expect(fillRegion(minesOf(12, 12, []), at(12, 5, 5), 12, 12)).toHaveLength(144);
    });

    it('does not wrap from the end of a row to the start of the next', () => {
        // A full mine column at x = 1 on a 3 x 2 board: (0,2) and (1,0) are neighbours in index order only.
        const mines = minesOf(3, 2, [[0, 1], [1, 1]]);
        expect(fillRegion(mines, at(3, 0, 2), 3, 2)).toEqual(cellsAt(3, [[0, 2], [1, 2]]));
        expect(fillRegion(mines, at(3, 1, 0), 3, 2)).toEqual(cellsAt(3, [[0, 0], [1, 0]]));
    });

    it('does not change its input', () => {
        const before = [...wall];
        fillRegion(wall, 0, 5, 3);
        expect(wall).toEqual(before);
    });
});

describe('previewCells', () => {
    const always = (): boolean => true;

    it('marks, in place mode, only empty cells where a mine may stand', () => {
        const mines = minesOf(5, 1, [[0, 1]]);
        const placeable = (i: number): boolean => i !== 3;
        expect(previewCells('place', mines, [0, 1, 2, 3, 4], placeable)).toEqual([0, 2, 4]);
    });

    it('marks, in erase mode, only cells with a mine', () => {
        const mines = minesOf(5, 1, [[0, 1], [0, 3]]);
        expect(previewCells('erase', mines, [0, 1, 2, 3, 4], always)).toEqual([1, 3]);
        expect(previewCells('erase', minesOf(5, 1, []), [0, 1, 2, 3, 4], always)).toEqual([]);
    });

    it('marks 25 − 9 = 16 cells for the 5 x 5 rectangle (3,3)→(7,7) around the start cell (5,5)', () => {
        const mines = minesOf(12, 12, []);
        const cells = rectCells(at(12, 3, 3), at(12, 7, 7), 12);
        expect(previewCells('place', mines, cells, placeableFor(12, 12, [5, 5]))).toHaveLength(16);
        expect(previewCells('erase', mines, cells, placeableFor(12, 12, [5, 5]))).toEqual([]);
    });
});

describe('applyShape', () => {
    const W = 12;

    it('places 16 and skips the 9 start-zone cells for the rectangle (3,3)→(7,7) with start (5,5)', () => {
        const cells = rectCells(at(W, 3, 3), at(W, 7, 7), W);
        const result = applyShape('place', minesOf(W, W, []), cells, placeableFor(W, W, [5, 5]));
        expect(result.stroke.changed).toBe(16);
        expect(result.stroke.skipped).toBe(9);
        expect(strokeStatusText(strokeStatus(result.stroke))).toBe('16 マスに爆弾を置きました。（9 マスは開始マス制約で置けませんでした）');
        expect(result.mines.filter(Boolean)).toHaveLength(16);
        expect(result.mines[at(W, 5, 5)]).toBe(false);
    });

    it('places all 16 cells of the frame (3,3)→(7,7), none of which is in the start zone', () => {
        const cells = frameCells(at(W, 3, 3), at(W, 7, 7), W);
        const result = applyShape('place', minesOf(W, W, []), cells, placeableFor(W, W, [5, 5]));
        expect(result.stroke.changed).toBe(16);
        expect(result.stroke.skipped).toBe(0);
        expect(strokeStatusText(strokeStatus(result.stroke))).toBe('16 マスに爆弾を置きました。');
    });

    it('fills a whole empty board from (0,0): 135 placed, 9 skipped', () => {
        const mines = minesOf(W, W, []);
        const cells = fillRegion(mines, 0, W, W);
        const result = applyShape(paintModeAt(mines, 0), mines, cells, placeableFor(W, W, [5, 5]));
        expect(result.stroke.changed).toBe(135);
        expect(result.stroke.skipped).toBe(9);
        expect(strokeStatusText(strokeStatus(result.stroke))).toBe('135 マスに爆弾を置きました。（9 マスは開始マス制約で置けませんでした）');
    });

    it('erases only the mines of the rectangle when it starts on a mine', () => {
        const mines = minesOf(W, W, [[1, 1], [1, 3]]);
        const cells = rectCells(at(W, 1, 1), at(W, 2, 3), W);
        const mode = paintModeAt(mines, at(W, 1, 1));
        expect(mode).toBe('erase');
        const result = applyShape(mode, mines, cells, placeableFor(W, W, null));
        expect(result.stroke.changed).toBe(2);
        expect(result.stroke.skipped).toBe(0);
        expect(strokeStatusText(strokeStatus(result.stroke))).toBe('2 マスの爆弾を消しました。');
        expect(result.mines.some(Boolean)).toBe(false);
    });

    it('places every cell of the shape when there is no start cell', () => {
        const cells = rectCells(at(W, 3, 3), at(W, 7, 7), W);
        const result = applyShape('place', minesOf(W, W, []), cells, placeableFor(W, W, null));
        expect(result.stroke.changed).toBe(25);
        expect(result.stroke.skipped).toBe(0);
    });

    it('does not count a cell that already has a mine when placing', () => {
        const mines = minesOf(W, W, [[0, 1]]);
        const result = applyShape('place', mines, cellsAt(W, [[0, 0], [0, 1], [0, 2]]), placeableFor(W, W, null));
        expect(result.stroke.changed).toBe(2);
        expect(strokeStatusText(strokeStatus(result.stroke))).toBe('2 マスに爆弾を置きました。');
    });

    it('says only the skipped count when every cell of the shape is in the start zone', () => {
        const cells = rectCells(at(W, 4, 4), at(W, 5, 5), W);
        const result = applyShape('place', minesOf(W, W, []), cells, placeableFor(W, W, [5, 5]));
        expect(result.stroke.changed).toBe(0);
        expect(strokeStatusText(strokeStatus(result.stroke))).toBe('4 マスは開始マス制約で置けませんでした。');
    });

    it('acts like a plain click for one cell: nothing to say on success, the old refusal in the start zone', () => {
        const ok = applyShape('place', minesOf(W, W, []), [at(W, 0, 0)], placeableFor(W, W, [5, 5]));
        expect(ok.mines[0]).toBe(true);
        expect(strokeStatusText(strokeStatus(ok.stroke))).toBeNull();
        const refused = applyShape('place', minesOf(W, W, []), [at(W, 5, 6)], placeableFor(W, W, [5, 5]));
        expect(refused.mines.some(Boolean)).toBe(false);
        expect(strokeStatusText(strokeStatus(refused.stroke))).toBe('開始マス制約: このセルには爆弾を置けません。');
    });

    it('counts a repeated cell once', () => {
        const result = applyShape('place', minesOf(W, W, []), [3, 4, 3, 4], placeableFor(W, W, null));
        expect(result.stroke.changed).toBe(2);
    });

    it('does not change its input and returns new arrays', () => {
        const mines = minesOf(W, W, [[0, 0]]);
        const copy = [...mines];
        const result = applyShape('place', mines, [1, 2], placeableFor(W, W, null));
        expect(mines).toEqual(copy);
        expect(result.mines).not.toBe(mines);
    });

    it('is one history move that one undo takes back, and no move when nothing changes', () => {
        const mines = minesOf(W, W, []);
        const before = { width: W, height: W, mines, startIndex: null };
        const cells = rectCells(at(W, 1, 1), at(W, 2, 3), W);
        const result = applyShape('place', mines, cells, placeableFor(W, W, null));
        const after = { ...before, mines: result.mines };
        const history = recordMove(emptyHistory(), before, after);
        expect(history.past).toHaveLength(1);
        expect(undo(history, after)?.snapshot.mines).toEqual(mines);
        // Placing on cells that all have mines changes nothing: no move.
        const again = applyShape('place', result.mines, cells, placeableFor(W, W, null));
        expect(again.mines).toEqual(result.mines);
        expect(recordMove(history, after, { ...after, mines: again.mines }).past).toHaveLength(1);
    });
});
