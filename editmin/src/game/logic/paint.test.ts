import { describe, expect, it } from 'vitest';
import { canPlaceMine } from './board';
import { emptyHistory, recordMove, undo, type BoardSnapshot } from './history';
import { beginStroke, paintModeAt, strokeLine, strokeStatus, strokeStatusText, visitCell, type PaintMode, type Stroke } from './paint';

/** Cell index of (row, col) on a board `width` cells wide. */
const at = (width: number, y: number, x: number): number => y * width + x;

/** The cells of a line given and expected as [row, col] pairs. */
const line = (width: number, from: [number, number], to: [number, number]): [number, number][] =>
    strokeLine(at(width, ...from), at(width, ...to), width).map((i) => [Math.floor(i / width), i % width]);

type Run = { stroke: Stroke; mines: boolean[] };

/**
 * Plays a whole drag on a board: presses on the first cell, then passes the line to each next cell, the way the Scene does.
 * `start` is the start cell (its zone takes no mine); null means none.
 */
function drag(width: number, height: number, mines: [number, number][], start: [number, number] | null, path: [number, number][]): Run {
    const flags = Array.from({ length: width * height }, () => false);
    for (const [y, x] of mines) {
        flags[y * width + x] = true;
    }
    const startIndex = start === null ? null : at(width, ...start);
    const grid = { width, height, cells: flags.map((hasMine) => ({ hasMine })) };
    const first = at(width, ...path[0]);
    let run: Run = { stroke: beginStroke(paintModeAt(flags, first)), mines: flags };
    let last = first;
    const pass = (index: number) => {
        const result = visitCell(run.stroke, run.mines, index, canPlaceMine(grid, startIndex, index));
        run = { stroke: result.stroke, mines: result.mines };
    };
    pass(first);
    for (const [y, x] of path.slice(1)) {
        const index = at(width, y, x);
        for (const cell of strokeLine(last, index, width)) {
            pass(cell);
        }
        last = index;
    }
    return run;
}

const mineSet = (run: Run): number[] => run.mines.flatMap((m, i) => (m ? [i] : []));

describe('strokeLine', () => {
    it('walks a straight row cell by cell, both ends included', () => {
        expect(line(12, [0, 0], [0, 3])).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
    });

    it('walks a column downwards and upwards', () => {
        expect(line(12, [3, 1], [0, 1])).toEqual([[3, 1], [2, 1], [1, 1], [0, 1]]);
        expect(line(12, [0, 1], [3, 1])).toEqual([[0, 1], [1, 1], [2, 1], [3, 1]]);
    });

    it('walks a 45 degree diagonal through the corners', () => {
        expect(line(12, [0, 0], [2, 2])).toEqual([[0, 0], [1, 1], [2, 2]]);
        expect(line(12, [2, 2], [0, 0])).toEqual([[2, 2], [1, 1], [0, 0]]);
        expect(line(12, [0, 2], [2, 0])).toEqual([[0, 2], [1, 1], [2, 0]]);
    });

    it('steps along the long side and rounds the short side (0,0)->(1,3)', () => {
        expect(line(12, [0, 0], [1, 3])).toEqual([[0, 0], [0, 1], [1, 2], [1, 3]]);
    });

    it('is the reversed line when walked from the other end (0,0)<->(1,3)', () => {
        expect(line(12, [1, 3], [0, 0])).toEqual([[1, 3], [1, 2], [0, 1], [0, 0]]);
    });

    it('sends a half-way position to the cell farther from the start (0,0)->(1,2) goes through (1,1), the way back through (0,1)', () => {
        expect(line(12, [0, 0], [1, 2])).toEqual([[0, 0], [1, 1], [1, 2]]);
        expect(line(12, [1, 2], [0, 0])).toEqual([[1, 2], [0, 1], [0, 0]]);
    });

    it('returns only the start cell when start and end are the same', () => {
        expect(strokeLine(17, 17, 12)).toEqual([17]);
    });

    it('works on a board of width 2 (the narrowest) going down', () => {
        expect(line(2, [0, 0], [3, 1])).toEqual([[0, 0], [1, 0], [2, 1], [3, 1]]);
    });

    it('keeps every neighbour touching, ends included, with max(|dx|,|dy|)+1 cells, and reverses exactly', () => {
        const width = 9;
        const height = 7;
        for (let a = 0; a < width * height; a += 1) {
            for (let b = 0; b < width * height; b += 1) {
                const cells = strokeLine(a, b, width);
                const dy = Math.abs(Math.floor(a / width) - Math.floor(b / width));
                const dx = Math.abs((a % width) - (b % width));
                if (cells.length !== Math.max(dx, dy) + 1 || cells[0] !== a || cells[cells.length - 1] !== b) {
                    expect.fail(`wrong ends or length for ${a} -> ${b}`);
                }
                for (let i = 1; i < cells.length; i += 1) {
                    const step = Math.max(
                        Math.abs(Math.floor(cells[i] / width) - Math.floor(cells[i - 1] / width)),
                        Math.abs((cells[i] % width) - (cells[i - 1] % width))
                    );
                    if (step !== 1) {
                        expect.fail(`cells ${cells[i - 1]} and ${cells[i]} do not touch on ${a} -> ${b}`);
                    }
                }
                // Without a half-way position (|dy| is 0, equals |dx|, or |dx| = 0) the line is its own reverse.
                const straight = dy === 0 || dx === 0 || dx === dy;
                if (straight && strokeLine(b, a, width).reverse().join() !== cells.join()) {
                    expect.fail(`${a} -> ${b} is not the reverse of ${b} -> ${a}`);
                }
            }
        }
    });
});

describe('paintModeAt', () => {
    it('places when the pressed cell has no mine and erases when it has one', () => {
        const mines = [false, true, false];
        expect(paintModeAt(mines, 0)).toBe<PaintMode>('place');
        expect(paintModeAt(mines, 1)).toBe<PaintMode>('erase');
    });
});

describe('visitCell', () => {
    it('places a mine on an empty placeable cell and counts it as changed', () => {
        const result = visitCell(beginStroke('place'), [false, false], 1, true);
        expect(result.outcome).toBe('changed');
        expect(result.mines).toEqual([false, true]);
        expect(result.stroke.changed).toBe(1);
        expect(result.stroke.skipped).toBe(0);
    });

    it('skips an empty cell that may not hold a mine and counts it as skipped', () => {
        const result = visitCell(beginStroke('place'), [false, false], 1, false);
        expect(result.outcome).toBe('skipped');
        expect(result.mines).toEqual([false, false]);
        expect(result.stroke.skipped).toBe(1);
        expect(result.stroke.changed).toBe(0);
    });

    it('leaves a mine alone in place mode, counting nothing', () => {
        const result = visitCell(beginStroke('place'), [true], 0, true);
        expect(result.outcome).toBe('unchanged');
        expect(result.mines).toEqual([true]);
        expect(result.stroke.changed + result.stroke.skipped).toBe(0);
    });

    it('takes a mine off in erase mode', () => {
        const result = visitCell(beginStroke('erase'), [true, true], 0, true);
        expect(result.outcome).toBe('changed');
        expect(result.mines).toEqual([false, true]);
    });

    it('leaves an empty cell alone in erase mode, even when a mine may not stand there (not a skip)', () => {
        const result = visitCell(beginStroke('erase'), [false], 0, false);
        expect(result.outcome).toBe('unchanged');
        expect(result.stroke.skipped).toBe(0);
    });

    it('does nothing the second time a cell is passed, and counts it once', () => {
        const first = visitCell(beginStroke('place'), [false, false], 0, true);
        const second = visitCell(first.stroke, first.mines, 0, true);
        expect(second.outcome).toBe('unchanged');
        expect(second.mines).toEqual([true, false]);
        expect(second.stroke.changed).toBe(1);
        const refused = visitCell(beginStroke('place'), [false], 0, false);
        const again = visitCell(refused.stroke, refused.mines, 0, false);
        expect(again.stroke.skipped).toBe(1);
    });

    it('does not change the mines array or the stroke it was given', () => {
        const mines = [false, false];
        const stroke = beginStroke('place');
        const result = visitCell(stroke, mines, 0, true);
        expect(mines).toEqual([false, false]);
        expect(stroke.visited.size).toBe(0);
        expect(stroke.changed).toBe(0);
        expect(result.mines).not.toBe(mines);
        const again = visitCell(result.stroke, result.mines, 0, true);
        expect(again.mines).not.toBe(result.mines);
    });
});

describe('a whole stroke on a 12 x 12 board', () => {
    it('places 4 mines along a free row: N = 4, M = 0', () => {
        const run = drag(12, 12, [], null, [[0, 0], [0, 3]]);
        expect(mineSet(run)).toEqual([0, 1, 2, 3]);
        expect(run.stroke.changed).toBe(4);
        expect(run.stroke.skipped).toBe(0);
    });

    it('skips the 3 forbidden cells of the start zone (start (5,5)) and places the other 6: N = 6, M = 3', () => {
        const run = drag(12, 12, [], [5, 5], [[5, 0], [5, 8]]);
        expect(mineSet(run)).toEqual([60, 61, 62, 63, 67, 68]);
        expect(run.stroke.changed).toBe(6);
        expect(run.stroke.skipped).toBe(3);
    });

    it('counts a cell once when the pointer goes there and back: (0,0)->(0,3)->(0,0) gives N = 4', () => {
        const run = drag(12, 12, [], null, [[0, 0], [0, 3], [0, 0]]);
        expect(run.stroke.changed).toBe(4);
        expect(run.stroke.visited.size).toBe(4);
    });

    it('erases only the mines on the line, not counting the empty cells: mines (0,0),(0,2) -> N = 2, M = 0', () => {
        const run = drag(12, 12, [[0, 0], [0, 2]], null, [[0, 0], [0, 3]]);
        expect(run.stroke.mode).toBe('erase');
        expect(mineSet(run)).toEqual([]);
        expect(run.stroke.changed).toBe(2);
        expect(run.stroke.skipped).toBe(0);
    });

    it('keeps a mine that is on the way in place mode: pressing (0,1) and going to (0,3) over a mine at (0,2) gives N = 2', () => {
        const run = drag(12, 12, [[0, 2]], null, [[0, 1], [0, 3]]);
        expect(run.stroke.mode).toBe('place');
        expect(mineSet(run)).toEqual([1, 2, 3]);
        expect(run.stroke.changed).toBe(2);
    });

    it('places every cell when no start cell is set (nothing is skipped)', () => {
        const run = drag(12, 12, [], null, [[5, 4], [5, 6]]);
        expect(run.stroke.changed).toBe(3);
        expect(run.stroke.skipped).toBe(0);
    });

    it('is not closed by the start zone: a refused first cell still lets later free cells be placed', () => {
        const run = drag(12, 12, [], [5, 5], [[5, 4], [5, 9]]);
        expect(run.stroke.mode).toBe('place');
        expect(mineSet(run)).toEqual([67, 68, 69]);
        expect(run.stroke.skipped).toBe(3);
        expect(run.stroke.changed).toBe(3);
    });

    it('never puts a mine inside the start zone, wherever the stroke goes', () => {
        const run = drag(12, 12, [], [5, 5], [[4, 3], [6, 7], [3, 5], [7, 5], [4, 4]]);
        for (const index of mineSet(run)) {
            const y = Math.floor(index / 12);
            const x = index % 12;
            expect(Math.abs(y - 5) <= 1 && Math.abs(x - 5) <= 1).toBe(false);
        }
    });
});

describe('strokeStatus', () => {
    it('shows nothing new for a one-cell stroke that succeeded (same as a plain click)', () => {
        const run = drag(12, 12, [], null, [[0, 0]]);
        expect(strokeStatus(run.stroke)).toEqual({ kind: 'none' });
    });

    it('shows nothing new for a one-cell erase', () => {
        const run = drag(12, 12, [[0, 0]], null, [[0, 0]]);
        expect(strokeStatus(run.stroke)).toEqual({ kind: 'none' });
    });

    it('reports the old refusal for a one-cell stroke on a forbidden cell', () => {
        const run = drag(12, 12, [], [5, 5], [[5, 5]]);
        expect(strokeStatus(run.stroke)).toEqual({ kind: 'single-refused' });
    });

    it('treats a press that leaves the cell and comes back as one cell', () => {
        const run = drag(12, 12, [], [5, 5], [[5, 5], [5, 5]]);
        expect(strokeStatus(run.stroke).kind).toBe('single-refused');
    });

    it('gives the counts for two or more cells: 6 placed, 3 skipped', () => {
        const run = drag(12, 12, [], [5, 5], [[5, 0], [5, 8]]);
        expect(strokeStatus(run.stroke)).toEqual({ kind: 'summary', mode: 'place', changed: 6, skipped: 3 });
    });

    it('gives the erase counts for two or more cells', () => {
        const run = drag(12, 12, [[0, 0], [0, 2]], null, [[0, 0], [0, 3]]);
        expect(strokeStatus(run.stroke)).toEqual({ kind: 'summary', mode: 'erase', changed: 2, skipped: 0 });
    });

    it('gives N = 0 and M >= 1 when only forbidden cells were passed', () => {
        const run = drag(12, 12, [], [5, 5], [[5, 4], [5, 6]]);
        expect(strokeStatus(run.stroke)).toEqual({ kind: 'summary', mode: 'place', changed: 0, skipped: 3 });
    });

    it('never gives N = 0 and M = 0 for two or more cells (the pressed cell is changed or skipped itself)', () => {
        const cases: { mines: [number, number][]; start: [number, number] | null }[] = [
            { mines: [], start: null },
            { mines: [[0, 0]], start: null },
            { mines: [], start: [0, 1] }
        ];
        for (const { mines, start } of cases) {
            for (let x = 0; x < 3; x += 1) {
                const status = strokeStatus(drag(12, 12, mines, start, [[0, x], [0, x + 1]]).stroke);
                if (status.kind !== 'summary' || status.changed + status.skipped === 0) {
                    expect.fail(`empty summary for press at column ${x}`);
                }
            }
        }
    });
});

describe('strokeStatusText', () => {
    it('gives the spec wording for 6 placed and 3 skipped', () => {
        expect(strokeStatusText({ kind: 'summary', mode: 'place', changed: 6, skipped: 3 })).toBe(
            '6 マスに爆弾を置きました。（3 マスは開始マス制約で置けませんでした）'
        );
    });

    it('gives the erase wording without a skipped part', () => {
        expect(strokeStatusText({ kind: 'summary', mode: 'erase', changed: 2, skipped: 0 })).toBe('2 マスの爆弾を消しました。');
    });

    it('gives only the skipped sentence when nothing changed', () => {
        expect(strokeStatusText({ kind: 'summary', mode: 'place', changed: 0, skipped: 3 })).toBe(
            '3 マスは開始マス制約で置けませんでした。'
        );
    });

    it('gives the old refusal wording for a single refused cell and nothing for a plain success', () => {
        expect(strokeStatusText({ kind: 'single-refused' })).toBe('開始マス制約: このセルには爆弾を置けません。');
        expect(strokeStatusText({ kind: 'none' })).toBeNull();
    });
});

describe('a stroke as one history move', () => {
    const snapshot = (mines: boolean[]): BoardSnapshot => ({ width: 12, height: 12, mines, startIndex: null });

    it('is undone in one step: every cell the stroke changed goes back', () => {
        const before = snapshot(Array.from({ length: 144 }, () => false));
        const run = drag(12, 12, [], null, [[0, 0], [0, 3], [3, 3]]);
        const after = snapshot(run.mines);
        const history = recordMove(emptyHistory(), before, after);
        expect(history.past).toHaveLength(1);
        const step = undo(history, after);
        expect(step?.snapshot.mines.some((m) => m)).toBe(false);
        expect(run.stroke.changed).toBe(7);
    });

    it('is not a move when nothing changed (all cells skipped)', () => {
        const flags = Array.from({ length: 144 }, () => false);
        const run = drag(12, 12, [], [5, 5], [[5, 4], [5, 6]]);
        const history = recordMove(emptyHistory(), snapshot(flags), snapshot(run.mines));
        expect(history.past).toHaveLength(0);
    });
});
