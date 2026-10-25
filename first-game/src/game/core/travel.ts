// Tap travel (docs/spec.md "タッチ操作" → "タップで歩く"): the route to a tapped opened cell. No Phaser.

import { inBounds, indexOf } from './board';
import type { Position, Stage } from './types';

const NEIGHBOURS: Position[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 }
];

const samePos = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;
const near = (a: Position, b: Position): boolean => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1;

/** Whether `pos` is the down-stairs of this room (the stairs are only ever a target or a stop, never walked through). */
const isDownStairs = (stage: Stage, pos: Position): boolean =>
  (stage.goalKind === undefined || stage.goalKind === 'down') && samePos(stage.goal, pos);

/**
 * How good a step is among the steps that keep to a shortest route (lower is better; docs/spec.md "タップで歩く"):
 * a step that moves past the target on an axis is last; then the same direction as the previous step; then a
 * diagonal step; then a straight one.
 */
const stepScore = (cell: Position, step: Position, last: Position | null, target: Position): number => {
  const remainX = target.x - cell.x;
  const remainY = target.y - cell.y;
  const overshoots =
    (step.x !== 0 && Math.sign(step.x) !== Math.sign(remainX)) || (step.y !== 0 && Math.sign(step.y) !== Math.sign(remainY));
  if (overshoots) {
    return 100;
  }
  if (last !== null && last.x === step.x && last.y === step.y) {
    return 0;
  }
  return step.x !== 0 && step.y !== 0 ? 1 : 2;
};

/**
 * The cells a tap walk steps through, in order, to reach the opened cell `target`: one of the shortest routes over
 * opened cells (8 directions), the one with the fewest turns (each step is chosen by `stepScore`). The player's cell
 * is not counted. Unopened cells and walls are never on the route, and the down-stairs only when it is the target.
 * A down-stairs target ends the route at the first cell next to the stairs. Null when `target` is not opened, is the
 * player's cell, or cannot be reached over opened cells.
 */
export const travelRoute = (stage: Stage, target: Position): Position[] | null => {
  if (!inBounds(stage, target) || samePos(target, stage.player) || !stage.cells[indexOf(stage, target)].revealed) {
    return null;
  }
  // The player stands on an opened cell, so that cell is walkable even where a fixture leaves it unopened.
  const walkable = (pos: Position): boolean =>
    inBounds(stage, pos) &&
    (samePos(pos, stage.player) || stage.cells[indexOf(stage, pos)].revealed) &&
    (!isDownStairs(stage, pos) || samePos(pos, target));

  // Steps from every reachable cell to the target, over walkable cells.
  const distance = new Map<number, number>([[indexOf(stage, target), 0]]);
  const queue: Position[] = [target];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    const here = distance.get(indexOf(stage, cell)) as number;
    for (const step of NEIGHBOURS) {
      const next = { x: cell.x + step.x, y: cell.y + step.y };
      if (!walkable(next) || distance.has(indexOf(stage, next))) {
        continue;
      }
      distance.set(indexOf(stage, next), here + 1);
      queue.push(next);
    }
  }
  if (!distance.has(indexOf(stage, stage.player))) {
    return null;
  }

  // From the player, each step goes one closer to the target; among those, the best by stepScore.
  const route: Position[] = [];
  let cell = stage.player;
  let last: Position | null = null;
  while (!samePos(cell, target)) {
    const here = distance.get(indexOf(stage, cell)) as number;
    let best: Position | null = null;
    let bestStep: Position | null = null;
    let bestScore = Infinity;
    for (const step of NEIGHBOURS) {
      const next = { x: cell.x + step.x, y: cell.y + step.y };
      if (!inBounds(stage, next) || distance.get(indexOf(stage, next)) !== here - 1) {
        continue;
      }
      const score = stepScore(cell, step, last, target);
      if (score < bestScore) {
        best = next;
        bestStep = step;
        bestScore = score;
      }
    }
    if (best === null || bestStep === null) {
      return null;
    }
    route.push(best);
    last = bestStep;
    cell = best;
  }

  if (isDownStairs(stage, target)) {
    const stop = route.findIndex((step) => near(step, stage.goal));
    return stop < 0 ? route : route.slice(0, stop + 1);
  }
  return route;
};
