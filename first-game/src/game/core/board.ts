import type { Cell, Heading, Position, Stage, StageDoor, StageParams } from './types';
import { oppositeHeading } from './floorLayout';
import type { Rng } from './random';
import { randInt } from './random';

export const indexOf = (stage: Pick<Stage, 'width'>, pos: Position): number => {
  return pos.y * stage.width + pos.x;
};

export const inBounds = (stage: Pick<Stage, 'width' | 'height'>, pos: Position): boolean => {
  return pos.x >= 0 && pos.x < stage.width && pos.y >= 0 && pos.y < stage.height;
};

export const neighbors8 = (stage: Pick<Stage, 'width' | 'height'>, pos: Position): Position[] => {
  const result: Position[] = [];

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const candidate = { x: pos.x + dx, y: pos.y + dy };
      if (inBounds(stage, candidate)) {
        result.push(candidate);
      }
    }
  }

  return result;
};

const createCells = (width: number, height: number): Cell[] => {
  return Array.from({ length: width * height }, () => ({
    hasBomb: false,
    flagged: false,
    revealed: false,
    hint: 0
  }));
};

/** Start (up-stairs) and goal (down-stairs) stay at least this many cells away from every edge (docs/spec.md). */
export const STAIRS_MARGIN = 1;
/** The goal is at least `ceil((min(width, height) - 3) * this)` cells (Chebyshev) from the start. */
export const STAIRS_MIN_DISTANCE_RATIO = 0.9;

export const stairsMinDistance = (width: number, height: number, ratio = STAIRS_MIN_DISTANCE_RATIO): number =>
  Math.max(1, Math.ceil((Math.min(width, height) - 3) * ratio));

/** The interior range of one axis: `STAIRS_MARGIN` from each edge (smaller only on boards too small for it). */
const interiorRange = (size: number): { lo: number; hi: number } => {
  const lo = Math.min(STAIRS_MARGIN, Math.floor((size - 1) / 2));
  return { lo, hi: size - 1 - lo };
};

const chebyshev = (a: Position, b: Position): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * The kinds of room of a floor: A holds the up-stairs and door(s) A; B (a leaf) holds its entry door and, unless
 * it is a dead end, the down-stairs; C (a branching room) holds its entry door and one or two exit doors.
 */
export type RoomRole = 'A' | 'B' | 'C';

/**
 * Options of the room anchors: room A's second door (on the `heading2` wall); a leaf without down-stairs; the walls
 * of a branching room's exits (in child order, one or two).
 */
export type RoomOptions = {
  heading2?: Heading;
  /** `false`: a dead-end room (no down-stairs). Default `true`. */
  withDown?: boolean;
  exits?: Heading[];
};

/** The cells that touch the wall on `side`, in reading order (top row first, left to right). */
export const wallCells = (width: number, height: number, side: Heading): Position[] => {
  const cells: Position[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const touches =
        (side === 'E' && x === width - 1) ||
        (side === 'W' && x === 0) ||
        (side === 'S' && y === height - 1) ||
        (side === 'N' && y === 0);
      if (touches) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
};

const interiorCells = (width: number, height: number): Position[] => {
  const xs = interiorRange(width);
  const ys = interiorRange(height);
  const cells: Position[] = [];
  for (let y = ys.lo; y <= ys.hi; y += 1) {
    for (let x = xs.lo; x <= xs.hi; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
};

/** Uniform over the cells at least `minDistance` from `from`; none: the first (reading order) of the farthest of `fallback`. */
const pickFar = (
  candidates: Position[],
  fallback: Position[],
  from: Position,
  minDistance: number,
  rng: Rng
): Position => {
  const far = candidates.filter((cell) => chebyshev(cell, from) >= minDistance);
  if (far.length > 0) {
    return far[randInt(rng, far.length)];
  }
  let best = fallback[0];
  for (const cell of fallback) {
    if (chebyshev(cell, from) > chebyshev(best, from)) {
      best = cell;
    }
  }
  return best;
};

/**
 * Where a room's start and goal go (docs/spec/rooms-and-floors.md "ルール"). `heading` is the wall of the door
 * the room is reached through (room A: door A1). Role `C` (a branching room): the start is the entry, `goal` and
 * `goal2` are its one or two exits on the `options.exits` walls.
 * Room A: the start (up-stairs) is uniform over the interior, the goal (the cell next to door A, on the `heading`
 * wall) a wall cell far enough from it; none: the farthest wall cell, the first in reading order. Room B: the start
 * (the cell next to door B, on the opposite wall) is uniform over that wall's cells, the goal (down-stairs) an
 * interior cell far enough from it; none: the interior corner farthest from it (ties: top, then left).
 */
export const chooseRoomAnchors = (
  width: number,
  height: number,
  role: RoomRole,
  heading: Heading,
  rng: Rng,
  ratio = STAIRS_MIN_DISTANCE_RATIO,
  options: RoomOptions = {}
): { start: Position; goal: Position; goal2?: Position } => {
  const minDistance = stairsMinDistance(width, height, ratio);

  if (role === 'A') {
    const xs = interiorRange(width);
    const ys = interiorRange(height);
    const start: Position = {
      x: xs.lo + randInt(rng, xs.hi - xs.lo + 1),
      y: ys.lo + randInt(rng, ys.hi - ys.lo + 1)
    };
    const wall = wallCells(width, height, heading);
    const goal = pickFar(wall, wall, start, minDistance, rng);
    if (options.heading2 === undefined) {
      return { start, goal };
    }
    // The second door: another cell (never the first door's cell) on its own wall, as far from the start.
    const wall2 = wallCells(width, height, options.heading2).filter((cell) => !(cell.x === goal.x && cell.y === goal.y));
    return { start, goal, goal2: pickFar(wall2, wall2, start, minDistance, rng) };
  }

  const wall = wallCells(width, height, oppositeHeading(heading));
  const start = wall[randInt(rng, wall.length)];
  if (role === 'C') {
    // A branching room: the entry is the start; the exits sit like room A's doors, as far from the start, on their
    // own walls and never on a cell another door uses.
    const taken: Position[] = [start];
    const picked: Position[] = [];
    for (const side of options.exits ?? []) {
      const cells = wallCells(width, height, side).filter((cell) => !taken.some((t) => t.x === cell.x && t.y === cell.y));
      const exit = pickFar(cells, cells, start, minDistance, rng);
      taken.push(exit);
      picked.push(exit);
    }
    return { start, goal: picked[0] ?? { ...start }, ...(picked[1] ? { goal2: picked[1] } : {}) };
  }
  if (options.withDown === false) {
    return { start, goal: { ...start } };
  }
  const xs = interiorRange(width);
  const ys = interiorRange(height);
  const corners: Position[] = [
    { x: xs.lo, y: ys.lo },
    { x: xs.hi, y: ys.lo },
    { x: xs.lo, y: ys.hi },
    { x: xs.hi, y: ys.hi }
  ];
  return { start, goal: pickFar(interiorCells(width, height), corners, start, minDistance, rng) };
};

const forbiddenCells = (stage: Pick<Stage, 'width' | 'height'>, anchors: Position[]): Set<number> => {
  const forbid = new Set<number>();
  const mark = (pos: Position): void => {
    forbid.add(indexOf(stage, pos));
    for (const n of neighbors8(stage, pos)) {
      forbid.add(indexOf(stage, n));
    }
  };

  anchors.forEach(mark);

  return forbid;
};

export const computeHints = (stage: Stage): void => {
  for (let y = 0; y < stage.height; y += 1) {
    for (let x = 0; x < stage.width; x += 1) {
      const pos = { x, y };
      const idx = indexOf(stage, pos);

      if (stage.cells[idx].hasBomb) {
        stage.cells[idx].hint = -1;
        continue;
      }

      let bombs = 0;
      for (const n of neighbors8(stage, pos)) {
        if (stage.cells[indexOf(stage, n)].hasBomb) {
          bombs += 1;
        }
      }
      stage.cells[idx].hint = bombs;
    }
  }
};

export const revealZeros = (stage: Stage, origin: Position): void => {
  const queue: Position[] = [origin];
  const seen = new Set<number>();
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const currentIdx = indexOf(stage, current);
    if (seen.has(currentIdx)) {
      continue;
    }
    seen.add(currentIdx);

    const cell = stage.cells[currentIdx];
    if (cell.hasBomb || cell.flagged) {
      continue;
    }
    cell.revealed = true;

    if (cell.hint !== 0) {
      continue;
    }

    for (const n of neighbors8(stage, current)) {
      const nCell = stage.cells[indexOf(stage, n)];
      if (!nCell.hasBomb && !nCell.flagged) {
        queue.push(n);
      }
    }
  }
};

export const createRandomStage = (
  params: StageParams,
  rng: Rng,
  role: RoomRole = 'A',
  heading: Heading = 'E',
  options: RoomOptions = {}
): Stage => {
  const { width, height, bombCount, stageNo, depthTarget } = params;
  const cells = createCells(width, height);
  const { start, goal, goal2 } = chooseRoomAnchors(width, height, role, heading, rng, STAIRS_MIN_DISTANCE_RATIO, options);
  const deadEnd = role === 'B' && options.withDown === false;
  const exits = options.exits ?? [];
  const doors: StageDoor[] = role === 'A'
    ? [{ cell: goal, side: heading }, ...(goal2 && options.heading2 ? [{ cell: goal2, side: options.heading2 }] : [])]
    : role === 'C'
      ? [
        { cell: start, side: oppositeHeading(heading) },
        ...[goal, goal2].flatMap((cell, i) => (cell && exits[i] ? [{ cell, side: exits[i] }] : []))
      ]
      : [{ cell: start, side: oppositeHeading(heading) }];
  const stage: Stage = {
    width,
    height,
    stageNo,
    cells,
    player: { ...start },
    start,
    goal,
    startKind: role === 'A' ? 'up' : 'door',
    goalKind: role === 'A' || role === 'C' ? 'door' : deadEnd ? 'none' : 'down',
    doorSide: role === 'A' ? heading : oppositeHeading(heading),
    doors,
    generation: {
      retries: 0,
      depthTarget,
      solverDepth: 0,
      generationMs: 0
    }
  };

  const forbidden = forbiddenCells(stage, goal2 ? [start, goal, goal2] : [start, goal]);
  const candidateIndices: number[] = [];
  for (let i = 0; i < cells.length; i += 1) {
    if (!forbidden.has(i)) {
      candidateIndices.push(i);
    }
  }

  const bombs = Math.min(bombCount, candidateIndices.length);
  for (let i = 0; i < bombs; i += 1) {
    const picked = i + randInt(rng, candidateIndices.length - i);
    const tmp = candidateIndices[i];
    candidateIndices[i] = candidateIndices[picked];
    candidateIndices[picked] = tmp;
    stage.cells[candidateIndices[i]].hasBomb = true;
  }

  computeHints(stage);
  stage.cells[indexOf(stage, start)].revealed = true;
  revealZeros(stage, start);

  return stage;
};

export const cloneStage = (stage: Stage): Stage => {
  return {
    ...stage,
    player: { ...stage.player },
    start: { ...stage.start },
    goal: { ...stage.goal },
    ...(stage.doors ? { doors: stage.doors.map((door) => ({ cell: { ...door.cell }, side: door.side })) } : {}),
    generation: { ...stage.generation },
    cells: stage.cells.map((cell) => ({ ...cell }))
  };
};
