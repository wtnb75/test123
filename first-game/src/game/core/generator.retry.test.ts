import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateStage, stageParams } from './generator';
import { analyzeSolvability } from './solver';

vi.mock('./solver', () => ({ analyzeSolvability: vi.fn() }));

const countBombs = (stage: { cells: { hasBomb: boolean }[] }): number =>
  stage.cells.filter((cell) => cell.hasBomb).length;

describe('generateStage retry policy', () => {
  beforeEach(() => {
    vi.mocked(analyzeSolvability).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the first solvable stage that reaches the depth target', () => {
    vi.mocked(analyzeSolvability).mockReturnValue({ solvable: true, depth: 4, decidedBombs: 0 });

    const stage = generateStage(6, { seed: 7, maxRetries: 50 });

    expect(analyzeSolvability).toHaveBeenCalledTimes(1);
    expect(stage.generation).toMatchObject({ retries: 1, solverDepth: 4, depthTarget: 3 });
  });

  it('lowers the depth target every 250 retries and then removes one bomb per further 250 retries', () => {
    let depth = 0;
    vi.mocked(analyzeSolvability).mockImplementation(() => {
      depth += 1;
      // Strictly increasing depth makes the latest stage the "best" one, and it is never solvable.
      return { solvable: false, depth, decidedBombs: 0 };
    });

    const stage = generateStage(6, { seed: 7, maxRetries: 800, maxGenerationMs: 1_000_000 });

    // depthTarget: 3 -> 2 (retry 250) -> 1 (retry 500, first bomb removed) -> stays 1 (retry 750, second bomb removed)
    expect(stage.generation).toMatchObject({ retries: 800, depthTarget: 1, solverDepth: 800 });
    expect(countBombs(stage)).toBe(stageParams(6, 1).bombCount - 2);
  });

  it('keeps the best-scoring stage when no candidate is solvable', () => {
    vi.mocked(analyzeSolvability)
      .mockReturnValueOnce({ solvable: false, depth: 2, decidedBombs: 0 })
      .mockReturnValueOnce({ solvable: false, depth: 5, decidedBombs: 0 })
      .mockReturnValue({ solvable: false, depth: 3, decidedBombs: 0 });

    const stage = generateStage(1, { seed: 7, maxRetries: 10, maxGenerationMs: 1_000_000 });

    expect(analyzeSolvability).toHaveBeenCalledTimes(10);
    expect(stage.generation).toMatchObject({ retries: 2, solverDepth: 5 });
  });

  it('stops retrying once the generation time budget is spent', () => {
    let clock = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => {
      clock += 1;
      return clock;
    });
    vi.mocked(analyzeSolvability).mockReturnValue({ solvable: false, depth: 1, decidedBombs: 0 });

    const stage = generateStage(1, { seed: 7, maxRetries: 1000, maxGenerationMs: 5 });

    const attempts = vi.mocked(analyzeSolvability).mock.calls.length;
    expect(attempts).toBeGreaterThan(1);
    expect(attempts).toBeLessThan(10);
    expect(stage.generation.retries).toBe(1);
  });
});
