import { describe, expect, it } from 'vitest';
import type { Stage } from './types';
import { chordAtPlayer, movePlayer, toggleFlag } from './rules';
import { computeHints, indexOf } from './board';

const createStage = (): Stage => ({
  width: 3,
  height: 3,
  stageNo: 1,
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 2 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 9 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 }))
});

describe('rules', () => {
  it('ignores out of bounds move', () => {
    const stage = createStage();
    const out = movePlayer(stage, { x: -1, y: 0 });

    expect(out.result.status).toBe('alive');
    expect(out.result.message).toBe('out-of-bounds');
  });

  it('kills when stepping bomb without flag', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 1, y: 0 })].hasBomb = true;
    computeHints(stage);

    const out = movePlayer(stage, { x: 1, y: 0 });

    expect(out.result.status).toBe('dead');
  });

  it('survives when stepping bomb with flag', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 1, y: 0 })].hasBomb = true;
    computeHints(stage);
    const flagged = toggleFlag(stage, { x: 1, y: 0 });

    const out = movePlayer(flagged, { x: 1, y: 0 });

    expect(out.result.status).toBe('alive');
  });

  it('dies when stepping non-bomb with flag', () => {
    const stage = createStage();
    computeHints(stage);
    const flagged = toggleFlag(stage, { x: 1, y: 0 });

    const out = movePlayer(flagged, { x: 1, y: 0 });

    expect(out.result.status).toBe('dead');
  });

  it('supports chord opening when flags match hint', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 1, y: 0 })].hasBomb = true;
    computeHints(stage);

    stage.player = { x: 1, y: 1 };
    stage.cells[indexOf(stage, { x: 1, y: 1 })].revealed = true;

    const flagged = toggleFlag(stage, { x: 1, y: 0 });
    const out = chordAtPlayer(flagged);

    expect(out.result.status).toBe('alive');
    expect(out.result.message).toBe('auto-opened');
    expect(out.stage.player).toEqual(flagged.player);
  });

  it('reaches goal when moved to goal tile safely', () => {
    const stage = createStage();
    computeHints(stage);

    const out = movePlayer(stage, { x: 2, y: 2 });
    expect(out.result.status).toBe('goal');
  });

  it('returns chord-not-available when center is not revealed', () => {
    const stage = createStage();
    computeHints(stage);
    stage.player = { x: 1, y: 1 };

    const out = chordAtPlayer(stage);
    expect(out.result.message).toBe('chord-not-available');
  });

  it('returns flag-overflow when flagged neighbors exceed hint', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 2, y: 2 })].hasBomb = true;
    computeHints(stage);
    stage.player = { x: 1, y: 1 };
    stage.cells[indexOf(stage, { x: 1, y: 1 })].revealed = true;

    let cur = toggleFlag(stage, { x: 0, y: 1 });
    cur = toggleFlag(cur, { x: 1, y: 0 });

    const out = chordAtPlayer(cur);
    expect(out.result.message).toBe('flag-overflow');
  });

  it('auto-flags unresolved neighbors when bombs needed equals unresolved', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 1, y: 1 })].hasBomb = true;
    computeHints(stage);

    stage.player = { x: 0, y: 0 };
    stage.cells[indexOf(stage, { x: 0, y: 0 })].revealed = true;
    stage.cells[indexOf(stage, { x: 1, y: 0 })].revealed = true;
    stage.cells[indexOf(stage, { x: 0, y: 1 })].revealed = true;

    const out = chordAtPlayer(stage);
    expect(out.result.message).toBe('auto-flagged');
  });

  it('returns not-enough-info when chord cannot infer flags', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 2, y: 2 })].hasBomb = true;
    computeHints(stage);
    stage.player = { x: 1, y: 1 };
    stage.cells[indexOf(stage, { x: 1, y: 1 })].revealed = true;

    const out = chordAtPlayer(stage);
    expect(out.result.message).toBe('not-enough-info');
  });

  it('opens guaranteed safe neighbors when standing on a flagged tile', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 1, y: 1 })].hasBomb = true;
    computeHints(stage);

    let cur = toggleFlag(stage, { x: 1, y: 1 });
    cur.player = { x: 1, y: 1 };
    cur.goal = { x: 0, y: 0 };
    cur.cells[indexOf(cur, { x: 0, y: 0 })].revealed = true;

    const out = chordAtPlayer(cur);

    expect(out.result.status).toBe('alive');
    expect(out.result.message).toBe('auto-opened');
    expect(out.stage.player).toEqual(cur.player);
    expect(out.stage.cells[indexOf(out.stage, { x: 1, y: 0 })].revealed).toBe(true);
    expect(out.stage.cells[indexOf(out.stage, { x: 0, y: 1 })].revealed).toBe(true);
  });

  it('iteratively opens newly guaranteed safe neighbors around a flagged tile', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 1, y: 1 })].hasBomb = true;
    computeHints(stage);

    let cur = toggleFlag(stage, { x: 1, y: 1 });
    cur.player = { x: 1, y: 1 };
    cur.goal = { x: 0, y: 0 };
    cur.cells[indexOf(cur, { x: 0, y: 0 })].revealed = true;

    const out = chordAtPlayer(cur);

    expect(out.result.message).toBe('auto-opened');
    expect(out.stage.cells[indexOf(out.stage, { x: 2, y: 0 })].revealed).toBe(true);
    expect(out.stage.cells[indexOf(out.stage, { x: 0, y: 2 })].revealed).toBe(true);
    expect(out.stage.cells[indexOf(out.stage, { x: 2, y: 1 })].revealed).toBe(true);
    expect(out.stage.cells[indexOf(out.stage, { x: 1, y: 2 })].revealed).toBe(true);
    expect(out.stage.cells[indexOf(out.stage, { x: 2, y: 2 })].revealed).toBe(true);
  });
});
