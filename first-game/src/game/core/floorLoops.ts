import { CORRIDOR_LENGTH, MAX_CORRIDOR_EXTENSION } from './corridor';
import type { FloorGraph } from './floorGraph';
import { HEADING_VECTOR, oppositeHeading, placementFitsApart, type FloorPlacement, type PlacedRoom } from './floorLayout';
import type { Rng } from './random';
import type { Heading, Position, StageDoor } from './types';

/** Most loops a floor gets (docs/spec/rooms-and-floors.md "パラメータ表"). */
export const LOOP_COUNT_MAX = 2;
/** A loop corridor is at least this many cells long (the cells between the two walls)... */
export const LOOP_MIN_LENGTH = 3;
/** ...and at most this many (the longest tree corridor: `CorridorLength` + `MaxCorridorExtension`). */
export const LOOP_MAX_LENGTH = CORRIDOR_LENGTH + MAX_CORRIDOR_EXTENSION;
/** A loop door is at least this far (Chebyshev) from every other door cell of its room. */
export const LOOP_DOOR_MIN_DISTANCE = 2;

/** The number of loops a floor tries to place from one draw: `floor(r * (max + 1))` (`max`: `LoopCountMax`). */
export const loopCountFromDraw = (r: number, max: number = LOOP_COUNT_MAX): number =>
  Math.min(max, Math.floor(r * (max + 1)));

/** A pair of rooms that a straight corridor can join, and the rows (E/W) or columns (S/N) it can run along. */
export type LoopCandidate = {
  /** The room with the smaller index (the corridor's start) and the other room. */
  from: number;
  to: number;
  /** The heading from `from` towards `to`. */
  heading: Heading;
  /** The number of cells between the two walls (the corridor's length). */
  length: number;
  /** The floor-grid rows (heading E/W) or columns (S/N) that keep apart; reading order (top / left first). */
  lines: number[];
};

/** A loop that was placed: the corridor's cells and the two doors (each in its own room's coordinates). */
export type PlacedLoop = {
  from: number;
  to: number;
  heading: Heading;
  length: number;
  cells: Position[];
  fromDoor: StageDoor;
  toDoor: StageDoor;
};

type Rect = { x0: number; y0: number; x1: number; y1: number };

const chebyshev = (a: Position, b: Position): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

const linked = (graph: FloorGraph, a: number, b: number): boolean =>
  graph.corridors.some(
    (link) => (link.from.room === a && link.to.room === b) || (link.from.room === b && link.to.room === a)
  );

/** The door cells (room coordinates) of `from` and `to` for a corridor along `line` with `heading`, and the first cell's floor position. */
const loopEnds = (
  a: Rect,
  b: Rect,
  heading: Heading,
  line: number
): { fromCell: Position; toCell: Position; first: Position } => {
  switch (heading) {
    case 'E':
      return {
        fromCell: { x: a.x1 - a.x0, y: line - a.y0 },
        toCell: { x: 0, y: line - b.y0 },
        first: { x: a.x1 + 1, y: line }
      };
    case 'W':
      return {
        fromCell: { x: 0, y: line - a.y0 },
        toCell: { x: b.x1 - b.x0, y: line - b.y0 },
        first: { x: a.x0 - 1, y: line }
      };
    case 'S':
      return {
        fromCell: { x: line - a.x0, y: a.y1 - a.y0 },
        toCell: { x: line - b.x0, y: 0 },
        first: { x: line, y: a.y1 + 1 }
      };
    default:
      return {
        fromCell: { x: line - a.x0, y: 0 },
        toCell: { x: line - b.x0, y: b.y1 - b.y0 },
        first: { x: line, y: a.y0 - 1 }
      };
  }
};

const rectsOf = (rooms: readonly PlacedRoom[], placement: FloorPlacement): Rect[] =>
  placement.roomOrigin.map((origin, i) => ({
    x0: origin.x,
    y0: origin.y,
    x1: origin.x + rooms[i].width - 1,
    y1: origin.y + rooms[i].height - 1
  }));

const cellsOf = (first: Position, heading: Heading, length: number): Position[] => {
  const d = HEADING_VECTOR[heading];
  return Array.from({ length }, (_, i) => ({ x: first.x + d.x * i, y: first.y + d.y * i }));
};

/**
 * The pairs of rooms a loop can join (docs/spec/rooms-and-floors.md "輪"): neither is room 0 (the start room), they
 * are not joined yet, one lies to the side of the other with the two rectangles overlapping on the other axis, and
 * the gap is `LOOP_MIN_LENGTH`..`LOOP_MAX_LENGTH` cells. A line of the overlap is usable when the straight corridor
 * on it keeps apart from the rooms and corridors (`placementFitsApart`) and both door cells stay
 * `LOOP_DOOR_MIN_DISTANCE` from the other doors of their rooms. Pairs come in (from, to) index order.
 */
export const loopCandidates = (
  rooms: readonly PlacedRoom[],
  placement: FloorPlacement,
  graph: FloorGraph
): LoopCandidate[] => {
  const rects = rectsOf(rooms, placement);
  const result: LoopCandidate[] = [];
  const doorFarEnough = (room: number, cell: Position): boolean =>
    rooms[room].doors.every((door) => chebyshev(door.cell, cell) >= LOOP_DOOR_MIN_DISTANCE);

  for (let from = 1; from < rooms.length; from += 1) {
    for (let to = from + 1; to < rooms.length; to += 1) {
      if (linked(graph, from, to)) {
        continue;
      }
      const a = rects[from];
      const b = rects[to];
      let heading: Heading | undefined;
      let length = 0;
      let lo = 0;
      let hi = -1;
      if (a.y0 <= b.y1 && b.y0 <= a.y1) {
        lo = Math.max(a.y0, b.y0);
        hi = Math.min(a.y1, b.y1);
        if (a.x1 < b.x0) {
          heading = 'E';
          length = b.x0 - a.x1 - 1;
        } else if (b.x1 < a.x0) {
          heading = 'W';
          length = a.x0 - b.x1 - 1;
        }
      } else if (a.x0 <= b.x1 && b.x0 <= a.x1) {
        lo = Math.max(a.x0, b.x0);
        hi = Math.min(a.x1, b.x1);
        if (a.y1 < b.y0) {
          heading = 'S';
          length = b.y0 - a.y1 - 1;
        } else if (b.y1 < a.y0) {
          heading = 'N';
          length = a.y0 - b.y1 - 1;
        }
      }
      if (!heading || length < LOOP_MIN_LENGTH || length > LOOP_MAX_LENGTH) {
        continue;
      }
      const lines: number[] = [];
      for (let line = lo; line <= hi; line += 1) {
        const ends = loopEnds(a, b, heading, line);
        if (!doorFarEnough(from, ends.fromCell) || !doorFarEnough(to, ends.toCell)) {
          continue;
        }
        const cells = cellsOf(ends.first, heading, length);
        const tried: FloorPlacement = { ...placement, corridors: [...placement.corridors, cells] };
        const triedGraph: FloorGraph = {
          startRoom: graph.startRoom,
          corridors: [...graph.corridors, { from: { room: from, door: 0 }, to: { room: to, door: 0 } }]
        };
        if (placementFitsApart(tried, rooms, triedGraph)) {
          lines.push(line);
        }
      }
      if (lines.length > 0) {
        result.push({ from, to, heading, length, lines });
      }
    }
  }
  return result;
};

/** The loop a candidate list and two draws give: the pair `floor(r1 * pairs)`, then its line `floor(r2 * lines)`. */
export const chooseLoop = (
  rooms: readonly PlacedRoom[],
  placement: FloorPlacement,
  candidates: readonly LoopCandidate[],
  r1: number,
  r2: number
): PlacedLoop => {
  const pair = candidates[Math.min(candidates.length - 1, Math.floor(r1 * candidates.length))];
  const line = pair.lines[Math.min(pair.lines.length - 1, Math.floor(r2 * pair.lines.length))];
  const rects = rectsOf(rooms, placement);
  const ends = loopEnds(rects[pair.from], rects[pair.to], pair.heading, line);
  return {
    from: pair.from,
    to: pair.to,
    heading: pair.heading,
    length: pair.length,
    cells: cellsOf(ends.first, pair.heading, pair.length),
    fromDoor: { cell: ends.fromCell, side: pair.heading },
    toDoor: { cell: ends.toCell, side: oppositeHeading(pair.heading) }
  };
};

/** What `placeLoops` makes of a floor's tree layout: the loops and the placement, rooms and graph with them added. */
export type LoopedFloor = {
  loops: PlacedLoop[];
  placement: FloorPlacement;
  rooms: PlacedRoom[];
  graph: FloorGraph;
};

/**
 * Places the floor's loops (docs/spec/rooms-and-floors.md "ルール" step 9): one draw gives how many are tried
 * (`LOOP_COUNT_MAX` at most); each takes two more draws (the pair, then its line) from `rng`; with no candidate left
 * the rest are dropped. Each loop adds one door at the end of both rooms' door lists and one corridor at the end of
 * the graph and of the placement (their bounding rectangle does not change: a straight corridor lies between its rooms).
 */
export const placeLoops = (
  rooms: readonly PlacedRoom[],
  placement: FloorPlacement,
  graph: FloorGraph,
  rng: Rng,
  maxLoops: number = LOOP_COUNT_MAX
): LoopedFloor => {
  let placedRooms = rooms.map((room) => ({ ...room, doors: [...room.doors] }));
  let nextPlacement = placement;
  let nextGraph = graph;
  const loops: PlacedLoop[] = [];
  const count = loopCountFromDraw(rng(), maxLoops);
  for (let n = 0; n < count; n += 1) {
    const candidates = loopCandidates(placedRooms, nextPlacement, nextGraph);
    if (candidates.length === 0) {
      break;
    }
    const loop = chooseLoop(placedRooms, nextPlacement, candidates, rng(), rng());
    nextGraph = {
      startRoom: nextGraph.startRoom,
      corridors: [
        ...nextGraph.corridors,
        {
          from: { room: loop.from, door: placedRooms[loop.from].doors.length },
          to: { room: loop.to, door: placedRooms[loop.to].doors.length }
        }
      ]
    };
    placedRooms = placedRooms.map((room, i) => {
      if (i === loop.from) {
        return { ...room, doors: [...room.doors, loop.fromDoor] };
      }
      return i === loop.to ? { ...room, doors: [...room.doors, loop.toDoor] } : room;
    });
    nextPlacement = { ...nextPlacement, corridors: [...nextPlacement.corridors, loop.cells] };
    loops.push(loop);
  }
  return { loops, placement: nextPlacement, rooms: placedRooms, graph: nextGraph };
};

/**
 * The doors of `room` the player may come into it through first (docs/spec/rooms-and-floors.md "入口になりうる扉"):
 * those whose corridor leads to a room that is reachable from the start room without passing through `room`.
 * Door indices, ascending. The start room has none (the player begins in it).
 */
export const enterableDoors = (graph: FloorGraph, room: number): number[] => {
  if (room === graph.startRoom) {
    return [];
  }
  const reached = new Set<number>([graph.startRoom]);
  const queue = [graph.startRoom];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    for (const link of graph.corridors) {
      for (const [near, far] of [[link.from, link.to], [link.to, link.from]] as const) {
        if (near.room === at && far.room !== room && !reached.has(far.room)) {
          reached.add(far.room);
          queue.push(far.room);
        }
      }
    }
  }
  const doors = new Set<number>();
  for (const link of graph.corridors) {
    for (const [near, far] of [[link.from, link.to], [link.to, link.from]] as const) {
      if (near.room === room && reached.has(far.room)) {
        doors.add(near.door);
      }
    }
  }
  return [...doors].sort((a, b) => a - b);
};
