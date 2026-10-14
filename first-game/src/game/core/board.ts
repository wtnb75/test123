import type { Cell, Heading, Position, Stage, StageParams } from './types';
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

/** The two rooms of a floor: A holds the up-stairs and door A, B holds door B and the down-stairs. */
export type RoomRole = 'A' | 'B';

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
 * Where a room's start and goal go (docs/spec/rooms-and-floors.md "ルール"). `heading` is the floor's heading.
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
  ratio = STAIRS_MIN_DISTANCE_RATIO
): { start: Position; goal: Position } => {
  const minDistance = stairsMinDistance(width, height, ratio);

  if (role === 'A') {
    const xs = interiorRange(width);
    const ys = interiorRange(height);
    const start: Position = {
      x: xs.lo + randInt(rng, xs.hi - xs.lo + 1),
      y: ys.lo + randInt(rng, ys.hi - ys.lo + 1)
    };
    const wall = wallCells(width, height, heading);
    return { start, goal: pickFar(wall, wall, start, minDistance, rng) };
  }

  const wall = wallCells(width, height, oppositeHeading(heading));
  const start = wall[randInt(rng, wall.length)];
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

const forbiddenCells = (stage: Pick<Stage, 'width' | 'height'>, start: Position, goal: Position): Set<number> => {
  const forbid = new Set<number>();
  const mark = (pos: Position): void => {
    forbid.add(indexOf(stage, pos));
    for (const n of neighbors8(stage, pos)) {
      forbid.add(indexOf(stage, n));
    }
  };

  mark(start);
  mark(goal);

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
  heading: Heading = 'E'
): Stage => {
  const { width, height, bombCount, stageNo, depthTarget } = params;
  const cells = createCells(width, height);
  const { start, goal } = chooseRoomAnchors(width, height, role, heading, rng);
  const stage: Stage = {
    width,
    height,
    stageNo,
    cells,
    player: { ...start },
    start,
    goal,
    startKind: role === 'A' ? 'up' : 'door',
    goalKind: role === 'A' ? 'door' : 'down',
    doorSide: role === 'A' ? heading : oppositeHeading(heading),
    generation: {
      retries: 0,
      depthTarget,
      solverDepth: 0,
      generationMs: 0
    }
  };

  const forbidden = forbiddenCells(stage, start, goal);
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
    generation: { ...stage.generation },
    cells: stage.cells.map((cell) => ({ ...cell }))
  };
};
