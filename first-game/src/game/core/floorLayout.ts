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

/**
 * The headings of door A1 and door A2 from one draw `r` in [0, 1): `k = floor(r * 12)`; door A1 gets the
 * `floor(k / 3)`-th of right, down, left, up, door A2 the `k mod 3`-th of the other three (in that order).
 */
export const headingPairFromDraw = (r: number): [Heading, Heading] => {
  const k = Math.min(11, Math.floor(r * 12));
  const first = HEADINGS[Math.floor(k / 3)];
  return [first, HEADINGS.filter((heading) => heading !== first)[k % 3]];
};

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

/** Where everything of a three-room floor sits on the floor's grid (cells), with the top-left of the floor at (0, 0). */
export type FloorMap = {
  /** The heading of door A1 and of door A2. */
  headings: [Heading, Heading];
  /** The grid cell of the top-left cell of room A, room B and room C. */
  roomOrigin: [Position, Position, Position];
  /** Corridor 1 (room A - room B) and corridor 2 (room A - room C): cells from the room A end to the other. */
  corridors: [Position[], Position[]];
  /** Size of the rectangle around the rooms and the corridors, in cells. */
  cols: number;
  rows: number;
};

/**
 * The map of a floor of three rooms of `width` x `height` (docs/spec/rooms-and-floors.md "フロアの座標"). `doorsA`
 * are the cells next to door A1 and A2 in room A; `entries` the cells next to the door of room B and room C in their
 * own coordinates; `shapes` the two corridors in corridor coordinates.
 */
export const floorMap = (
  headings: [Heading, Heading],
  width: number,
  height: number,
  doorsA: [Position, Position],
  entries: [Position, Position],
  shapes: [readonly Position[], readonly Position[]]
): FloorMap => {
  const parts = [0, 1].map((k) => {
    const layout = floorLayout(headings[k], width, height, doorsA[k], entries[k], shapes[k]);
    // floorLayout moved everything so its own top-left is (0, 0); put room A back at (0, 0).
    const home = layout.roomOrigin[0];
    return {
      room: { x: layout.roomOrigin[1].x - home.x, y: layout.roomOrigin[1].y - home.y },
      corridor: layout.corridor.map((cell) => ({ x: cell.x - home.x, y: cell.y - home.y }))
    };
  });
  const rooms: Position[] = [{ x: 0, y: 0 }, parts[0].room, parts[1].room];
  const all = [
    ...rooms.flatMap((room) => [room, { x: room.x + width - 1, y: room.y + height - 1 }]),
    ...parts[0].corridor,
    ...parts[1].corridor
  ];
  const minX = Math.min(...all.map((cell) => cell.x));
  const minY = Math.min(...all.map((cell) => cell.y));
  const shift = (cell: Position): Position => ({ x: cell.x - minX, y: cell.y - minY });
  return {
    headings,
    roomOrigin: [shift(rooms[0]), shift(rooms[1]), shift(rooms[2])],
    corridors: [parts[0].corridor.map(shift), parts[1].corridor.map(shift)],
    cols: Math.max(...all.map((cell) => cell.x)) - minX + 1,
    rows: Math.max(...all.map((cell) => cell.y)) - minY + 1
  };
};

/**
 * True when the floor's parts keep apart (docs/spec/rooms-and-floors.md "配置の条件"): no two rooms touch (an empty
 * row or column between them, diagonals too); a corridor cell is in no room and not next to a room other than the
 * two it joins; the two corridors share no cell and no side.
 */
export const floorFitsApart = (map: FloorMap, width: number, height: number): boolean => {
  const rects = map.roomOrigin.map((origin) => ({
    x0: origin.x, y0: origin.y, x1: origin.x + width - 1, y1: origin.y + height - 1
  }));
  const apart = (a: (typeof rects)[number], b: (typeof rects)[number]): boolean =>
    a.x1 + 1 < b.x0 || b.x1 + 1 < a.x0 || a.y1 + 1 < b.y0 || b.y1 + 1 < a.y0;
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      if (!apart(rects[i], rects[j])) {
        return false;
      }
    }
  }

  const near = (cell: Position, r: (typeof rects)[number], margin: number): boolean =>
    cell.x >= r.x0 - margin && cell.x <= r.x1 + margin && cell.y >= r.y0 - margin && cell.y <= r.y1 + margin;
  for (let k = 0; k < 2; k += 1) {
    const stranger = rects[k === 0 ? 2 : 1];
    for (const cell of map.corridors[k]) {
      if (rects.some((r) => near(cell, r, 0)) || near(cell, stranger, 1)) {
        return false;
      }
    }
  }

  return !map.corridors[0].some((p) =>
    map.corridors[1].some((q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) <= 1)
  );
};

/** An exit the player may look for: its centre on the floor's grid in px and the word of its arrow. */
export type ExitTarget = { x: number; y: number; label: 'DOOR' | 'GOAL' };

/** An arrow to draw on the screen: its text and where (screen px). */
export type ExitMarker = { text: string; x: number; y: number };

/**
 * The arrows for the exits that are off the screen (docs/spec/rooms-and-floors.md "画面外の出口の矢印"). The camera
 * is `camera.left/top` (scroll) and `width` x `height`. Each arrow sits where the ray from the screen centre to the
 * exit meets the screen border, `pad` px inside it. Two exits with the same word and the same arrow character
 * make one marker: the one nearer the camera centre (the earlier one when equally near).
 */
export const exitMarkers = (
  exits: readonly ExitTarget[],
  camera: { left: number; top: number; width: number; height: number },
  pad = 30
): ExitMarker[] => {
  const half = { x: camera.width / 2, y: camera.height / 2 };
  const kept = new Map<string, { marker: ExitMarker; distance: number }>();
  for (const exit of exits) {
    const sx = exit.x - camera.left;
    const sy = exit.y - camera.top;
    if (sx >= 0 && sx <= camera.width && sy >= 0 && sy <= camera.height) {
      continue;
    }
    const dx = sx - half.x;
    const dy = sy - half.y;
    const tx = dx !== 0 ? (dx > 0 ? (camera.width - pad - half.x) / dx : (pad - half.x) / dx) : Infinity;
    const ty = dy !== 0 ? (dy > 0 ? (camera.height - pad - half.y) / dy : (pad - half.y) / dy) : Infinity;
    const t = Math.min(tx, ty);
    const marker: ExitMarker = {
      text: `${exit.label} ${exitArrowDirection(dx, dy)}`,
      x: Math.min(camera.width - pad, Math.max(pad, half.x + dx * t)),
      y: Math.min(camera.height - pad, Math.max(pad, half.y + dy * t))
    };
    const distance = Math.hypot(dx, dy);
    const same = kept.get(marker.text);
    if (!same || distance < same.distance) {
      kept.set(marker.text, { marker, distance });
    }
  }
  return [...kept.values()].map((entry) => entry.marker);
};
