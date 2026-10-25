// The run (Shift + a move key; docs/spec.md "走る"): where a run may step. No Phaser.

import { inBounds, indexOf } from './board';
import { HEADING_VECTOR } from './floorLayout';
import { roomDoors } from './walls';
import type { Position, Stage } from './types';

/** Time between two steps of a run, in ms (docs/spec.md パラメータ表 `RunStepMs`). */
export const RUN_STEP_MS = 100;

/**
 * Why a run may not step onto a cell: outside the board (`edge`), a door cell (`door`), the down-stairs (`goal`),
 * a cell not opened yet (`closed`).
 */
export type RunBlock = 'edge' | 'door' | 'goal' | 'closed';

const samePos = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

/** The reason a run stops before `pos`, or null when it may step there (an opened cell that is not a door or the stairs). */
export const runBlockAt = (stage: Stage, pos: Position): RunBlock | null => {
  if (!inBounds(stage, pos)) {
    return 'edge';
  }
  if (roomDoors(stage).some((door) => samePos(door.cell, pos))) {
    return 'door';
  }
  if ((stage.goalKind === undefined || stage.goalKind === 'down') && samePos(stage.goal, pos)) {
    return 'goal';
  }
  return stage.cells[indexOf(stage, pos)].revealed ? null : 'closed';
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
 * How many cells a run in `dir` from the player's cell takes: the opened cells before the first one it may not
 * enter. Opened cells do not change during a run, so the count is known at the start.
 */
export const runSteps = (stage: Stage, dir: Position): number => {
  let steps = 0;
  let pos = stage.player;
  while (runBlockAt(stage, { x: pos.x + dir.x, y: pos.y + dir.y }) === null) {
    pos = { x: pos.x + dir.x, y: pos.y + dir.y };
    steps += 1;
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
