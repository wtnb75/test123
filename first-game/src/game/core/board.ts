import type { Cell, Position, Stage, StageParams } from './types';
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

export const stairsMinDistance = (width: number, height: number): number =>
  Math.max(1, Math.ceil((Math.min(width, height) - 3) * STAIRS_MIN_DISTANCE_RATIO));

/** The interior range of one axis: `STAIRS_MARGIN` from each edge (smaller only on boards too small for it). */
const interiorRange = (size: number): { lo: number; hi: number } => {
  const lo = Math.min(STAIRS_MARGIN, Math.floor((size - 1) / 2));
  return { lo, hi: size - 1 - lo };
};

const chebyshev = (a: Position, b: Position): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Start: uniform over the interior. Goal: uniform over the interior cells at least `stairsMinDistance` from the
 * start; when there are none, the interior corner farthest from the start (ties: top, then left).
 */
export const chooseStartGoal = (
  width: number,
  height: number,
  rng: Rng
): { start: Position; goal: Position } => {
  const xs = interiorRange(width);
  const ys = interiorRange(height);
  const start: Position = {
    x: xs.lo + randInt(rng, xs.hi - xs.lo + 1),
    y: ys.lo + randInt(rng, ys.hi - ys.lo + 1)
  };
  const minDistance = stairsMinDistance(width, height);

  const candidates: Position[] = [];
  for (let y = ys.lo; y <= ys.hi; y += 1) {
    for (let x = xs.lo; x <= xs.hi; x += 1) {
      if (chebyshev({ x, y }, start) >= minDistance) {
        candidates.push({ x, y });
      }
    }
  }
  if (candidates.length > 0) {
    return { start, goal: candidates[randInt(rng, candidates.length)] };
  }

  const corners: Position[] = [
    { x: xs.lo, y: ys.lo },
    { x: xs.hi, y: ys.lo },
    { x: xs.lo, y: ys.hi },
    { x: xs.hi, y: ys.hi }
  ];
  let goal = corners[0];
  for (const corner of corners) {
    if (chebyshev(corner, start) > chebyshev(goal, start)) {
      goal = corner;
    }
  }
  return { start, goal };
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

export const createRandomStage = (params: StageParams, rng: Rng): Stage => {
  const { width, height, bombCount, stageNo, depthTarget } = params;
  const cells = createCells(width, height);
  const { start, goal } = chooseStartGoal(width, height, rng);
  const stage: Stage = {
    width,
    height,
    stageNo,
    cells,
    player: { ...start },
    start,
    goal,
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
