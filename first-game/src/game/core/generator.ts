import { createRandomStage, type RoomOptions, type RoomRole } from './board';
import { corridorShape } from './corridor';
import type { FloorGraph } from './floorGraph';
import { HEADINGS, headingPairFromDraw, layoutTree, oppositeHeading, type FloorMap } from './floorLayout';
import { ROOM_COUNT, buildFloorTree, entryHeadingOf, type FloorTree } from './floorTree';
import { createRng } from './random';
import { analyzeSolvability } from './solver';
import type { Heading, Stage, StageParams } from './types';
import { roomDoors } from './walls';

const BASE_BOMB_DENSITY = 0.14;
const DENSITY_INCREASE_PER_STAGE = 0.001;
const MAX_BOMB_DENSITY = 0.18;
/** The seed of a stage is the base seed plus the stage number times this; room B and the corridor add an offset. */
const STAGE_SEED_STRIDE = 9973;
const CORRIDOR_SEED_OFFSET = 2;
const HEADING_SEED_OFFSET = 3;
/** How many times a corridor's shape is drawn again when the floor does not fit apart (docs/spec/rooms-and-floors.md). */
export const LAYOUT_RETRIES = 8;
/** The most straight cells a corridor may be lengthened by, and how many times a parent and child may be made again. */
export const MAX_CORRIDOR_EXTENSION = 20;
export const LAYOUT_REBUILDS = 3;
/** A floor that cannot be placed is drawn again from `seed + n * stride`, at most this many times. */
const FLOOR_REROLL_LIMIT = 100;
const FLOOR_REROLL_STRIDE = 7919;

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
  /** `false`: a dead-end room (no down-stairs). Default `true`. */
  withDown?: boolean;
  /** The walls of a branching room's exits (role `C`), in child order. */
  exits?: Heading[];
  /** How many times a corridor's shape is drawn again when it does not fit apart (default `LAYOUT_RETRIES`). */
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
    : { withDown: options?.withDown ?? true, ...(options?.exits ? { exits: options.exits } : {}) };
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

/** One floor: a tree of rooms (A: up-stairs and two exits; the others: an entry and 0-2 exits; one leaf holds ▼). */
export type Floor = {
  stageNo: number;
  rooms: Stage[];
  /** The leaf room that holds the down-stairs. */
  downRoom: number;
  /** Where the rooms and the corridors sit on the floor's grid. */
  layout: FloorMap;
  /** Which doors the corridors join and which room the player starts in. */
  graph: FloorGraph;
  /** The tree the rooms were made from (parents, children, exit walls). */
  tree: FloorTree;
  /** How many straight cells each corridor was lengthened by (0 = the plain shape). */
  extensions: number[];
  /** How many times a parent and child were made again, and how many times the whole floor was drawn again. */
  rebuilds: number;
  rerolls: number;
};

export type FloorOptions = Omit<GenerateOptions, 'role' | 'heading' | 'heading2' | 'withDown' | 'exits'> & {
  /** How many times a parent and child may be made again when a corridor cannot be placed (default `LAYOUT_REBUILDS`). */
  layoutRebuilds?: number;
  /** Number of rooms (default `ROOM_COUNT`). */
  roomCount?: number;
  /** The most straight cells a corridor may be lengthened by (default `MAX_CORRIDOR_EXTENSION`). */
  maxExtension?: number;
  /** How many times a floor that cannot be placed is drawn again before the relaxed tries (default 100). */
  rerollLimit?: number;
};

/** Seed offset of room `k`: room A has none; rooms B, C, D ... take 1, 4, 7 ... (clear of the corridor and heading offsets). */
const roomSeedOffset = (room: number): number => (room === 0 ? 0 : 3 * room - 2);

type FloorTry = Floor | null;

/**
 * One try of a floor from `seed` (docs/spec/rooms-and-floors.md "フロアの生成"): the tree, the rooms in index order
 * (each from its own seed), the corridors laid out in order; a corridor that cannot be placed makes its parent and
 * child again with the exit on another wall (at most `LayoutRebuilds` times). `null`: the floor has to be drawn again.
 */
const tryFloor = (stageNo: number, seed: number, options: FloorOptions | undefined): FloorTry => {
  const roomCount = options?.roomCount ?? ROOM_COUNT;
  const maxExtension = options?.maxExtension ?? MAX_CORRIDOR_EXTENSION;
  const layoutRetries = options?.layoutRetries ?? LAYOUT_RETRIES;
  const tree = buildFloorTree(createRng(seed + stageNo * STAGE_SEED_STRIDE + HEADING_SEED_OFFSET), roomCount);
  const childOrder = (room: number): number => tree.children[tree.parent[room]].indexOf(room);

  const make = (room: number): Stage => {
    const extra: Partial<GenerateOptions> = {};
    let role: RoomRole;
    let heading: Heading;
    if (room === 0) {
      role = 'A';
      heading = tree.exitHeadings[0][0];
      extra.heading2 = tree.exitHeadings[0][1];
    } else {
      heading = tree.exitHeadings[tree.parent[room]][childOrder(room)];
      if (tree.children[room].length === 0) {
        role = 'B';
        extra.withDown = room === tree.downRoom;
      } else {
        role = 'C';
        extra.exits = tree.exitHeadings[room];
      }
    }
    return generateStage(stageNo, { ...options, seed: seed + roomSeedOffset(room), role, heading, ...extra });
  };

  const rooms: Stage[] = Array.from({ length: roomCount }, (_, room) => make(room));
  const corridors = Array.from({ length: roomCount - 1 }, (_, j) => {
    const child = j + 1;
    const parent = tree.parent[child];
    const exit = childOrder(child);
    return { from: { room: parent, door: parent === 0 ? exit : 1 + exit }, to: { room: child, door: 0 } };
  });
  const graph: FloorGraph = { startRoom: 0, corridors };
  const corridorRng = createRng(seed + stageNo * STAGE_SEED_STRIDE + CORRIDOR_SEED_OFFSET);
  const layoutRebuilds = options?.layoutRebuilds ?? LAYOUT_REBUILDS;
  // Step 6: every corridor's base shape, in corridor order, once (a rebuild keeps them; redraws continue the stream).
  const baseShapes = corridors.map(() => corridorShape(corridorRng));

  for (let rebuilds = 0; ; rebuilds += 1) {
    const placed = rooms.map((room) => ({ width: room.width, height: room.height, doors: roomDoors(room) }));
    const result = layoutTree(placed, graph, baseShapes, () => corridorShape(corridorRng), maxExtension, layoutRetries);
    if (result.ok) {
      const layout: FloorMap = {
        headings: [tree.exitHeadings[0][0], tree.exitHeadings[0][1]],
        ...result.placement
      };
      return {
        stageNo,
        rooms,
        downRoom: tree.downRoom,
        layout,
        graph,
        tree,
        extensions: result.extensions,
        rebuilds,
        rerolls: 0
      };
    }
    if (rebuilds >= layoutRebuilds) {
      return null;
    }
    // The exit of the failed child's parent goes to the next wall that is free (right, down, left, up order).
    const child = result.failedCorridor + 1;
    const parent = tree.parent[child];
    const exit = childOrder(child);
    const entry = entryHeadingOf(tree, parent);
    const used = new Set<Heading>(tree.exitHeadings[parent].filter((_, i) => i !== exit));
    if (entry) {
      used.add(entry);
    }
    const own = new Set(tree.exitHeadings[child]);
    const current = HEADINGS.indexOf(tree.exitHeadings[parent][exit]);
    let next: Heading | undefined;
    for (let step = 1; step < HEADINGS.length && !next; step += 1) {
      const candidate = HEADINGS[(current + step) % HEADINGS.length];
      const opposite = oppositeHeading(candidate);
      if (!used.has(candidate) && !own.has(opposite)) {
        next = candidate;
      }
    }
    if (!next) {
      return null;
    }
    tree.exitHeadings[parent][exit] = next;
    rooms[parent] = make(parent);
    rooms[child] = make(child);
  }
};

/**
 * The rooms of a floor and how they sit (docs/spec/rooms-and-floors.md). A floor that cannot be placed even after
 * rebuilding is drawn again from a derived seed.
 */
export const generateFloor = (stageNo: number, options?: FloorOptions): Floor => {
  const baseSeed = options?.seed ?? Date.now();
  const limit = options?.rerollLimit ?? FLOOR_REROLL_LIMIT;
  for (let reroll = 0; reroll < limit; reroll += 1) {
    const floor = tryFloor(stageNo, baseSeed + reroll * FLOOR_REROLL_STRIDE, options);
    if (floor) {
      return { ...floor, rerolls: reroll };
    }
  }
  // Practically unreachable: keep drawing from further seeds with no practical cap on how far a corridor may be
  // lengthened and more rebuilds; only the end of that (never seen) is an error.
  const relaxed = { ...options, maxExtension: 400, layoutRebuilds: 100 };
  for (let reroll = limit; reroll < limit + FLOOR_REROLL_LIMIT; reroll += 1) {
    const floor = tryFloor(stageNo, baseSeed + reroll * FLOOR_REROLL_STRIDE, relaxed);
    if (floor) {
      return { ...floor, rerolls: reroll };
    }
  }
  throw new Error('The floor could not be placed.');
};
