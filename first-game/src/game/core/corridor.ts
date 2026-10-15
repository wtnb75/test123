import type { Position } from './types';
import type { Rng } from './random';

/** The corridor between the two rooms (docs/spec/rooms-and-floors.md): its length in cells, the time per cell, the turn chance. */
export const CORRIDOR_LENGTH = 6;
export const CORRIDOR_STEP_MS = 120;
export const CORRIDOR_TURN_CHANCE = 0.5;
/** A turn out of a forward step goes left when the second draw is below this, right otherwise. */
export const CORRIDOR_LEFT_BELOW = 0.5;
/** One frame never advances the walk by more than this (a page that was hidden does not skip the walk). */
export const CORRIDOR_MAX_FRAME_MS = 100;
/** The "#" of a corridor cell: size, colour, outline (docs/spec/rooms-and-floors.md "パラメータ表"). */
export const CORRIDOR_GLYPH = { size: 16, color: '#a4b0be', stroke: 3 } as const;

type Step = 'F' | 'L' | 'R';

/** A step in corridor coordinates: `x` is how far forward, `y` how far to the right (left is negative). */
const STEP: Record<Step, Position> = {
  F: { x: 1, y: 0 },
  L: { x: 0, y: -1 },
  R: { x: 0, y: 1 }
};

/** True when `cell` is on, or next to (up / down / left / right), one of `cells`. */
const touches = (cell: Position, cells: readonly Position[]): boolean =>
  cells.some((other) => Math.abs(other.x - cell.x) + Math.abs(other.y - cell.y) <= 1);

/**
 * The cells of a corridor in corridor coordinates (`x` forward, `y` to the right), first to last; the first cell
 * is (0, 0). Step 1 is forward. From step 2 on, one draw `d`: `d < turnChance` turns (forward -> a second draw
 * `< leftBelow` picks left, else right; left or right -> forward), otherwise the step is kept. A step that would
 * land on, or next to, a cell other than the one it comes from goes forward instead (forward always fits).
 */
export const corridorShape = (
  rng: Rng,
  length: number = CORRIDOR_LENGTH,
  turnChance: number = CORRIDOR_TURN_CHANCE,
  leftBelow: number = CORRIDOR_LEFT_BELOW
): Position[] => {
  const cells: Position[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  let previous: Step = 'F';

  while (cells.length < length) {
    let next: Step = previous;
    if (rng() < turnChance) {
      if (previous === 'F') {
        next = rng() < leftBelow ? 'L' : 'R';
      } else {
        next = 'F';
      }
    }
    const last = cells[cells.length - 1];
    let step = STEP[next];
    let cell = { x: last.x + step.x, y: last.y + step.y };
    if (touches(cell, cells.slice(0, -1))) {
      next = 'F';
      step = STEP.F;
      cell = { x: last.x + step.x, y: last.y + step.y };
    }
    cells.push(cell);
    previous = next;
  }

  return cells.slice(0, length);
};

/** The cell of the walk at `index`: from the first cell when `forward` (room A to room B), from the last on the way back. */
export const corridorCellAt = <T>(cells: readonly T[], index: number, forward: boolean): T =>
  cells[forward ? index : cells.length - 1 - index];

/** Where the walk is after `elapsedMs`: the index of the cell the player stands on, and whether it is over. */
export const corridorState = (
  elapsedMs: number,
  length: number = CORRIDOR_LENGTH,
  stepMs: number = CORRIDOR_STEP_MS
): { index: number; done: boolean } => {
  const elapsed = Math.max(0, elapsedMs);
  return {
    index: Math.min(length - 1, Math.floor(elapsed / stepMs)),
    done: elapsed >= length * stepMs
  };
};

/**
 * Where the camera glides to between two cells of a walk over `length` cells: the cell it has reached (`index`, at
 * most `length - 2`, so `index + 1` is a cell) and how far towards the next one (`fraction`, 0 to 1).
 */
export const corridorReach = (
  elapsedMs: number,
  length: number = CORRIDOR_LENGTH,
  stepMs: number = CORRIDOR_STEP_MS
): { index: number; fraction: number } => {
  const reached = Math.min(length - 1, Math.max(0, elapsedMs) / stepMs);
  const index = Math.min(length - 2, Math.floor(reached));
  return { index, fraction: reached - index };
};

/** The walk's clock after one frame of `deltaMs`: at most `CORRIDOR_MAX_FRAME_MS` is added, never a negative time. */
export const advanceCorridor = (elapsedMs: number, deltaMs: number): number =>
  elapsedMs + Math.min(Math.max(0, deltaMs), CORRIDOR_MAX_FRAME_MS);
