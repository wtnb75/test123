import { BOARD_LEFT, BOARD_TOP, CANVAS_W, CELL, GRID_COLS, GRID_ROWS, START_H, TOOL_GAP, TOOL_H, TOOL_W } from './config';
import type { CellPos } from './board';

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export type Tool = 'wall' | 'turret' | 'slow' | 'splash' | 'sell';
export type ButtonId = Tool | 'start';

export const BOARD_RECT: Rect = { x: BOARD_LEFT, y: BOARD_TOP, w: GRID_COLS * CELL, h: GRID_ROWS * CELL };

const PANEL_TOP = BOARD_TOP + GRID_ROWS * CELL;
const PANEL_PAD = 16;
const START_GAP = 8;
const TOOL_Y = PANEL_TOP + PANEL_PAD;
const START_Y = TOOL_Y + TOOL_H + START_GAP;
// Five tools with 2 px of margin on each side: 5 × 104 + 4 × 4 + 2 × 2 = 540.
const TOOLS_LEFT = (CANVAS_W - (TOOL_W * 5 + TOOL_GAP * 4)) / 2;

function toolRect(index: number): Rect {
    return { x: TOOLS_LEFT + index * (TOOL_W + TOOL_GAP), y: TOOL_Y, w: TOOL_W, h: TOOL_H };
}

export const BUTTONS: Readonly<Record<ButtonId, Rect>> = {
    wall: toolRect(0),
    turret: toolRect(1),
    slow: toolRect(2),
    splash: toolRect(3),
    sell: toolRect(4),
    start: { x: BOARD_LEFT, y: START_Y, w: BOARD_RECT.w, h: START_H }
};

const BUTTON_ORDER: readonly ButtonId[] = ['wall', 'turret', 'slow', 'splash', 'sell', 'start'];

export function contains(rect: Rect, x: number, y: number): boolean {
    return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

/** Board cell under a screen point, or null outside the board. */
export function pointToCell(x: number, y: number): CellPos | null {
    if (!contains(BOARD_RECT, x, y)) return null;
    return {
        col: Math.floor((x - BOARD_RECT.x) / CELL),
        row: Math.floor((y - BOARD_RECT.y) / CELL)
    };
}

export function cellCenterX(col: number): number {
    return BOARD_RECT.x + col * CELL + CELL / 2;
}

export function cellCenterY(row: number): number {
    return BOARD_RECT.y + row * CELL + CELL / 2;
}

export function buttonAt(x: number, y: number): ButtonId | null {
    for (const id of BUTTON_ORDER) {
        if (contains(BUTTONS[id], x, y)) return id;
    }
    return null;
}
