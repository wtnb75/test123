// How big one cell of `Game` is and where the board sits (docs/spec/board-render.md "盤面の大きさと位置"). Pure: no Phaser.
import { cameraBounds } from './floorLayout';
import { roomParams } from './generator';
import { CONTROL_MARGIN, controlsLayout } from './mapOverlay';
import { REFERENCE_CELL } from './title';
import type { Position } from './types';

/** The smallest cell: the reference size (30 px). A room that does not fit at this size scrolls. */
export const CELL_MIN = REFERENCE_CELL;
/** The play area's margin on the left and the right, and its top (below the HUD; where the board starts). */
export const BOARD_AREA_SIDE = 20;
export const BOARD_AREA_TOP = 80;
/** The virtual pad's base radius (px), and the factor of the compact layout. */
export const PAD_BASE_RADIUS = 52;
export const PAD_COMPACT_SCALE = 0.78;

export const padBaseRadius = (compact: boolean): number =>
  compact ? Math.round(PAD_BASE_RADIUS * PAD_COMPACT_SCALE) : PAD_BASE_RADIUS;

/** Where the board may be: the screen without the HUD and the controls (docs/spec/board-render.md "遊べる領域"). */
export type BoardArea = {
  left: number;
  top: number;
  width: number;
  height: number;
  /** The top of the pad and the MAP button: the area ends here. */
  controlsTop: number;
  /** The compact layout (the same one `controlsLayout` uses). */
  compact: boolean;
  /** The cell that is comfortable to tap: FLAG's size (44 compact, 52 otherwise). */
  comfort: number;
};

export const boardArea = (width: number, height: number): BoardArea => {
  const controls = controlsLayout(width, height);
  const mapTop = controls.map.y - controls.map.size / 2;
  const padTop = height - CONTROL_MARGIN - 2 * padBaseRadius(controls.compact);
  const controlsTop = Math.min(mapTop, padTop);
  return {
    left: BOARD_AREA_SIDE,
    top: BOARD_AREA_TOP,
    width: Math.max(1, width - 2 * BOARD_AREA_SIDE),
    height: Math.max(1, controlsTop - BOARD_AREA_TOP),
    controlsTop,
    compact: controls.compact,
    comfort: controls.flag.size
  };
};

/**
 * The size of one cell (whole px) on floor `stageNo`: as large as is comfortable to tap (`area.comfort`), as large as
 * the biggest room of the stage (a deep room) fits the area, and never below `CELL_MIN`.
 */
export const boardCell = (stageNo: number, area: BoardArea): number => {
  const largest = roomParams(stageNo, true).width;
  const fit = Math.floor(Math.min(area.width, area.height) / largest);
  return Math.min(area.comfort, Math.max(CELL_MIN, fit));
};

/** True when a `width` x `height` board of `cell`-px cells fits the area on both axes. */
export const roomFits = (width: number, height: number, cell: number, area: BoardArea): boolean =>
  width * cell <= area.width && height * cell <= area.height;

/** The camera scroll that puts the centre of a room's board on the centre of the area (whole px, .5 rounds up). */
export const centerScroll = (
  origin: Position,
  width: number,
  height: number,
  cell: number,
  area: BoardArea
): Position => ({
  x: Math.round(origin.x + (width * cell) / 2 - (area.left + area.width / 2)),
  y: Math.round(origin.y + (height * cell) / 2 - (area.top + area.height / 2))
});

/** The scrolls the camera may take. */
export type ScrollRange = { minX: number; maxX: number; minY: number; maxY: number };

/**
 * The camera's range: the floor's rectangle with its margins (never less than the screen), widened to hold every
 * scroll that centres a room (docs/spec/rooms-and-floors.md "フロアの座標").
 */
export const cameraScrollRange = (
  cols: number,
  rows: number,
  cell: number,
  margins: { side: number; top: number; bottom: number },
  screen: { width: number; height: number },
  centers: readonly Position[]
): ScrollRange => {
  const bounds = cameraBounds(cols, rows, cell, margins, screen);
  return {
    minX: Math.min(0, ...centers.map((c) => c.x)),
    maxX: Math.max(bounds.width - screen.width, ...centers.map((c) => c.x)),
    minY: Math.min(0, ...centers.map((c) => c.y)),
    maxY: Math.max(bounds.height - screen.height, ...centers.map((c) => c.y))
  };
};

/**
 * The scroll that puts the screen's centre on `point`, kept inside `range`. The follow of the player and of a corridor
 * walk uses the range of the floor itself (no centring scrolls), so it never scrolls past the floor's edge into the
 * blank margin that only the centring (and a drag) may reach.
 */
export const followScroll = (point: Position, screen: { width: number; height: number }, range: ScrollRange): Position => ({
  x: Math.min(range.maxX, Math.max(range.minX, point.x - screen.width / 2)),
  y: Math.min(range.maxY, Math.max(range.minY, point.y - screen.height / 2))
});
