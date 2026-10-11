import { describe, expect, it } from 'vitest';
import { cloneStage, computeHints, indexOf, neighbors8 } from './board';
import { applyDemoAction, planDemo, type DemoAction } from './demoBot';
import { generateStage } from './generator';
import { analyzeCurrentState, analyzeSolvability } from './solver';
import type { Position, Stage } from './types';

// Fixtures are worked by hand from docs/spec/title-demo.md ("テスト観点"). Positions are (x, y): x is the column,
// y the row (downwards); the cell index is y * width + x.

const makeStage = (
  width: number,
  height: number,
  bombs: Position[],
  revealed: Position[],
  player: Position,
  goal: Position
): Stage => {
  const stage: Stage = {
    width,
    height,
    stageNo: 1,
    player: { ...player },
    start: { ...player },
    goal: { ...goal },
    generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
    cells: Array.from({ length: width * height }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 }))
  };
  for (const b of bombs) {
    stage.cells[indexOf(stage, b)].hasBomb = true;
  }
  computeHints(stage);
  for (const r of revealed) {
    stage.cells[indexOf(stage, r)].revealed = true;
  }
  return stage;
};

const move = (x: number, y: number): DemoAction => ({ kind: 'move', pos: { x, y } });
const flag = (x: number, y: number): DemoAction => ({ kind: 'flag', pos: { x, y } });

describe('planDemo: hand-worked stages', () => {
  it('A: walks to the goal and flags the bomb that becomes adjacent on the way', () => {
    // 3x3, bomb (2,0); everything else is open.
    const open: Position[] = [];
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        if (!(x === 2 && y === 0)) {
          open.push({ x, y });
        }
      }
    }
    const stage = makeStage(3, 3, [{ x: 2, y: 0 }], open, { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(planDemo(stage)).toEqual([move(1, 1), flag(2, 0), move(2, 2)]);
  });

  it('B: returns null when the goal can never be decided (a 50 / 50 between (2,0) and (2,1))', () => {
    const stage = makeStage(
      3, 2, [{ x: 2, y: 0 }],
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
      { x: 0, y: 0 }, { x: 2, y: 1 }
    );
    expect(planDemo(stage)).toBeNull();
  });

  it('C: picks the nearest (then lowest index) certain-safe unopened cell, and flags once the bomb is known', () => {
    // 3x3, bomb (2,0); only (0,0) is open (hint 0, its zero chain not applied).
    const stage = makeStage(3, 3, [{ x: 2, y: 0 }], [{ x: 0, y: 0 }], { x: 0, y: 0 }, { x: 2, y: 2 });
    expect(planDemo(stage)).toEqual([move(1, 0), move(0, 1), move(1, 1), flag(2, 0), move(2, 2)]);
  });

  it('returns null for a stage whose player already stands on the goal (nothing left to walk)', () => {
    const stage = makeStage(3, 3, [{ x: 2, y: 0 }], [{ x: 2, y: 2 }], { x: 2, y: 2 }, { x: 2, y: 2 });
    expect(planDemo(stage)).toBeNull();
  });

  it('never steps on a flagged cell, even one that is certainly safe', () => {
    // C with a flag on (1,0): it is certain-safe but flagged, so the first step goes elsewhere.
    const stage = makeStage(3, 3, [{ x: 2, y: 0 }], [{ x: 0, y: 0 }], { x: 0, y: 0 }, { x: 2, y: 2 });
    stage.cells[indexOf(stage, { x: 1, y: 0 })].flagged = true;
    const plan = planDemo(stage);
    expect(plan?.[0]).toEqual(move(0, 1));
    expect(plan?.some((a) => a.kind === 'move' && a.pos.x === 1 && a.pos.y === 0)).toBe(false);
  });

  it('goes around a flagged cell instead of through it (a flag blocks the way)', () => {
    // 5x2, no bombs. Open: (0,0), (2,0), (0,1), (1,1), (2,1). (1,0) is certain-safe but flagged: the shortest way
    // east along the top row would cross it (and a flag on a safe cell kills), so the first step is the diagonal.
    const open = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }];
    const stage = makeStage(5, 2, [], open, { x: 0, y: 0 }, { x: 4, y: 0 });
    stage.cells[indexOf(stage, { x: 1, y: 0 })].flagged = true;
    const plan = planDemo(stage);
    expect(plan).not.toBeNull();
    expect(plan?.[0]).toEqual(move(1, 1));
  });

  it('does not pick the cell the player stands on as a target when that cell is still unopened', () => {
    // (0,1) is open with hint 0, so (0,0) under the player is certain-safe but not opened (not a state the game
    // produces; the bot must still walk on to another cell instead of looping on its own cell).
    const stage = makeStage(3, 3, [{ x: 2, y: 2 }], [{ x: 0, y: 1 }], { x: 0, y: 0 }, { x: 2, y: 0 });
    const plan = planDemo(stage);
    expect(plan?.[0]).toEqual(move(1, 0));
  });

  it('does not change the stage it is given', () => {
    const stage = makeStage(3, 3, [{ x: 2, y: 0 }], [{ x: 0, y: 0 }], { x: 0, y: 0 }, { x: 2, y: 2 });
    const before = JSON.stringify(stage);
    planDemo(stage);
    expect(JSON.stringify(stage)).toBe(before);
  });
});

describe('planDemo: generated stages (stage 1-3, seeds 1-200, only the ones proven solvable)', () => {
  type Case = { stage: Stage; plan: DemoAction[] | null };
  const cases: Case[] = [];
  for (let stageNo = 1; stageNo <= 3; stageNo += 1) {
    for (let seed = 1; seed <= 200; seed += 1) {
      const stage = generateStage(stageNo, { seed, maxGenerationMs: 60000 });
      if (analyzeSolvability(stage).solvable) {
        cases.push({ stage, plan: planDemo(stage) });
      }
    }
  }

  it('covers enough solvable stages (not a vacuous run)', () => {
    expect(cases.length).toBeGreaterThanOrEqual(150);
  });

  it('always finds a plan', () => {
    const failed = cases.filter((c) => c.plan === null).length;
    expect(failed).toBe(0);
  });

  it('plays to the goal without dying, only through safe cells, flagging only adjacent certain bombs', () => {
    for (const { stage, plan } of cases) {
      let sim = cloneStage(stage);
      let reachedGoal = false;
      const last = (plan ?? []).length - 1;
      for (const [position, action] of (plan ?? []).entries()) {
        const analysis = analyzeCurrentState(sim);
        const idx = indexOf(sim, action.pos);
        const adjacent = Math.max(Math.abs(action.pos.x - sim.player.x), Math.abs(action.pos.y - sim.player.y)) === 1;
        if (!adjacent) {
          expect.fail(`stage ${stage.stageNo}: not adjacent`);
        }
        if (action.kind === 'flag') {
          if (!analysis.knownBombs.has(idx) || !sim.cells[idx].hasBomb || sim.cells[idx].flagged) {
            expect.fail(`stage ${stage.stageNo}: flag on a cell that is not an unflagged certain bomb`);
          }
        } else {
          const cell = sim.cells[idx];
          const safe = !cell.flagged && !cell.hasBomb && (cell.revealed || analysis.knownSafe.has(idx));
          if (!safe) {
            expect.fail(`stage ${stage.stageNo}: moved onto a cell that is not certain to be safe`);
          }
        }
        const out = applyDemoAction(sim, action);
        if (out.status === 'dead' || out.status === 'invalid') {
          expect.fail(`stage ${stage.stageNo}: ${out.status}`);
        }
        sim = out.stage;
        reachedGoal = out.status === 'goal';
        if (reachedGoal && position !== last) {
          expect.fail(`stage ${stage.stageNo}: the goal was reached before the last action`);
        }
      }
      if (!reachedGoal) {
        expect.fail(`stage ${stage.stageNo}: the last action did not reach the goal`);
      }
    }
  });

  it('is deterministic and bounded', () => {
    for (const { stage, plan } of cases.slice(0, 60)) {
      expect(planDemo(stage)).toEqual(plan);
      expect((plan ?? []).length).toBeLessThanOrEqual(4 * stage.width * stage.height);
    }
  });

  it('leaves the generated stage untouched', () => {
    const { stage } = cases[0];
    const before = JSON.stringify(stage);
    planDemo(stage);
    expect(JSON.stringify(stage)).toBe(before);
  });

  it('flags every certain bomb next to the player before moving on (never leaves one adjacent unflagged)', () => {
    for (const { stage, plan } of cases.slice(0, 60)) {
      let sim = cloneStage(stage);
      for (const action of plan ?? []) {
        if (action.kind === 'move') {
          const analysis = analyzeCurrentState(sim);
          for (const n of neighbors8(sim, sim.player)) {
            const idx = indexOf(sim, n);
            if (analysis.knownBombs.has(idx) && !sim.cells[idx].flagged) {
              expect.fail(`stage ${stage.stageNo}: moved with an unflagged certain bomb adjacent`);
            }
          }
        }
        sim = applyDemoAction(sim, action).stage;
      }
    }
  });
});

describe('applyDemoAction', () => {
  const stage = makeStage(3, 3, [{ x: 2, y: 0 }], [{ x: 0, y: 0 }], { x: 0, y: 0 }, { x: 2, y: 2 });

  it('toggles a flag on an unopened adjacent cell', () => {
    const out = applyDemoAction(stage, flag(1, 0));
    expect(out.status).toBe('alive');
    expect(out.stage.cells[indexOf(stage, { x: 1, y: 0 })].flagged).toBe(true);
    expect(out.changed).toEqual([1]);
  });

  it('rejects a flag on an opened cell (the rules do nothing there)', () => {
    expect(applyDemoAction(stage, flag(0, 0)).status).toBe('invalid');
  });

  it('reports death when the move lands on an unflagged bomb', () => {
    const out = applyDemoAction(makeStage(3, 3, [{ x: 1, y: 0 }], [{ x: 0, y: 0 }], { x: 0, y: 0 }, { x: 2, y: 2 }), move(1, 0));
    expect(out.status).toBe('dead');
  });

  it('reports the goal when the move lands on it', () => {
    const near = makeStage(3, 3, [{ x: 0, y: 2 }], [{ x: 1, y: 1 }], { x: 1, y: 1 }, { x: 2, y: 2 });
    expect(applyDemoAction(near, move(2, 2)).status).toBe('goal');
  });

  it('moves onto a safe cell and opens it', () => {
    const out = applyDemoAction(stage, move(1, 0));
    expect(out.status).toBe('alive');
    expect(out.stage.player).toEqual({ x: 1, y: 0 });
    expect(out.stage.cells[1].revealed).toBe(true);
  });
});
