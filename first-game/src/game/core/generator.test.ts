import { describe, expect, it } from 'vitest';
import { generateStage } from './generator';
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
});
