import type { Heading, Position, Stage, StageDoor } from './types';
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

/** A door's frame: where its "+" is centred and the two posts (relative to the top-left of the room's first cell). */
export type DoorMark = { center: Position; posts: WallRect[] };

/** The doors of a room, first door first: the `doors` list, or the one door the `goal`/`start` kinds describe. */
export const roomDoors = (
  stage: Pick<Stage, 'goal' | 'start' | 'goalKind' | 'startKind' | 'doorSide' | 'doors'>
): StageDoor[] => {
  if (stage.doors) {
    return stage.doors;
  }
  const cell = doorCellOf(stage);
  return cell && stage.doorSide ? [{ cell, side: stage.doorSide }] : [];
};

/**
 * The bars of the wall around a `width` x `height` room of cells of `cell` px, with a gap one cell wide at each door
 * (a door's `cell` is the cell next to it, `side` the wall it is in), and the mark of each door. The top and bottom
 * bars run the full width (corners included); the left bar and the right bar fill the rest. Left and top lie
 * outside the cells (in the 2 px before the first cell), right and bottom in the gap after the last cell. A door
 * at the end of a wall leaves no bar on that side. Door marks come in the order of `doors`.
 */
export const roomWallsFor = (
  width: number,
  height: number,
  cell: number,
  doors: readonly StageDoor[]
): { bars: WallRect[]; doors: DoorMark[] } => {
  const t = wallThickness(cell);
  const w = width * cell;
  const h = height * cell;
  const bars: WallRect[] = [];
  const add = (bar: WallRect): void => {
    if (bar.width > 0 && bar.height > 0) {
      bars.push(bar);
    }
  };
  const gapsOn = (side: Heading): number[] =>
    doors
      .filter((door) => door.side === side)
      .map((door) => (side === 'N' || side === 'S' ? door.cell.x : door.cell.y))
      .sort((a, b) => a - b);

  // A bar along x (top or bottom) or along y (left or right), cut at each door's gap.
  const horizontal = (y: number, gaps: number[]): void => {
    let cursor = -t;
    for (const gap of gaps) {
      add({ x: cursor, y, width: gap * cell - cursor, height: t });
      cursor = gap * cell + cell;
    }
    add({ x: cursor, y, width: w - cursor, height: t });
  };
  const vertical = (x: number, gaps: number[]): void => {
    let cursor = 0;
    for (const gap of gaps) {
      add({ x, y: cursor, width: t, height: gap * cell - cursor });
      cursor = gap * cell + cell;
    }
    add({ x, y: cursor, width: t, height: h - cursor });
  };

  horizontal(-t, gapsOn('N'));
  horizontal(h - t, gapsOn('S'));
  vertical(-t, gapsOn('W'));
  vertical(w - t, gapsOn('E'));

  const long = scaledDimension(DOOR_POST_LENGTH, cell);
  const marks = doors.map(({ cell: door, side }): DoorMark => {
    const center = {
      N: { x: door.x * cell + cell / 2, y: -t / 2 },
      S: { x: door.x * cell + cell / 2, y: h - t / 2 },
      W: { x: -t / 2, y: door.y * cell + cell / 2 },
      E: { x: w - t / 2, y: door.y * cell + cell / 2 }
    }[side];
    const gapStart = (side === 'N' || side === 'S' ? door.x : door.y) * cell;
    const posts = [gapStart, gapStart + cell - t].map((at): WallRect => (
      side === 'N' || side === 'S'
        ? { x: at, y: center.y - long / 2, width: t, height: long }
        : { x: center.x - long / 2, y: at, width: long, height: t }
    ));
    return { center, posts };
  });
  return { bars, doors: marks };
};

/** `roomWallsFor` for a room with at most one door (`side` is the wall of `doorCell`). */
export const roomWalls = (
  width: number,
  height: number,
  cell: number,
  side?: Heading,
  doorCell?: Position
): RoomWalls => {
  const hasDoor = side !== undefined && doorCell !== undefined;
  const { bars, doors } = roomWallsFor(width, height, cell, hasDoor ? [{ cell: doorCell, side }] : []);
  return doors.length === 0 ? { bars } : { bars, door: doors[0].center, posts: doors[0].posts };
};
