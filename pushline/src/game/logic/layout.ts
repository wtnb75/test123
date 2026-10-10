// Portrait / landscape layouts (docs/spec.md "画面の向き"). All coordinates are canvas (logical) pixels.
import { PARAMS } from '../params';
import type { Dir, Pt } from './types';

export type Orientation = 'portrait' | 'landscape';

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Layout {
    orientation: Orientation;
    viewW: number;
    viewH: number;
    /** Top-left of the board. */
    boardX: number;
    boardY: number;
    /** HUD anchors: text origin (0 = left aligned at x, 1 = right aligned at x, 0.5 = centred). */
    hudMoves: { x: number; y: number; originX: number };
    hudLines: { x: number; y: number; originX: number };
    undoButton: Rect;
    quitButton: Rect;
    titleName: Pt;
    titleButton: Rect;
    resultLines: Pt;
    resultRetry: Rect;
    resultToTitle: Rect;
}

/** Every button is at least this big (docs/spec.md: height 80 px or more, width 200 px or more). */
export const BUTTON_W = 200;
export const BUTTON_H = 80;

const button = (cx: number, cy: number): Rect => ({
    x: cx - BUTTON_W / 2,
    y: cy - BUTTON_H / 2,
    w: BUTTON_W,
    h: BUTTON_H,
});

export const PORTRAIT: Layout = {
    orientation: 'portrait',
    viewW: 480,
    viewH: 800,
    boardX: 40,
    boardY: 110,
    hudMoves: { x: 40, y: 40, originX: 0 },
    hudLines: { x: 440, y: 40, originX: 1 },
    undoButton: button(130, 700),
    quitButton: button(350, 700),
    titleName: { x: 240, y: 280 },
    titleButton: button(240, 480),
    resultLines: { x: 240, y: 260 },
    resultRetry: button(240, 480),
    resultToTitle: button(240, 600),
};

export const LANDSCAPE: Layout = {
    orientation: 'landscape',
    viewW: 960,
    viewH: 600,
    boardX: 280,
    boardY: 60,
    hudMoves: { x: 140, y: 200, originX: 0.5 },
    hudLines: { x: 140, y: 280, originX: 0.5 },
    undoButton: button(820, 220),
    quitButton: button(820, 340),
    titleName: { x: 480, y: 190 },
    titleButton: button(480, 380),
    resultLines: { x: 480, y: 150 },
    resultRetry: button(480, 330),
    resultToTitle: button(480, 440),
};

/** Portrait when the window is taller than wide; landscape otherwise (including a square window). */
export const orientationOf = (width: number, height: number): Orientation =>
    height > width ? 'portrait' : 'landscape';

export const layoutFor = (orientation: Orientation): Layout => (orientation === 'portrait' ? PORTRAIT : LANDSCAPE);

export const pickLayout = (width: number, height: number): Layout => layoutFor(orientationOf(width, height));

export const inRect = (r: Rect, x: number, y: number): boolean =>
    x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** The board cell under a canvas point, or null outside the board. */
export function cellAt(layout: Layout, x: number, y: number): Pt | null {
    const cx = Math.floor((x - layout.boardX) / PARAMS.cellSize);
    const cy = Math.floor((y - layout.boardY) / PARAMS.cellSize);
    if (cx < 0 || cy < 0 || cx >= PARAMS.cols || cy >= PARAMS.rows) return null;
    return { x: cx, y: cy };
}

/** Which in-game button (if any) a canvas point is on. */
export function buttonAt(layout: Layout, x: number, y: number): 'undo' | 'quit' | null {
    if (inRect(layout.undoButton, x, y)) return 'undo';
    if (inRect(layout.quitButton, x, y)) return 'quit';
    return null;
}

export type Gesture = { kind: 'tap' } | { kind: 'swipe'; dir: Dir };

/**
 * A press-and-release as tap or swipe. A move of at least `minPx` on either axis is a swipe along
 * the axis with the larger movement (a tie goes to the vertical axis).
 */
export function classifyGesture(dx: number, dy: number, minPx: number = PARAMS.swipeMinPx): Gesture {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax < minPx && ay < minPx) return { kind: 'tap' };
    if (ay >= ax) return { kind: 'swipe', dir: dy > 0 ? 'down' : 'up' };
    return { kind: 'swipe', dir: dx > 0 ? 'right' : 'left' };
}
