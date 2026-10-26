import { describe, expect, it } from 'vitest';
import { PARAMS } from '../params';
import { widenGrid } from './grid';
import { cellAt, cellSizeOf } from './layout';
import { canUndo, createState, move, undo } from './rules';
import { board, depsOf } from './testkit';
import { EMPTY, MOVABLE } from './types';

// One push down completes the row (the same fixture as rules.test.ts "line clears").
const ROW_CLEAR = ['.....', '.....', '.....', '....@', '....o', 'oooo.'];

describe('盤面の広がり: when the board grows (docs/spec.md)', () => {
    it('ライン 9 本のあとに一列を消しても広がらない（5 列のまま）', () => {
        const s = board(ROW_CLEAR, { score: 8 });
        move(s, 'down', depsOf(7));
        expect(s.score).toBe(9);
        expect(s.grid[0].length).toBe(PARAMS.cols);
    });

    it('ライン 10 本目の消去で、盤面が 6 列になる（行はすべて 6 マス）', () => {
        const s = board(ROW_CLEAR, { score: 9 });
        move(s, 'down', depsOf(7));
        expect(s.score).toBe(10);
        expect(s.grid[0].length).toBe(PARAMS.grownCols);
        s.grid.forEach((row) => expect(row.length).toBe(PARAMS.grownCols));
    });

    it('広がるのは一度だけ（6 列の盤面は 7 列にならない）', () => {
        const s = board(ROW_CLEAR, { score: 15 });
        move(s, 'down', depsOf(7));
        expect(s.grid[0].length).toBe(PARAMS.grownCols);
    });

    it('広がったあとも、キャラクターの位置と手数は消去の規則どおりに変わる（広がりで動かない）', () => {
        const s = board(ROW_CLEAR, { score: 9 });
        const before = { px: s.px, py: s.py };
        move(s, 'down', depsOf(7));
        expect(s.px).toBe(before.px);
        expect(s.py).toBe(before.py + 1);
    });
});

describe('盤面の広がり: the grown board', () => {
    it('5 列のマスは 80 px、6 列のマスは 66 px（盤面は 400 × 480 と 396 × 396）', () => {
        expect(cellSizeOf(5)).toBe(80);
        expect(cellSizeOf(6)).toBe(66);
        expect(5 * cellSizeOf(5)).toBe(400);
        expect(6 * cellSizeOf(6)).toBe(396);
    });

    it('6 列の盤面では、タップの列は 66 px ごとに区切られ、右端の外は盤面の外になる', () => {
        const layout = { boardX: 40, boardY: 110 } as Parameters<typeof cellAt>[0];
        expect(cellAt(layout, 40 + 66 * 5 + 1, 110 + 1, 6)).toEqual({ x: 5, y: 0 });
        expect(cellAt(layout, 40 + 66 * 6, 110 + 1, 6)).toBeNull();
    });

    it('5 列の盤面のタップは、従来どおり 80 px で区切る（広がる前は変えない）', () => {
        const layout = { boardX: 40, boardY: 110 } as Parameters<typeof cellAt>[0];
        expect(cellAt(layout, 40 + 80 * 4 + 1, 110 + 1, 5)).toEqual({ x: 4, y: 0 });
        expect(cellAt(layout, 40 + 80 * 5, 110 + 1, 5)).toBeNull();
    });

    it('広がった盤面の縦は 6 行のままで、6 行目（y = 5）の外は盤面の外', () => {
        const layout = { boardX: 40, boardY: 110 } as Parameters<typeof cellAt>[0];
        expect(cellAt(layout, 45, 110 + 66 * 5 + 1, 6)).toEqual({ x: 0, y: 5 });
        expect(cellAt(layout, 45, 110 + 66 * 6, 6)).toBeNull();
    });
});

describe('盤面の広がり: undo, restart and the Title demo', () => {
    it('広がった消去のあとは戻せない（履歴が空になる）。盤面は 6 列のまま', () => {
        const s = board(ROW_CLEAR, { score: 9 });
        move(s, 'down', depsOf(7));
        expect(canUndo(s)).toBe(false);
        expect(undo(s)).toBe(false);
        expect(s.grid[0].length).toBe(PARAMS.grownCols);
    });

    it('もう一度始めると（新しい盤面は）5 列・6 行で始まる', () => {
        const s = createState(depsOf(1));
        expect(s.grid[0].length).toBe(PARAMS.cols);
        expect(s.grid.length).toBe(PARAMS.rows);
    });

    it('Title のデモ（growLines が無限大）は、ライン 10 本でも広がらない', () => {
        const s = board(ROW_CLEAR, { score: 9 });
        move(s, 'down', { ...depsOf(7), growLines: Infinity });
        expect(s.score).toBe(10);
        expect(s.grid[0].length).toBe(PARAMS.cols);
    });
});

describe('widenGrid', () => {
    it('右側に空きの列を足し、行の配列は同じものを使い続ける（その場で広げる）', () => {
        const grid = [[MOVABLE, EMPTY], [EMPTY, EMPTY]];
        const firstRow = grid[0];
        widenGrid(grid, 4);
        expect(grid[0]).toBe(firstRow);
        expect(grid[0]).toEqual([MOVABLE, EMPTY, EMPTY, EMPTY]);
        expect(grid[1]).toEqual([EMPTY, EMPTY, EMPTY, EMPTY]);
    });

    it('すでに指定の列数ならそのまま（何もしない）', () => {
        const grid = [[MOVABLE, EMPTY, EMPTY]];
        widenGrid(grid, 3);
        expect(grid).toEqual([[MOVABLE, EMPTY, EMPTY]]);
    });
});
