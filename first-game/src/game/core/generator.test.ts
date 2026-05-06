import { describe, expect, it } from 'vitest';
import { generateStage, stageParams } from './generator';
import { indexOf, neighbors8 } from './board';

describe('generator', () => {
  it('generates stage with expected dimensions and metadata', () => {
    const stage = generateStage(3, { seed: 42, maxRetries: 100, maxGenerationMs: 500 });

    expect(stage.width).toBe(10);
    expect(stage.height).toBe(10);
    expect(stage.generation.retries).toBeGreaterThan(0);
  });

  it('keeps start and goal neighborhood bomb-free', () => {
    const stage = generateStage(2, { seed: 99, maxRetries: 100, maxGenerationMs: 500 });
    const protectedCells = [...neighbors8(stage, stage.start), stage.start, ...neighbors8(stage, stage.goal), stage.goal];
    const protectedBomb = protectedCells.some((p) => stage.cells[indexOf(stage, p)].hasBomb);

    expect(protectedBomb).toBe(false);
  });

  it('falls back when no retries are allowed', () => {
    const stage = generateStage(5, { seed: 1, maxRetries: 0, maxGenerationMs: 1 });

    expect(stage.stageNo).toBe(5);
    expect(stage.generation.depthTarget).toBe(1);
  });

  it('does not reduce mine density as stage number increases', () => {
    const stages = [1, 10, 20, 30];
    const densities = stages.map((stageNo) => {
      const params = stageParams(stageNo, 1);
      return params.bombCount / (params.width * params.height);
    });

    for (let i = 1; i < densities.length; i += 1) {
      expect(densities[i]).toBeGreaterThanOrEqual(densities[i - 1]);
    }
  });

  it('keeps bomb count at or above linear baseline', () => {
    const stages = [1, 5, 10, 20, 30];

    for (const stageNo of stages) {
      const params = stageParams(stageNo, 1);
      const linearBaseline = Math.max(6, 4 + stageNo * 4);
      expect(params.bombCount).toBeGreaterThanOrEqual(linearBaseline);
    }
  });
});
