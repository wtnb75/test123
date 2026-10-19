import { HEADINGS, headingPairFromDraw, oppositeHeading } from './floorLayout';
import type { Rng } from './random';
import type { Heading } from './types';

/** How many rooms a floor has (docs/spec/rooms-and-floors.md "パラメータ表"). Room A and its two children B and C, then more. */
export const ROOM_COUNT = 5;
/** A room other than A has at most this many exits (children). */
const MAX_CHILDREN = 2;
/** A room this many tree steps (or more) away from room A is a deep room: bigger and harder (docs/spec/rooms-and-floors.md "部屋の難しさ"). */
export const DEEP_ROOM_MIN_LEVEL = 2;

/** The level of each room: its distance from room A counted in tree edges (A = 0, B and C = 1); loops are not counted. */
export const roomLevels = (parent: number[]): number[] => {
  const levels: number[] = [];
  for (const p of parent) {
    levels.push(p < 0 ? 0 : levels[p] + 1);
  }
  return levels;
};

/** The rooms of a floor as a tree: room 0 (A) has two exits; every other room has an entry and 0-2 exits. */
export type FloorTree = {
  roomCount: number;
  /** `parent[k]` is the room whose exit leads to room `k` (`-1` for room A). Always smaller than `k`. */
  parent: number[];
  /** The children of each room, in index order: the `i`-th child is reached through the room's `i`-th exit. */
  children: number[][];
  /** The leaf (room without exits) that holds the down-stairs; the other leaves are dead ends. */
  downRoom: number;
  /** The wall of each exit of each room, in child order. Room A's are door A1 and door A2. */
  exitHeadings: Heading[][];
};

/** The wall room `room` is entered through: the one opposite the exit of its parent. `undefined` for room A. */
export const entryHeadingOf = (tree: Pick<FloorTree, 'parent' | 'children' | 'exitHeadings'>, room: number): Heading | undefined => {
  const parent = tree.parent[room];
  if (parent < 0) {
    return undefined;
  }
  const exit = tree.children[parent].indexOf(room);
  return oppositeHeading(tree.exitHeadings[parent][exit]);
};

/**
 * Picks the exits' walls of a room whose entry is on `entry`: one child -> one of the three other walls (right,
 * down, left, up order) by `floor(r * 3)`; two -> `k = floor(r * 6)`, the first is the `floor(k / 2)`-th of the three,
 * the second the `k mod 2`-th of the remaining two.
 */
export const exitWalls = (entry: Heading, count: number, r: number): Heading[] => {
  const free = HEADINGS.filter((heading) => heading !== entry);
  if (count === 1) {
    return [free[Math.min(free.length - 1, Math.floor(r * free.length))]];
  }
  const k = Math.min(5, Math.floor(r * 6));
  const first = free[Math.floor(k / 2)];
  const rest = free.filter((heading) => heading !== first);
  return [first, rest[k % 2]];
};

/**
 * The tree of a floor, from the floor's stream `rng` (docs/spec/rooms-and-floors.md "フロアの生成"): the pair of room
 * A's walls from the first draw `r0`; room `k` = 3.. gets its parent (one draw each, among rooms 1..k-1 that have
 * fewer than two children, smallest first); one draw picks the leaf with the down-stairs; then every room other than
 * A that has children gets its exits' walls (one draw each, in room order).
 */
export const buildFloorTree = (rng: Rng, roomCount: number = ROOM_COUNT): FloorTree => {
  const [h1, h2] = headingPairFromDraw(rng());
  const parent: number[] = [-1, 0, 0].slice(0, roomCount);
  const children: number[][] = Array.from({ length: roomCount }, () => []);
  for (let k = 1; k < Math.min(3, roomCount); k += 1) {
    children[0].push(k);
  }
  for (let k = 3; k < roomCount; k += 1) {
    const candidates: number[] = [];
    for (let room = 1; room < k; room += 1) {
      if (children[room].length < MAX_CHILDREN) {
        candidates.push(room);
      }
    }
    const picked = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
    parent.push(picked);
    children[picked].push(k);
  }

  const leaves: number[] = [];
  for (let room = 1; room < roomCount; room += 1) {
    if (children[room].length === 0) {
      leaves.push(room);
    }
  }
  const downRoom = leaves[Math.min(leaves.length - 1, Math.floor(rng() * leaves.length))];

  const exitHeadings: Heading[][] = Array.from({ length: roomCount }, () => []);
  exitHeadings[0] = [h1, h2];
  const tree: FloorTree = { roomCount, parent, children, downRoom, exitHeadings };
  for (let room = 1; room < roomCount; room += 1) {
    if (children[room].length > 0) {
      const entry = entryHeadingOf(tree, room) as Heading;
      exitHeadings[room] = exitWalls(entry, children[room].length, rng());
    }
  }
  return tree;
};
