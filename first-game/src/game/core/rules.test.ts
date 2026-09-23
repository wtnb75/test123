import { describe, expect, it } from 'vitest';
import type { Stage } from './types';
import {
  changedCellIndicesFrom,
  chordAtPlayer,
  finalizeRuleOutput,
  moveByDelta,
  movePlayer,
  toggleFlag
} from './rules';
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

    const cur = toggleFlag(stage, { x: 1, y: 1 });
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

    const cur = toggleFlag(stage, { x: 1, y: 1 });
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

  it('does not clear stage when goal is revealed by chord without movement', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 1, y: 1 })].hasBomb = true;
    computeHints(stage);

    const cur = toggleFlag(stage, { x: 1, y: 1 });
    cur.player = { x: 1, y: 1 };
    cur.goal = { x: 2, y: 2 };
    cur.cells[indexOf(cur, { x: 0, y: 0 })].revealed = true;

    const out = chordAtPlayer(cur);

    expect(out.stage.cells[indexOf(out.stage, { x: 2, y: 2 })].revealed).toBe(true);
    expect(out.result.status).toBe('alive');
    expect(out.stage.player).toEqual(cur.player);
  });

  it('sorts changed cell indices in ascending order', () => {
    expect(changedCellIndicesFrom(new Set([5, 1, 3]))).toEqual([1, 3, 5]);
    expect(changedCellIndicesFrom(new Set())).toEqual([]);
  });

  it('keeps the original stage when a rule changed no cells', () => {
    const original = createStage();
    const next = createStage();

    const out = finalizeRuleOutput(original, next, { status: 'alive' }, new Set());

    expect(out.stage).toBe(original);
    expect(out.changedCellIndices).toEqual([]);
  });

  it('returns the next stage with sorted indices when a rule changed cells', () => {
    const original = createStage();
    const next = createStage();

    const out = finalizeRuleOutput(original, next, { status: 'goal' }, new Set([4, 2]));

    expect(out.stage).toBe(next);
    expect(out.result).toEqual({ status: 'goal' });
    expect(out.changedCellIndices).toEqual([2, 4]);
  });

  describe('toggleFlag', () => {
    it('returns the same stage for an out-of-bounds position', () => {
      const stage = createStage();

      expect(toggleFlag(stage, { x: 3, y: 0 })).toBe(stage);
      expect(toggleFlag(stage, { x: 0, y: -1 })).toBe(stage);
    });

    it('cannot flag a revealed cell', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 1, y: 1 })].revealed = true;

      expect(toggleFlag(stage, { x: 1, y: 1 })).toBe(stage);
    });

    it('flags and unflags a hidden cell without mutating the previous stage', () => {
      const stage = createStage();

      const flagged = toggleFlag(stage, { x: 1, y: 1 });
      const unflagged = toggleFlag(flagged, { x: 1, y: 1 });

      expect(stage.cells[indexOf(stage, { x: 1, y: 1 })].flagged).toBe(false);
      expect(flagged.cells[indexOf(flagged, { x: 1, y: 1 })].flagged).toBe(true);
      expect(unflagged.cells[indexOf(unflagged, { x: 1, y: 1 })].flagged).toBe(false);
    });
  });

  describe('movePlayer reveal behavior', () => {
    it('reveals a hinted safe tile and reports it as the only changed cell', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 2, y: 0 })].hasBomb = true;
      computeHints(stage);

      const out = movePlayer(stage, { x: 1, y: 0 });

      expect(out.result).toEqual({ status: 'alive' });
      expect(out.changedCellIndices).toEqual([1]);
      expect(out.stage.player).toEqual({ x: 1, y: 0 });
      expect(out.stage.cells[1].revealed).toBe(true);
      expect(stage.cells[1].revealed).toBe(false);
    });

    it('cascades through zero-hint tiles but leaves bombs and flagged tiles hidden', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 2, y: 2 })].hasBomb = true;
      computeHints(stage);
      const flagged = toggleFlag(stage, { x: 2, y: 0 });

      const out = movePlayer(flagged, { x: 0, y: 0 });

      const hidden = out.stage.cells
        .map((cell, index) => (cell.revealed ? -1 : index))
        .filter((index) => index >= 0);
      expect(hidden).toEqual([indexOf(stage, { x: 2, y: 0 }), indexOf(stage, { x: 2, y: 2 })]);
      expect([...(out.changedCellIndices ?? [])].sort((a, b) => a - b)).toEqual([0, 1, 3, 4, 5, 6, 7]);
      expect(out.result).toEqual({ status: 'alive' });
      expect(flagged.cells.some((cell) => cell.revealed)).toBe(false);
    });

    it('reports goal when the first reveal of a hinted tile is the goal', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 2, y: 1 })].hasBomb = true;
      computeHints(stage);
      stage.goal = { x: 1, y: 0 };

      const out = movePlayer(stage, { x: 1, y: 0 });

      expect(out.result.status).toBe('goal');
      expect(out.changedCellIndices).toEqual([1]);
    });

    it('does not report changes when stepping onto an already revealed tile', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 1, y: 0 })].revealed = true;

      const out = movePlayer(stage, { x: 1, y: 0 });

      expect(out.result).toEqual({ status: 'alive' });
      expect(out.changedCellIndices).toBeUndefined();
      expect(out.stage.cells).toBe(stage.cells);
    });

    it('reaches the goal when stepping onto an already revealed goal tile', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 2, y: 2 })].revealed = true;

      const out = movePlayer(stage, { x: 2, y: 2 });

      expect(out.result).toEqual({ status: 'goal' });
      expect(out.changedCellIndices).toBeUndefined();
    });

    it('moves relative to the current player position via moveByDelta', () => {
      const stage = createStage();
      computeHints(stage);
      stage.player = { x: 1, y: 1 };

      const out = moveByDelta(stage, 1, 0);

      expect(out.stage.player).toEqual({ x: 2, y: 1 });
      expect(moveByDelta(stage, -2, 0).result.message).toBe('out-of-bounds');
    });
  });

  describe('chordAtPlayer edge cases', () => {
    it('returns chord-not-available when the revealed center has no bomb neighbors', () => {
      const stage = createStage();
      computeHints(stage);
      stage.player = { x: 1, y: 1 };
      stage.cells[indexOf(stage, { x: 1, y: 1 })].revealed = true;

      const out = chordAtPlayer(stage);

      expect(out.result.message).toBe('chord-not-available');
      expect(out.stage).toBe(stage);
    });

    it('dies when the flags match the hint but one of them is wrong and a bomb stays unflagged', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 0, y: 0 })].hasBomb = true;
      computeHints(stage);
      stage.player = { x: 1, y: 1 };
      stage.cells[indexOf(stage, { x: 1, y: 1 })].revealed = true;
      const flagged = toggleFlag(stage, { x: 2, y: 2 });

      const out = chordAtPlayer(flagged);

      expect(out.result).toEqual({ status: 'dead', message: 'bomb-without-flag' });
      expect(out.stage).not.toBe(flagged);
      expect(flagged.cells.filter((cell) => cell.revealed)).toHaveLength(1);
    });

    it('reports not-enough-info without changing the stage when standing on a flag with no revealed clues', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 1, y: 1 })].hasBomb = true;
      computeHints(stage);
      const flagged = toggleFlag(stage, { x: 1, y: 1 });
      flagged.player = { x: 1, y: 1 };

      const out = chordAtPlayer(flagged);

      expect(out.result).toEqual({ status: 'alive', message: 'not-enough-info' });
      expect(out.stage).toBe(flagged);
      expect(out.changedCellIndices).toBeUndefined();
    });

    it('does not open anything from a clue whose neighboring flags are fewer than its hint', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 0, y: 1 })].hasBomb = true;
      stage.cells[indexOf(stage, { x: 1, y: 1 })].hasBomb = true;
      computeHints(stage);
      stage.cells[indexOf(stage, { x: 0, y: 0 })].revealed = true;
      const flagged = toggleFlag(stage, { x: 1, y: 1 });
      flagged.player = { x: 1, y: 1 };

      const out = chordAtPlayer(flagged);

      expect(out.result.message).toBe('not-enough-info');
      expect(out.stage.cells[indexOf(out.stage, { x: 1, y: 0 })].revealed).toBe(false);
    });

    it('dies when auto-opening around a flag reaches an unflagged bomb next to a wrongly flagged clue', () => {
      const stage = createStage();
      stage.cells[indexOf(stage, { x: 0, y: 0 })].hasBomb = true;
      stage.cells[indexOf(stage, { x: 0, y: 1 })].hasBomb = true;
      computeHints(stage);
      stage.cells[indexOf(stage, { x: 1, y: 0 })].revealed = true;
      let flagged = toggleFlag(stage, { x: 0, y: 0 });
      flagged = toggleFlag(flagged, { x: 2, y: 1 });
      flagged.player = { x: 0, y: 0 };

      const out = chordAtPlayer(flagged);

      expect(out.result).toEqual({ status: 'dead', message: 'bomb-without-flag' });
    });
  });
});
