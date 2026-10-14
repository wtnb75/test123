// The bot of the Title demo (docs/spec/title-demo.md "ボットの手順"): pure, deterministic, no randomness or clock.
import { cloneStage, indexOf, inBounds, neighbors8 } from './board';
import { movePlayer, toggleFlag } from './rules';
import { analyzeCurrentState } from './solver';
import type { Position, Stage } from './types';

export type DemoAction =
  | { kind: 'flag'; pos: Position }
  | { kind: 'move'; pos: Position };

export type DemoStatus = 'alive' | 'goal' | 'dead' | 'invalid';

export type DemoStep = {
  stage: Stage;
  status: DemoStatus;
  /** Indices of the cells whose look changed. */
  changed: number[];
};

/** Plays one action with the game's own rules. `invalid` means the rules did nothing (the stage is unchanged). */
export const applyDemoAction = (stage: Stage, action: DemoAction): DemoStep => {
  if (action.kind === 'flag') {
    const next = toggleFlag(stage, action.pos);
    if (next === stage) {
      return { stage, status: 'invalid', changed: [] };
    }
    return { stage: next, status: 'alive', changed: [indexOf(stage, action.pos)] };
  }

  const out = movePlayer(stage, action.pos);
  if (out.result.status === 'dead') {
    return { stage: out.stage, status: 'dead', changed: out.changedCellIndices ?? [] };
  }
  // A room's door cell is the goal by position: standing on it counts, whatever the rules reported.
  const { player, goal } = out.stage;
  const atGoal = out.result.status === 'goal' || (player.x === goal.x && player.y === goal.y);
  return { stage: out.stage, status: atGoal ? 'goal' : 'alive', changed: out.changedCellIndices ?? [] };
};

// Breadth-first order of neighbours: (+1, 0), (+1, +1), (0, +1), (-1, +1), (-1, 0), (-1, -1), (0, -1), (+1, -1).
const STEPS: ReadonlyArray<Position> = [
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
  { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }
];

type Reach = { dist: Map<number, number>; parent: Map<number, number> };

const reachFrom = (stage: Stage, walkable: (idx: number) => boolean): Reach => {
  const start = indexOf(stage, stage.player);
  const dist = new Map<number, number>([[start, 0]]);
  const parent = new Map<number, number>();
  const queue: number[] = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const idx = queue[head];
    const x = idx % stage.width;
    const y = Math.floor(idx / stage.width);
    for (const step of STEPS) {
      const next = { x: x + step.x, y: y + step.y };
      if (!inBounds(stage, next)) {
        continue;
      }
      const nextIdx = indexOf(stage, next);
      if (dist.has(nextIdx) || !walkable(nextIdx)) {
        continue;
      }
      dist.set(nextIdx, (dist.get(idx) ?? 0) + 1);
      parent.set(nextIdx, idx);
      queue.push(nextIdx);
    }
  }
  return { dist, parent };
};

/** The cell to step on first on the way to `target` (`parent` leads back to the player), or null without a path. */
const firstStepTo = (stage: Stage, reach: Reach, target: number): Position | null => {
  const start = indexOf(stage, stage.player);
  let idx = target;
  while (reach.parent.get(idx) !== start) {
    const up = reach.parent.get(idx);
    if (up === undefined) {
      return null;
    }
    idx = up;
  }
  return { x: idx % stage.width, y: Math.floor(idx / stage.width) };
};

/**
 * The actions that take the player to the goal using only what is certain: flag certain bombs next to the
 * player, step on cells that are open or certainly safe. `null` when that cannot be done. The given stage is
 * not changed.
 */
export const planDemo = (stage: Stage): DemoAction[] | null => {
  let sim = cloneStage(stage);
  const actions: DemoAction[] = [];
  const limit = 4 * sim.width * sim.height;
  const goalIdx = indexOf(sim, sim.goal);

  while (actions.length <= limit) {
    const analysis = analyzeCurrentState(sim);

    // Flags do not feed the analysis, so it stays valid while flagging.
    const adjacent = neighbors8(sim, sim.player).map((pos) => ({ pos, idx: indexOf(sim, pos) }));
    adjacent.sort((a, b) => a.idx - b.idx);
    for (const { pos, idx } of adjacent) {
      if (analysis.knownBombs.has(idx) && !sim.cells[idx].flagged) {
        const action: DemoAction = { kind: 'flag', pos };
        actions.push(action);
        sim = applyDemoAction(sim, action).stage;
      }
    }

    const current = sim;
    const reach = reachFrom(current, (idx) => {
      const cell = current.cells[idx];
      if (cell.flagged) {
        return false;
      }
      return cell.revealed ? !cell.hasBomb : analysis.knownSafe.has(idx);
    });

    let target: number | null = reach.dist.has(goalIdx) ? goalIdx : null;
    if (target === null) {
      let bestDist = Infinity;
      for (const [idx, dist] of reach.dist) {
        const cell = current.cells[idx];
        if (dist === 0 || cell.revealed || !analysis.knownSafe.has(idx) || cell.flagged) {
          continue;
        }
        if (dist < bestDist || (dist === bestDist && idx < (target ?? Infinity))) {
          bestDist = dist;
          target = idx;
        }
      }
    }
    if (target === null) {
      return null;
    }

    const step = firstStepTo(current, reach, target);
    if (step === null) {
      return null;
    }
    const action: DemoAction = { kind: 'move', pos: step };
    actions.push(action);
    const out = applyDemoAction(sim, action);
    if (out.status === 'dead' || out.status === 'invalid') {
      return null;
    }
    sim = out.stage;
    if (out.status === 'goal') {
      return actions.length <= limit ? actions : null;
    }
  }

  return null;
};
