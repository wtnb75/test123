// Pure rules of the shape tools (docs/spec/shape-tools.md): which cells a line, rectangle, frame or flood fill covers,
// which of them a drag would change (the preview), and the one-shot application that reuses the pen's per-cell rules
// (paint.ts). No DOM, no Phaser; arguments are never mutated. Cells are row-major indices.

import { beginStroke, strokeLine, visitCell, type PaintMode, type Stroke } from './paint';

/** The editing tools of the sidebar, in the order of its buttons. */
export type Tool = 'pen' | 'line' | 'rect' | 'frame' | 'fill';

export const TOOL_DEFAULT: Tool = 'pen';

export const TOOLS: readonly { tool: Tool; label: string }[] = [
    { tool: 'pen', label: 'ペン' },
    { tool: 'line', label: '線' },
    { tool: 'rect', label: '矩形' },
    { tool: 'frame', label: '枠' },
    { tool: 'fill', label: '塗りつぶし' }
];

/** The tools whose range is set by a mouse drag (the pen paints along the drag; the fill works on a click). */
export type ShapeTool = 'line' | 'rect' | 'frame';

export const isShapeTool = (tool: Tool): tool is ShapeTool => tool === 'line' || tool === 'rect' || tool === 'frame';

type Box = { top: number; bottom: number; left: number; right: number };

/** The rectangle with the two cells as opposite corners. */
function boxOf(from: number, to: number, width: number): Box {
    const y0 = Math.floor(from / width);
    const x0 = from % width;
    const y1 = Math.floor(to / width);
    const x1 = to % width;
    return { top: Math.min(y0, y1), bottom: Math.max(y0, y1), left: Math.min(x0, x1), right: Math.max(x0, x1) };
}

/** Every cell of the rectangle between the two cells, row by row. */
export function rectCells(from: number, to: number, width: number): number[] {
    const box = boxOf(from, to, width);
    const cells: number[] = [];
    for (let y = box.top; y <= box.bottom; y += 1) {
        for (let x = box.left; x <= box.right; x += 1) {
            cells.push(y * width + x);
        }
    }
    return cells;
}

/** The outline of that rectangle (a rectangle one cell wide or high is all outline). */
export function frameCells(from: number, to: number, width: number): number[] {
    const box = boxOf(from, to, width);
    const cells: number[] = [];
    for (let y = box.top; y <= box.bottom; y += 1) {
        for (let x = box.left; x <= box.right; x += 1) {
            if (y === box.top || y === box.bottom || x === box.left || x === box.right) {
                cells.push(y * width + x);
            }
        }
    }
    return cells;
}

/** The cells a drag from `from` to `to` covers with the given shape tool. */
export function shapeCells(tool: ShapeTool, from: number, to: number, width: number): number[] {
    if (tool === 'line') {
        return strokeLine(from, to, width).sort((a, b) => a - b);
    }
    return tool === 'rect' ? rectCells(from, to, width) : frameCells(from, to, width);
}

/**
 * The cells joined to `index` by sides (not corners) that are in the same state (mine / no mine), `index` included,
 * in ascending order. Computed on the board as it is; nothing is changed.
 */
export function fillRegion(mines: readonly boolean[], index: number, width: number, height: number): number[] {
    const state = mines[index];
    const seen = new Set<number>([index]);
    const stack = [index];
    while (stack.length > 0) {
        const at = stack.pop() as number;
        const y = Math.floor(at / width);
        const x = at % width;
        const next = [
            y > 0 ? at - width : -1,
            y < height - 1 ? at + width : -1,
            x > 0 ? at - 1 : -1,
            x < width - 1 ? at + 1 : -1
        ];
        for (const n of next) {
            if (n >= 0 && !seen.has(n) && mines[n] === state) {
                seen.add(n);
                stack.push(n);
            }
        }
    }
    return [...seen].sort((a, b) => a - b);
}

/**
 * The cells of `cells` that applying `mode` would change: place → empty cells where a mine may stand; erase → cells
 * with a mine. Cells that would stay as they are, and cells skipped by the start-cell rule, are left out.
 */
export function previewCells(mode: PaintMode, mines: readonly boolean[], cells: readonly number[], placeable: (index: number) => boolean): number[] {
    return cells.filter((i) => (mode === 'place' ? !mines[i] && placeable(i) : mines[i]));
}

export type ShapeApplication = { stroke: Stroke; mines: boolean[] };

/**
 * Applies `mode` to every cell of `cells` once, with the pen's per-cell rules, and returns the new mines and the
 * counts (as a `Stroke`, so `strokeStatus` gives the status line of it).
 */
export function applyShape(mode: PaintMode, mines: readonly boolean[], cells: readonly number[], placeable: (index: number) => boolean): ShapeApplication {
    let stroke = beginStroke(mode);
    let current = [...mines];
    for (const index of cells) {
        const result = visitCell(stroke, current, index, placeable(index));
        stroke = result.stroke;
        current = result.mines;
    }
    return { stroke, mines: current };
}
