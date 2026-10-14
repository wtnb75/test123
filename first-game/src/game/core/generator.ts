import { createRandomStage, type RoomOptions, type RoomRole } from './board';
import { corridorShape } from './corridor';
import { floorFitsApart, floorMap, headingPairFromDraw, oppositeHeading, type FloorMap } from './floorLayout';
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
const ROOM_C_SEED_OFFSET = 4;
/** How many times the corridors are drawn again when the floor does not fit apart (docs/spec/rooms-and-floors.md). */
export const LAYOUT_RETRIES = 8;

/**
 * The headings of door A1 and door A2 (two different ones) and whether the down-stairs are in room B, from the floor's
 * own stream: `k = floor(r * 12)` picks the pair (A1: the `floor(k / 3)`-th heading, A2: the `k mod 3`-th of the
 * others), the next draw picks the room. A room made alone (the Title demo) agrees with the floor.
 */
export const floorHeadings = (seed: number, stageNo: number): { headings: [Heading, Heading]; downInB: boolean } => {
  const rng = createRng(seed + stageNo * STAGE_SEED_STRIDE + HEADING_SEED_OFFSET);
  return { headings: headingPairFromDraw(rng()), downInB: rng() < 0.5 };
};

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
  /** Which kind of room to make (default `A`: the up-stairs and the doors A). */
  role?: RoomRole;
  /** The wall of door A1 (room A) or the wall the room's door is opposite to (default: the seed's first heading). */
  heading?: Heading;
  /** Room A's second door's wall (default: the seed's second heading). */
  heading2?: Heading;
  /** `false`: a dead-end room B (no down-stairs). Default `true`. */
  withDown?: boolean;
  /** How many times the corridors are drawn again when the floor does not fit apart (default `LAYOUT_RETRIES`). */
  layoutRetries?: number;
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
  const floor = floorHeadings(baseSeed, stageNo);
  const heading = options?.heading ?? floor.headings[0];
  const roomOptions: RoomOptions = role === 'A'
    ? { heading2: options?.heading2 ?? floor.headings[1] }
    : { withDown: options?.withDown ?? true };
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

    const stage = createRandomStage(params, rng, role, heading, roomOptions);
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

  const fallback = createRandomStage(stageParams(Math.max(1, stageNo - 1), 1), rng, role, heading, roomOptions);
  fallback.stageNo = stageNo;
  fallback.generation.retries = retries;
  fallback.generation.depthTarget = 1;
  fallback.generation.generationMs = Date.now() - startedAt;
  fallback.generation.solverDepth = 1;

  return fallback;
};

/** One floor: three rooms (A: up-stairs and two doors; B and C: a door each, one of them with the down-stairs). */
export type Floor = {
  stageNo: number;
  rooms: [Stage, Stage, Stage];
  /** The room that holds the down-stairs: 1 (room B) or 2 (room C). */
  downRoom: 1 | 2;
  /** Where the rooms and the corridors sit on the floor's grid. */
  layout: FloorMap;
};

type RoomSet = { roomA: Stage; roomB: Stage; roomC: Stage };

/**
 * Room A, room B, room C (their seeds come from room A's), then the corridors' shapes; when the floor does not fit
 * apart the shapes are drawn again, and past `LAYOUT_RETRIES` rooms A and C are made again with door A2 in the wall
 * opposite door A1 (docs/spec/rooms-and-floors.md). Each room has its own retry and time budget.
 */
export const generateFloor = (stageNo: number, options?: Omit<GenerateOptions, 'role'>): Floor => {
  const seed = options?.seed ?? Date.now();
  const { headings, downInB } = floorHeadings(seed, stageNo);
  const layoutRetries = options?.layoutRetries ?? LAYOUT_RETRIES;
  const make = (offset: number, role: RoomRole, heading: Heading, extra: Partial<GenerateOptions>): Stage =>
    generateStage(stageNo, { ...options, seed: seed + offset, role, heading, ...extra });

  const build = (second: Heading, roomB?: Stage): RoomSet => ({
    roomA: make(0, 'A', headings[0], { heading2: second }),
    roomB: roomB ?? make(ROOM_B_SEED_OFFSET, 'B', headings[0], { withDown: downInB }),
    roomC: make(ROOM_C_SEED_OFFSET, 'B', second, { withDown: !downInB })
  });
  const corridorRng = createRng(seed + stageNo * STAGE_SEED_STRIDE + CORRIDOR_SEED_OFFSET);
  const mapOf = ({ roomA, roomB, roomC }: RoomSet, second: Heading): FloorMap =>
    floorMap(
      [headings[0], second],
      roomA.width,
      roomA.height,
      [roomA.doors![0].cell, roomA.doors![1].cell],
      [roomB.start, roomC.start],
      [corridorShape(corridorRng), corridorShape(corridorRng)]
    );
  const fits = (set: RoomSet, layout: FloorMap): boolean => floorFitsApart(layout, set.roomA.width, set.roomA.height);

  let second = headings[1];
  let set = build(second);
  let layout = mapOf(set, second);
  for (let attempt = 0; attempt < layoutRetries && !fits(set, layout); attempt += 1) {
    layout = mapOf(set, second);
  }
  if (!fits(set, layout) && second !== oppositeHeading(headings[0])) {
    second = oppositeHeading(headings[0]);
    set = build(second, set.roomB);
    layout = mapOf(set, second);
  }
  return { stageNo, rooms: [set.roomA, set.roomB, set.roomC], downRoom: downInB ? 1 : 2, layout };
};
