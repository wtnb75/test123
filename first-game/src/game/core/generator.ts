import { createRandomStage, type RoomRole } from './board';
import { corridorShape } from './corridor';
import { floorLayout, headingFromDraw, type FloorLayout } from './floorLayout';
import { createRng } from './random';
import { analyzeSolvability } from './solver';
import type { Heading, Stage, StageParams } from './types';

const BASE_BOMB_DENSITY = 0.14;
const DENSITY_INCREASE_PER_STAGE = 0.001;
const MAX_BOMB_DENSITY = 0.18;
/** The seed of a stage is the base seed plus the stage number times this; room B and the corridor add an offset. */
const STAGE_SEED_STRIDE = 9973;
const ROOM_B_SEED_OFFSET = 1;
const CORRIDOR_SEED_OFFSET = 2;
const HEADING_SEED_OFFSET = 3;

/** The floor's heading: one draw from the floor's own stream, so a room made alone (the Title demo) agrees with the floor. */
export const floorHeading = (seed: number, stageNo: number): Heading =>
  headingFromDraw(createRng(seed + stageNo * STAGE_SEED_STRIDE + HEADING_SEED_OFFSET)());

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
  /** Which room of the floor to make (default `A`: the up-stairs and door A). */
  role?: RoomRole;
  /** The floor's heading (default: the one the seed gives for this stage). */
  heading?: Heading;
  seed?: number;
  maxRetries?: number;
  maxGenerationMs?: number;
};

export const generateStage = (stageNo: number, options?: GenerateOptions): Stage => {
  const startedAt = Date.now();
  const maxRetries = options?.maxRetries ?? 1000;
  const maxGenerationMs = options?.maxGenerationMs ?? 1500;
  const baseSeed = options?.seed ?? Date.now();
  const role = options?.role ?? 'A';
  const heading = options?.heading ?? floorHeading(baseSeed, stageNo);
  const rng = createRng(baseSeed + stageNo * STAGE_SEED_STRIDE);

  let depthTarget = Math.min(5, Math.floor(1 + stageNo / 3));
  let bombPenalty = 0;
  let retries = 0;

  let bestStage: Stage | null = null;
  let bestDepth = -1;

  while (retries < maxRetries) {
    retries += 1;

    const params = stageParams(stageNo, depthTarget);
    params.bombCount = Math.max(1, params.bombCount - bombPenalty);

    const stage = createRandomStage(params, rng, role, heading);
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

  const fallback = createRandomStage(stageParams(Math.max(1, stageNo - 1), 1), rng, role, heading);
  fallback.stageNo = stageNo;
  fallback.generation.retries = retries;
  fallback.generation.depthTarget = 1;
  fallback.generation.generationMs = Date.now() - startedAt;
  fallback.generation.solverDepth = 1;

  return fallback;
};

/** One floor: two rooms (A: up-stairs and door; B: door and down-stairs) and the corridor between them. */
export type Floor = {
  stageNo: number;
  rooms: [Stage, Stage];
  /** Where the rooms and the corridor sit on the floor's grid. */
  layout: FloorLayout;
};

/**
 * Room A, room B (its seed comes from room A's), then the corridor's shape (docs/spec/rooms-and-floors.md).
 * Each room has its own retry and time budget.
 */
export const generateFloor = (stageNo: number, options?: Omit<GenerateOptions, 'role'>): Floor => {
  const seed = options?.seed ?? Date.now();
  const heading = floorHeading(seed, stageNo);
  const roomA = generateStage(stageNo, { ...options, seed, role: 'A', heading });
  const roomB = generateStage(stageNo, { ...options, seed: seed + ROOM_B_SEED_OFFSET, role: 'B', heading });
  const shape = corridorShape(createRng(seed + stageNo * STAGE_SEED_STRIDE + CORRIDOR_SEED_OFFSET));
  const layout = floorLayout(heading, roomA.width, roomA.height, roomA.goal, roomB.start, shape);
  return { stageNo, rooms: [roomA, roomB], layout };
};
