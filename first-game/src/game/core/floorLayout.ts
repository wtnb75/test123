import type { Heading, Position } from './types';

/** The unit vector of each heading, and its right-hand side (the heading turned 90° clockwise; y is down). */
export const HEADING_VECTOR: Record<Heading, Position> = {
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
  N: { x: 0, y: -1 }
};

const RIGHT_VECTOR: Record<Heading, Position> = {
  E: { x: 0, y: 1 },
  S: { x: -1, y: 0 },
  W: { x: 0, y: -1 },
  N: { x: 1, y: 0 }
};

export const HEADINGS: readonly Heading[] = ['E', 'S', 'W', 'N'];

export const oppositeHeading = (heading: Heading): Heading => HEADINGS[(HEADINGS.indexOf(heading) + 2) % 4];

/** The floor's heading from one draw `r` in [0, 1): right, down, left, up (docs/spec/rooms-and-floors.md). */
export const headingFromDraw = (r: number): Heading => HEADINGS[Math.min(3, Math.floor(r * 4))];

/** Where everything of a floor sits on the floor's grid (cells), with the top-left of the whole floor at (0, 0). */
export type FloorLayout = {
  heading: Heading;
  /** The grid cell of the top-left cell of room A and room B. */
  roomOrigin: [Position, Position];
  /** The corridor's cells on the grid, first (next to door A) to last (next to door B). */
  corridor: Position[];
  /** Size of the rectangle around the rooms and the corridor, in cells. */
  cols: number;
  rows: number;
};

/**
 * The floor's map (docs/spec/rooms-and-floors.md "フロアの座標"). Both rooms are `width` x `height`. `doorA` / `doorB`
 * are the door cells in each room's own coordinates; `shape` is the corridor in corridor coordinates (`x` forward,
 * `y` to the right). Room A is first put at (0, 0); everything is then moved so the top-left is (0, 0).
 */
export const floorLayout = (
  heading: Heading,
  width: number,
  height: number,
  doorA: Position,
  doorB: Position,
  shape: readonly Position[]
): FloorLayout => {
  const d = HEADING_VECTOR[heading];
  const n = RIGHT_VECTOR[heading];
  const corridor = shape.map((cell) => ({
    x: doorA.x + d.x * (1 + cell.x) + n.x * cell.y,
    y: doorA.y + d.y * (1 + cell.x) + n.y * cell.y
  }));
  const last = corridor[corridor.length - 1];
  const originB = { x: last.x + d.x - doorB.x, y: last.y + d.y - doorB.y };

  const xs = [0, width - 1, originB.x, originB.x + width - 1, ...corridor.map((c) => c.x)];
  const ys = [0, height - 1, originB.y, originB.y + height - 1, ...corridor.map((c) => c.y)];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    heading,
    roomOrigin: [{ x: 0 - minX, y: 0 - minY }, { x: originB.x - minX, y: originB.y - minY }],
    corridor: corridor.map((c) => ({ x: c.x - minX, y: c.y - minY })),
    cols: Math.max(...xs) - minX + 1,
    rows: Math.max(...ys) - minY + 1
  };
};

/** The cell of a room under a world point, when the room's first cell has its top-left at (`originX`, `originY`). */
export const cellAtWorld = (worldX: number, worldY: number, originX: number, originY: number, cell: number): Position => ({
  x: Math.floor((worldX - originX) / cell),
  y: Math.floor((worldY - originY) / cell)
});

/**
 * How far the camera may move: the floor's rectangle of `cols` x `rows` cells with `sideMargin` px on both sides,
 * `topMargin` above and `bottomMargin` below, and never less than the screen (docs/spec/rooms-and-floors.md).
 */
export const cameraBounds = (
  cols: number,
  rows: number,
  cell: number,
  margins: { side: number; top: number; bottom: number },
  screen: { width: number; height: number }
): { width: number; height: number } => ({
  width: Math.max(cols * cell + margins.side * 2, screen.width),
  height: Math.max(rows * cell + margins.top + margins.bottom, screen.height)
});

const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'] as const;

/** The arrow (one of 8 directions) for a vector in screen space; right is 0 degrees, y grows down. */
export const exitArrowDirection = (dx: number, dy: number): (typeof ARROWS)[number] => {
  const degrees = (((Math.atan2(dy, dx) * 180) / Math.PI) + 360) % 360;
  return ARROWS[Math.round(degrees / 45) % 8];
};
