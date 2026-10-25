// The run (Shift + a move key; docs/spec.md "走る"): where a run may step. No Phaser.

import { inBounds, indexOf } from './board';
import { HEADING_VECTOR } from './floorLayout';
import { roomDoors } from './walls';
import type { Position, Stage } from './types';

/** Time between two steps of a run, in ms (docs/spec.md パラメータ表 `RunStepMs`). */
export const RUN_STEP_MS = 100;

/**
 * Why a run may not step onto a cell: outside the board (`edge`), the down-stairs (`goal`), a cell not opened yet
 * (`closed`). A door cell is never a block: it is bomb-free, so a run may step onto it (and stops there).
 */
export type RunBlock = 'edge' | 'goal' | 'closed';

const samePos = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

/** The reason a run stops before `pos`, or null when it may step there. */
export const runBlockAt = (stage: Stage, pos: Position): RunBlock | null => {
  if (!inBounds(stage, pos)) {
    return 'edge';
  }
  if ((stage.goalKind === undefined || stage.goalKind === 'down') && samePos(stage.goal, pos)) {
    return 'goal';
  }
  return stage.cells[indexOf(stage, pos)].revealed || roomDoors(stage).some((door) => samePos(door.cell, pos))
    ? null
    : 'closed';
};

/**
 * Whether a run stops on a cell it has just stepped onto: a door cell, or a cell next to the start (▲) or the
 * down-stairs (▼; only where the room has them), diagonals included.
 */
export const runStopAt = (stage: Stage, pos: Position): boolean => {
  const near = (target: Position): boolean => Math.max(Math.abs(pos.x - target.x), Math.abs(pos.y - target.y)) <= 1;
  if (roomDoors(stage).some((door) => samePos(door.cell, pos))) {
    return true;
  }
  // A door entrance is a door (above), not the up-stairs: only the floor's start stairs stop a run next to them.
  if ((stage.startKind === undefined || stage.startKind === 'up') && near(stage.start)) {
    return true;
  }
  return (stage.goalKind === undefined || stage.goalKind === 'down') && near(stage.goal);
};

/**
 * Whether a step from the player's door cell to `pos` leaves the room through that door: an ordinary one-cell
 * move (the corridor starts), never a run.
 */
export const isDoorExit = (stage: Stage, pos: Position): boolean =>
  roomDoors(stage).some((door) => {
    const way = HEADING_VECTOR[door.side];
    return samePos(door.cell, stage.player) && samePos({ x: door.cell.x + way.x, y: door.cell.y + way.y }, pos);
  });

/**
 * How many cells a run in `dir` from the player's cell takes: it steps onto cells until the next one is blocked, or
 * until it has stepped onto a cell where it stops (`runStopAt`). The cells do not change during a run, so the count
 * is known at the start.
 */
export const runSteps = (stage: Stage, dir: Position): number => {
  let steps = 0;
  let pos = stage.player;
  while (runBlockAt(stage, { x: pos.x + dir.x, y: pos.y + dir.y }) === null) {
    pos = { x: pos.x + dir.x, y: pos.y + dir.y };
    steps += 1;
    if (runStopAt(stage, pos)) {
      break;
    }
  }
  return steps;
};

/**
 * What the press after `f` does (docs/spec.md "フラグ操作の詳細"): a move key sets the flag of that neighbour, the same
 * key with Shift runs, and any other press (Esc, a non-move key, a tap) cancels the wait without changing a flag.
 */
export type FlagWaitAction = { kind: 'toggle' | 'run'; dir: Position } | { kind: 'cancel' };

export const flagWaitAction = (direction: Position | null, shift: boolean): FlagWaitAction => {
  if (direction === null) {
    return { kind: 'cancel' };
  }
  return { kind: shift ? 'run' : 'toggle', dir: direction };
};
