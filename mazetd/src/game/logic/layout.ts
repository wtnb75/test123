import { BOARD_LEFT, BOARD_TOP, CANVAS_H, CELL, GRID_COLS, GRID_ROWS } from './config';
import type { CellPos } from './board';

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export type Tool = 'wall' | 'turret' | 'sell';
export type ButtonId = Tool | 'start';

export const BOARD_RECT: Rect = { x: BOARD_LEFT, y: BOARD_TOP, w: GRID_COLS * CELL, h: GRID_ROWS * CELL };

const PANEL_TOP = BOARD_TOP + GRID_ROWS * CELL;
const PANEL_PAD = 16;
const BUTTON_GAP = 12;
const BUTTON_H = (CANVAS_H - PANEL_TOP - PANEL_PAD * 2 - BUTTON_GAP) / 2;
const TOOL_W = (BOARD_RECT.w - BUTTON_GAP * 2) / 3;
const TOOL_Y = PANEL_TOP + PANEL_PAD;
const START_Y = TOOL_Y + BUTTON_H + BUTTON_GAP;

export const BUTTONS: Readonly<Record<ButtonId, Rect>> = {
    wall: { x: BOARD_LEFT, y: TOOL_Y, w: TOOL_W, h: BUTTON_H },
    turret: { x: BOARD_LEFT + TOOL_W + BUTTON_GAP, y: TOOL_Y, w: TOOL_W, h: BUTTON_H },
    sell: { x: BOARD_LEFT + (TOOL_W + BUTTON_GAP) * 2, y: TOOL_Y, w: TOOL_W, h: BUTTON_H },
    start: { x: BOARD_LEFT, y: START_Y, w: BOARD_RECT.w, h: BUTTON_H }
};

const BUTTON_ORDER: readonly ButtonId[] = ['wall', 'turret', 'sell', 'start'];

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
