import type { DigitStatus } from '../types';

/** The fill of a guessed cell for each hint colour (shared by the Game board and the Title demo). */
export const COLORS: Record<DigitStatus, number> = {
    green: 0x16a34a,
    yellow: 0xf59e0b,
    gray: 0x6b7280
};

/** An empty (or still unjudged) cell. */
export const CELL_FILL = 0x1f2937;
export const CELL_STROKE = 0x4b5563;
export const CELL_STROKE_WIDTH = 2;
export const CELL_LABEL_COLOR = '#ffffff';
export const CELL_FONT_FAMILY = 'monospace';

/** The digit size inside a cell of `cell` px: half of the cell, at least 20 px. */
export const cellLabelSize = (cell: number): number => Math.max(20, Math.floor(cell * 0.5));
