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
 * The cells a tap walk steps through, in order, to reach the opened cell `target` by the shortest route over opened
 * cells (8 directions), not counting the player's cell. Unopened cells and walls are never on the route, and the
 * down-stairs only when it is the target. A down-stairs target ends the route at the first cell next to the stairs.
 * Null when `target` is not opened, is the player's cell, or cannot be reached over opened cells.
 */
export const travelRoute = (stage: Stage, target: Position): Position[] | null => {
  if (!inBounds(stage, target) || samePos(target, stage.player) || !stage.cells[indexOf(stage, target)].revealed) {
    return null;
  }
  const walkable = (pos: Position): boolean =>
    inBounds(stage, pos) &&
    stage.cells[indexOf(stage, pos)].revealed &&
    (!isDownStairs(stage, pos) || samePos(pos, target));

  const previous = new Map<number, Position>();
  const start = indexOf(stage, stage.player);
  const goal = indexOf(stage, target);
  previous.set(start, stage.player);
  const queue: Position[] = [stage.player];
  for (let head = 0; head < queue.length && !previous.has(goal); head += 1) {
    const cell = queue[head];
    for (const step of NEIGHBOURS) {
      const next = { x: cell.x + step.x, y: cell.y + step.y };
      const key = inBounds(stage, next) ? indexOf(stage, next) : -1;
      if (key < 0 || previous.has(key) || !walkable(next)) {
        continue;
      }
      previous.set(key, cell);
      queue.push(next);
    }
  }
  if (!previous.has(goal)) {
    return null;
  }

  const route: Position[] = [];
  for (let cell = target; !samePos(cell, stage.player); cell = previous.get(indexOf(stage, cell)) as Position) {
    route.unshift(cell);
  }
  if (isDownStairs(stage, target)) {
    const stop = route.findIndex((cell) => near(cell, stage.goal));
    return stop < 0 ? route : route.slice(0, stop + 1);
  }
  return route;
};
