import { createRandomStage } from './board';
import { createRng } from './random';
import { analyzeSolvability } from './solver';
import type { Stage, StageParams } from './types';

const BASE_BOMB_DENSITY = 0.14;
const DENSITY_INCREASE_PER_STAGE = 0.001;
const MAX_BOMB_DENSITY = 0.18;

export const stageParams = (stageNo: number, depthTarget: number): StageParams => {
  const width = 7 + stageNo;
  const height = 7 + stageNo;
  const area = width * height;
  const density = Math.min(MAX_BOMB_DENSITY, BASE_BOMB_DENSITY + stageNo * DENSITY_INCREASE_PER_STAGE);
  const linearBombs = 4 + stageNo * 4;
  const densityBombs = Math.round(area * density);
  const bombCount = Math.max(6, Math.max(linearBombs, densityBombs));

  return {
    width,
    height,
    bombCount,
    stageNo,
    depthTarget
  };
};

export type GenerateOptions = {
  seed?: number;
  maxRetries?: number;
  maxGenerationMs?: number;
};

export const generateStage = (stageNo: number, options?: GenerateOptions): Stage => {
  const startedAt = Date.now();
  const maxRetries = options?.maxRetries ?? 1000;
  const maxGenerationMs = options?.maxGenerationMs ?? 1500;
  const baseSeed = options?.seed ?? Date.now();
  const rng = createRng(baseSeed + stageNo * 9973);

  let depthTarget = Math.min(5, Math.floor(1 + stageNo / 3));
  let bombPenalty = 0;
  let retries = 0;

  let bestStage: Stage | null = null;
  let bestDepth = -1;

  while (retries < maxRetries) {
    retries += 1;

    const params = stageParams(stageNo, depthTarget);
    params.bombCount = Math.max(1, params.bombCount - bombPenalty);

    const stage = createRandomStage(params, rng);
    const analysis = analyzeSolvability(stage);

    if (analysis.depth > bestDepth) {
      bestDepth = analysis.depth;
      bestStage = stage;
      bestStage.generation.solverDepth = analysis.depth;
      bestStage.generation.depthTarget = depthTarget;
      bestStage.generation.retries = retries;
      bestStage.generation.generationMs = Date.now() - startedAt;
    }

    if (analysis.solvable && analysis.depth >= depthTarget) {
      stage.generation.solverDepth = analysis.depth;
      stage.generation.depthTarget = depthTarget;
      stage.generation.retries = retries;
      stage.generation.generationMs = Date.now() - startedAt;
      return stage;
    }

    if (retries % 250 === 0) {
      depthTarget = Math.max(1, depthTarget - 1);
      if (depthTarget === 1) {
        bombPenalty += 1;
      }
    }

    if (Date.now() - startedAt >= maxGenerationMs) {
      break;
    }
  }

  if (bestStage) {
    return bestStage;
  }

  const fallback = createRandomStage(stageParams(Math.max(1, stageNo - 1), 1), rng);
  fallback.stageNo = stageNo;
  fallback.generation.retries = retries;
  fallback.generation.depthTarget = 1;
  fallback.generation.generationMs = Date.now() - startedAt;
  fallback.generation.solverDepth = 1;

  return fallback;
};
