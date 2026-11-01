// Game-screen geometry for a logical height H (docs/spec.md "Game" layout).
import {
    FIELD_TOP,
    FLOOR_FROM_BOTTOM,
    HINT_GAP,
    LETTER_SIZE,
    SCREEN_WIDTH,
    TRAY_BOTTOM_MARGIN,
    TRAY_COLS,
    TRAY_GAP,
    TRAY_ROWS,
    TRAY_SLOT_H,
} from '../params';

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface FieldGeometry {
    floorY: number;
    fieldHeight: number;
    /** Centre y a letter appears at (its top edge is at FIELD_TOP). */
    spawnY: number;
    /** Centre y at which a letter's bottom edge reaches the floor and it disappears. */
    removeY: number;
    trayHeight: number;
    trayTop: number;
    hintY: number;
}

export function fieldGeometry(height: number): FieldGeometry {
    const floorY = height - FLOOR_FROM_BOTTOM;
    const trayHeight = TRAY_SLOT_H * TRAY_ROWS + TRAY_GAP * (TRAY_ROWS - 1);
    const trayTop = height - TRAY_BOTTOM_MARGIN - trayHeight;
    return {
        floorY,
        fieldHeight: floorY - FIELD_TOP,
        spawnY: FIELD_TOP + LETTER_SIZE / 2,
        removeY: floorY - LETTER_SIZE / 2,
        trayHeight,
        trayTop,
        hintY: trayTop - HINT_GAP,
    };
}

/** Centre x of a fall column. */
export const columnX = (col: number, columns: number): number => ((col + 0.5) * SCREEN_WIDTH) / columns;

/** The visible rectangle of tray slot `index` (row-major from the top-left). */
export function traySlotRect(index: number, height: number): Rect {
    const row = Math.floor(index / TRAY_COLS);
    const col = index % TRAY_COLS;
    const slotW = SCREEN_WIDTH / TRAY_COLS;
    const { trayTop } = fieldGeometry(height);
    return {
        x: col * slotW + TRAY_GAP / 2,
        y: trayTop + row * (TRAY_SLOT_H + TRAY_GAP),
        w: slotW - TRAY_GAP,
        h: TRAY_SLOT_H,
    };
}

/**
 * The tray slot a point belongs to, or -1 outside the tray. The gaps between slots belong to the nearer
 * slot (docs/spec.md "操作仕様"), so a slot's tap area is its rectangle plus half the gap on every side.
 */
export function traySlotAt(x: number, y: number, height: number): number {
    const { trayTop, trayHeight } = fieldGeometry(height);
    if (x < 0 || x >= SCREEN_WIDTH) return -1;
    if (y < trayTop || y >= trayTop + trayHeight) return -1;
    const col = Math.floor(x / (SCREEN_WIDTH / TRAY_COLS));
    // Slot rows start every TRAY_SLOT_H + TRAY_GAP; the boundary between two rows is the middle of their gap.
    const row = Math.min(TRAY_ROWS - 1, Math.floor((y - trayTop + TRAY_GAP / 2) / (TRAY_SLOT_H + TRAY_GAP)));
    return row * TRAY_COLS + col;
}
