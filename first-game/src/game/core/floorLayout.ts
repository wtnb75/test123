import type { FloorDoorRef, FloorGraph } from './floorGraph';
import { starGraph } from './floorGraph';
import type { Heading, Position, StageDoor } from './types';

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

/** A room of the floor as the placement sees it: its size and its doors (the cell next to each and the wall it is in). */
export type PlacedRoom = { width: number; height: number; doors: readonly StageDoor[] };

/** Where the rooms and the corridors of a floor sit on its grid (cells), with the top-left of the floor at (0, 0). */
export type FloorPlacement = {
  /** The grid cell of the top-left cell of each room, in room order. */
  roomOrigin: Position[];
  /** Each corridor's cells from its first door's end to its last, in corridor order. */
  corridors: Position[][];
  /** Size of the rectangle around the rooms and the corridors, in cells. */
  cols: number;
  rows: number;
};

/**
 * Puts a floor on one grid (docs/spec/rooms-and-floors.md "フロアの座標"). The start room's top-left is (0, 0) first;
 * each corridor, taken in list order from a room that already has a place, starts one cell outside its first door
 * and runs along `shapes[k]` (`x` forward, `y` to the right of the door's heading); the room at its other end is put
 * so that its door cell is the cell just past the corridor's last cell. Everything is then moved so the top-left of
 * the whole is (0, 0). The floor must be a tree reached from the start room through the corridors' first doors.
 */
export const placeFloor = (
  rooms: readonly PlacedRoom[],
  graph: FloorGraph,
  shapes: readonly (readonly Position[])[]
): FloorPlacement => {
  const origins: (Position | undefined)[] = rooms.map(() => undefined);
  origins[graph.startRoom] = { x: 0, y: 0 };
  const cells: Position[][] = graph.corridors.map(() => []);
  const doorOf = (ref: FloorDoorRef): StageDoor => rooms[ref.room].doors[ref.door];

  const done = new Set<number>();
  let placed = true;
  while (placed) {
    placed = false;
    graph.corridors.forEach((link, k) => {
      const from = origins[link.from.room];
      if (!from || done.has(k)) {
        return;
      }
      if (origins[link.to.room]) {
        throw new Error(`Corridor ${k} leads to a room that already has a place (the floor must be a tree).`);
      }
      const door = doorOf(link.from);
      const entry = doorOf(link.to);
      const d = HEADING_VECTOR[door.side];
      const n = RIGHT_VECTOR[door.side];
      cells[k] = shapes[k].map((cell) => ({
        x: from.x + door.cell.x + d.x * (1 + cell.x) + n.x * cell.y,
        y: from.y + door.cell.y + d.y * (1 + cell.x) + n.y * cell.y
      }));
      const last = cells[k][cells[k].length - 1];
      origins[link.to.room] = { x: last.x + d.x - entry.cell.x, y: last.y + d.y - entry.cell.y };
      done.add(k);
      placed = true;
    });
  }
  if (origins.some((origin) => origin === undefined)) {
    throw new Error('A room of the floor is not reached from the start room by a corridor.');
  }

  const roomOrigin = origins as Position[];
  const all = [
    ...roomOrigin.flatMap((origin, i) => [
      origin,
      { x: origin.x + rooms[i].width - 1, y: origin.y + rooms[i].height - 1 }
    ]),
    ...cells.flat()
  ];
  const minX = Math.min(...all.map((cell) => cell.x));
  const minY = Math.min(...all.map((cell) => cell.y));
  const shift = (cell: Position): Position => ({ x: cell.x - minX, y: cell.y - minY });
  return {
    roomOrigin: roomOrigin.map(shift),
    corridors: cells.map((corridor) => corridor.map(shift)),
    cols: Math.max(...all.map((cell) => cell.x)) - minX + 1,
    rows: Math.max(...all.map((cell) => cell.y)) - minY + 1
  };
};

/**
 * True when the floor's parts keep apart (docs/spec/rooms-and-floors.md "配置の条件"): no two rooms touch (an empty
 * row or column between them, diagonals too); a corridor cell is in no room and not next to a room other than the
 * two it joins; no two corridors share a cell or a side.
 */
export const placementFitsApart = (
  placement: FloorPlacement,
  rooms: readonly { width: number; height: number }[],
  graph: FloorGraph
): boolean => {
  const rects = placement.roomOrigin.map((origin, i) => ({
    x0: origin.x, y0: origin.y, x1: origin.x + rooms[i].width - 1, y1: origin.y + rooms[i].height - 1
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
  for (let k = 0; k < placement.corridors.length; k += 1) {
    const joined = [graph.corridors[k].from.room, graph.corridors[k].to.room];
    for (const cell of placement.corridors[k]) {
      const crossed = rects.some((r) => near(cell, r, 0));
      const crowded = rects.some((r, i) => !joined.includes(i) && near(cell, r, 1));
      if (crossed || crowded) {
        return false;
      }
    }
  }

  for (let a = 0; a < placement.corridors.length; a += 1) {
    for (let b = a + 1; b < placement.corridors.length; b += 1) {
      const touching = placement.corridors[a].some((p) =>
        placement.corridors[b].some((q) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) <= 1)
      );
      if (touching) {
        return false;
      }
    }
  }
  return true;
};

/** A corridor shape with `extension` straight cells added in front: (0,0)..(x-1,0), then the shape moved `x` forward. */
export const extendShape = (shape: readonly Position[], extension: number): Position[] => [
  ...Array.from({ length: extension }, (_, i) => ({ x: i, y: 0 })),
  ...shape.map((cell) => ({ x: cell.x + extension, y: cell.y }))
];

/** The result of `layoutTree`: the placement and each corridor's shape, or the corridor that could not be placed. */
export type TreeLayout =
  | { ok: true; placement: FloorPlacement; shapes: Position[][]; extensions: number[] }
  | { ok: false; failedCorridor: number };

/**
 * Lays a tree of rooms out corridor by corridor (docs/spec/rooms-and-floors.md "通路の長さの伸ばし方"). Corridor `j`
 * must lead to room `j + 1` from a room with a smaller index. For each one: its base shape (`baseShapes[j]`) is tried
 * with 0, 1, .. `maxExtension` straight cells in front, and the first that keeps the parts apart (against the rooms
 * and corridors placed so far) is used; if none does, a new shape is drawn with `redraw`, up to `retries` times.
 */
export const layoutTree = (
  rooms: readonly PlacedRoom[],
  graph: FloorGraph,
  baseShapes: readonly (readonly Position[])[],
  redraw: () => Position[],
  maxExtension: number,
  retries: number
): TreeLayout => {
  const shapes: Position[][] = [];
  const extensions: number[] = [];
  let placement = placeFloor(rooms.slice(0, 1), { startRoom: graph.startRoom, corridors: [] }, []);

  for (let j = 0; j < graph.corridors.length; j += 1) {
    const child = graph.corridors[j].to.room;
    const roomsSoFar = rooms.slice(0, child + 1);
    const sub: FloorGraph = { startRoom: graph.startRoom, corridors: graph.corridors.slice(0, j + 1) };
    let found = false;
    for (let attempt = 0; attempt <= retries && !found; attempt += 1) {
      const base = attempt === 0 ? baseShapes[j] : redraw();
      for (let x = 0; x <= maxExtension && !found; x += 1) {
        const shape = x === 0 ? base : extendShape(base, x);
        const tried = placeFloor(roomsSoFar, sub, [...shapes, shape]);
        if (placementFitsApart(tried, roomsSoFar, sub)) {
          placement = tried;
          shapes.push(shape);
          extensions.push(x);
          found = true;
        }
      }
    }
    if (!found) {
      return { ok: false, failedCorridor: j };
    }
  }
  return { ok: true, placement, shapes, extensions };
};

/** Where everything of a three-room floor sits on the floor's grid (cells), with the top-left of the floor at (0, 0). */
export type FloorMap = FloorPlacement & {
  /** The heading of door A1 and of door A2. */
  headings: [Heading, Heading];
};

/**
 * The map of a floor of three rooms of `width` x `height` (docs/spec/rooms-and-floors.md "フロアの座標"), placed
 * with `placeFloor` on the star graph. `doorsA` are the cells next to door A1 and A2 in room A; `entries` the cells
 * next to the door of room B and room C in their own coordinates; `shapes` the two corridors in corridor coordinates.
 */
export const floorMap = (
  headings: [Heading, Heading],
  width: number,
  height: number,
  doorsA: [Position, Position],
  entries: [Position, Position],
  shapes: [readonly Position[], readonly Position[]]
): FloorMap => {
  const rooms: PlacedRoom[] = [
    { width, height, doors: [{ cell: doorsA[0], side: headings[0] }, { cell: doorsA[1], side: headings[1] }] },
    { width, height, doors: [{ cell: entries[0], side: oppositeHeading(headings[0]) }] },
    { width, height, doors: [{ cell: entries[1], side: oppositeHeading(headings[1]) }] }
  ];
  return { headings, ...placeFloor(rooms, starGraph(3), shapes) };
};

/** `placementFitsApart` for the three-room map made by `floorMap` (all rooms `width` x `height`). */
export const floorFitsApart = (map: FloorMap, width: number, height: number): boolean =>
  placementFitsApart(map, map.roomOrigin.map(() => ({ width, height })), starGraph(map.roomOrigin.length));

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
  pad = 30,
  topInset = 0
): ExitMarker[] => {
  // The top of the area the player can see (below the HUD band and a gap), kept above the screen's middle so a
  // short screen with a tall band still points the right way; arrows sit `pad` from the border, or at that top.
  const top = Math.max(0, Math.min(topInset, camera.height / 2 - 1));
  const padTop = Math.max(pad, top);
  const half = { x: camera.width / 2, y: camera.height / 2 };
  const kept = new Map<string, { marker: ExitMarker; distance: number }>();
  for (const exit of exits) {
    const sx = exit.x - camera.left;
    const sy = exit.y - camera.top;
    if (sx >= 0 && sx <= camera.width && sy >= top && sy <= camera.height) {
      continue;
    }
    const dx = sx - half.x;
    const dy = sy - half.y;
    const tx = dx !== 0 ? (dx > 0 ? (camera.width - pad - half.x) / dx : (pad - half.x) / dx) : Infinity;
    const ty = dy !== 0 ? (dy > 0 ? (camera.height - pad - half.y) / dy : (padTop - half.y) / dy) : Infinity;
    const t = Math.min(tx, ty);
    const marker: ExitMarker = {
      text: `${exit.label} ${exitArrowDirection(dx, dy)}`,
      x: Math.min(camera.width - pad, Math.max(pad, half.x + dx * t)),
      y: Math.min(camera.height - pad, Math.max(padTop, half.y + dy * t))
    };
    const distance = Math.hypot(dx, dy);
    const same = kept.get(marker.text);
    if (!same || distance < same.distance) {
      kept.set(marker.text, { marker, distance });
    }
  }
  return [...kept.values()].map((entry) => entry.marker);
};
