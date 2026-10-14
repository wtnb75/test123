import type { Heading, Position, Stage } from './types';
import { scaledDimension } from './cellAppearance';

/** The wall around a room (docs/spec/rooms-and-floors.md "壁と扉の見た目"): thickness at the reference cell, colour. */
export const WALL_THICKNESS = 2;
export const WALL_COLOR = 0x6f8197;
/** The length of each post of a door's frame, at the reference cell (docs/spec/rooms-and-floors.md). */
export const DOOR_POST_LENGTH = 12;
export const DOOR_FRAME_COLOR = 0x74b9ff;

/** The cell next to the room's door (room A's exit = `goal`, room B's entry = `start`), if the room has a door. */
export const doorCellOf = (stage: Pick<Stage, 'goal' | 'start' | 'goalKind' | 'startKind'>): Position | undefined => {
  if (stage.goalKind === 'door') {
    return stage.goal;
  }
  return stage.startKind === 'door' ? stage.start : undefined;
};

export type WallRect = { x: number; y: number; width: number; height: number };

export type RoomWalls = {
  /** The wall's bars, relative to the top-left corner of the room's first cell. */
  bars: WallRect[];
  /** Where the door's "+" is centred (the middle of the gap), relative to the same corner. */
  door?: Position;
  /** The two posts of the door's frame: short bars across the wall at both ends of the gap. */
  posts?: WallRect[];
};

/** The wall's thickness for a cell size: scaled from the reference cell, never under one pixel. */
export const wallThickness = (cell: number): number => scaledDimension(WALL_THICKNESS, cell);

/**
 * The bars of the wall around a `width` x `height` room of cells of `cell` px, with a gap one cell wide where the
 * door is (`doorCell` is the cell next to the door, `side` the wall it is in). The top and bottom bars run the full
 * width (corners included); the left bar and the right bar fill the rest. Left and top lie outside the cells (in
 * the 2 px before the first cell), right and bottom in the gap after the last cell.
 */
export const roomWalls = (
  width: number,
  height: number,
  cell: number,
  side?: Heading,
  doorCell?: Position
): RoomWalls => {
  const t = wallThickness(cell);
  const w = width * cell;
  const h = height * cell;
  const bars: WallRect[] = [];
  const add = (bar: WallRect): void => {
    if (bar.width > 0 && bar.height > 0) {
      bars.push(bar);
    }
  };

  // A bar along x (top or bottom) or along y (left or right), minus the door's gap when it is in this wall
  // (a door at the end of a wall leaves no bar on that side).
  const horizontal = (y: number, gapAt?: number): void => {
    if (gapAt === undefined) {
      add({ x: -t, y, width: w + t, height: t });
      return;
    }
    const gapStart = gapAt * cell;
    add({ x: -t, y, width: gapStart + t, height: t });
    add({ x: gapStart + cell, y, width: w - gapStart - cell, height: t });
  };
  const vertical = (x: number, gapAt?: number): void => {
    if (gapAt === undefined) {
      add({ x, y: 0, width: t, height: h });
      return;
    }
    const gapStart = gapAt * cell;
    add({ x, y: 0, width: t, height: gapStart });
    add({ x, y: gapStart + cell, width: t, height: h - gapStart - cell });
  };

  const hasDoor = side !== undefined && doorCell !== undefined;
  horizontal(-t, hasDoor && side === 'N' ? doorCell.x : undefined);
  horizontal(h - t, hasDoor && side === 'S' ? doorCell.x : undefined);
  vertical(-t, hasDoor && side === 'W' ? doorCell.y : undefined);
  vertical(w - t, hasDoor && side === 'E' ? doorCell.y : undefined);

  if (!hasDoor) {
    return { bars };
  }
  const centre = {
    N: { x: doorCell.x * cell + cell / 2, y: -t / 2 },
    S: { x: doorCell.x * cell + cell / 2, y: h - t / 2 },
    W: { x: -t / 2, y: doorCell.y * cell + cell / 2 },
    E: { x: w - t / 2, y: doorCell.y * cell + cell / 2 }
  }[side];
  const long = scaledDimension(DOOR_POST_LENGTH, cell);
  const gapStart = (side === 'N' || side === 'S' ? doorCell.x : doorCell.y) * cell;
  const gapEnds = [gapStart, gapStart + cell - t];
  const posts = gapEnds.map((at): WallRect => (
    side === 'N' || side === 'S'
      ? { x: at, y: centre.y - long / 2, width: t, height: long }
      : { x: centre.x - long / 2, y: at, width: long, height: t }
  ));
  return { bars, door: centre, posts };
};
