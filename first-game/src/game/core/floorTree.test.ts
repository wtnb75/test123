import { describe, expect, it } from 'vitest';
import { chooseRoomAnchors } from './board';
import { FloorState } from './floor';
import { corridorFrom, type FloorGraph } from './floorGraph';
import { exitMarkers, extendShape, layoutTree, placeFloor, placementFitsApart, type PlacedRoom } from './floorLayout';
import { DEEP_ROOM_MIN_LEVEL, buildFloorTree, entryHeadingOf, exitWalls, roomLevels } from './floorTree';
import { generateFloor } from './generator';
import type { Position, Stage } from './types';

/** A random source that returns the given values in order (then 0.5). */
const scripted = (values: number[]) => {
  let i = 0;
  return (): number => values[i++] ?? 0.5;
};

describe('exitWalls (docs/spec/rooms-and-floors.md "フロアの生成" 手順 4)', () => {
  it('one exit: the floor(r * 3)-th of the three walls other than the entry (right, down, left, up order)', () => {
    expect(exitWalls('W', 1, 0)).toEqual(['E']);
    expect(exitWalls('W', 1, 0.5)).toEqual(['S']);
    expect(exitWalls('W', 1, 0.99)).toEqual(['N']);
  });

  it('two exits: k = floor(r * 6); the first is the floor(k / 2)-th, the second the k mod 2-th of the remaining two', () => {
    expect(exitWalls('N', 2, 0)).toEqual(['E', 'S']);
    expect(exitWalls('N', 2, 0.5)).toEqual(['S', 'W']);
    expect(exitWalls('N', 2, 0.99)).toEqual(['W', 'S']);
  });

  it('never uses the entry wall, and gives all six ordered pairs over the draws', () => {
    const pairs = new Set<string>();
    for (let k = 0; k < 6; k += 1) {
      const [a, b] = exitWalls('E', 2, (k + 0.5) / 6);
      expect(a).not.toBe('E');
      expect(b).not.toBe('E');
      expect(a).not.toBe(b);
      pairs.add(`${a}${b}`);
    }
    expect(pairs.size).toBe(6);
  });
});

describe('buildFloorTree', () => {
  it('attaches room D to B (draw 0.49) or C (0.5); room E to a room with fewer than two children', () => {
    // draws: pair, D's parent, E's parent, down-stairs leaf, then exit walls of rooms with children.
    const underB = buildFloorTree(scripted([0, 0.49, 0.7, 0.5, 0.5, 0.5]), 5);
    expect(underB.parent).toEqual([-1, 0, 0, 1, 3]);
    expect(underB.children).toEqual([[1, 2], [3], [], [4], []]);

    const underC = buildFloorTree(scripted([0, 0.5, 0.0, 0.5]), 5);
    expect(underC.parent).toEqual([-1, 0, 0, 2, 1]);
  });

  it('keeps at most two children per room: a full room is no longer a candidate', () => {
    // D -> B (0.0 picks the first candidate, B), E -> B (B still has one child), F: candidates are C, D, E.
    const tree = buildFloorTree(scripted([0, 0, 0, 0, 0, 0.5, 0.5]), 6);
    expect(tree.children[1]).toEqual([3, 4]);
    // F's candidates are C (2), D (3), E (4); the draw 0 picks the first.
    expect(tree.parent[5]).toBe(2);
    // The draw 0.99 picks the last candidate.
    expect(buildFloorTree(scripted([0, 0, 0, 0.99, 0.5, 0.5]), 6).parent[5]).toBe(4);
  });

  it('puts the down-stairs in the floor(r * leaves)-th leaf in index order', () => {
    // A -> {B -> {D -> E}, C}: leaves are C (2) and E (4).
    const first = buildFloorTree(scripted([0, 0.49, 0.7, 0.49, 0.5, 0.5]), 5);
    const second = buildFloorTree(scripted([0, 0.49, 0.7, 0.5, 0.5, 0.5]), 5);
    expect(first.downRoom).toBe(2);
    expect(second.downRoom).toBe(4);
  });

  it('gives room A the first draw\'s pair, and every exit wall differs from its room\'s entry wall', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      let s = seed * 7919;
      const rng = (): number => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
      const tree = buildFloorTree(rng, 6);
      expect(tree.exitHeadings[0]).toHaveLength(2);
      for (let room = 1; room < 6; room += 1) {
        const entry = entryHeadingOf(tree, room);
        expect(entry).toBeDefined();
        expect(tree.exitHeadings[room]).toHaveLength(tree.children[room].length);
        expect(tree.exitHeadings[room]).not.toContain(entry);
      }
    }
  });

  it('gives room A the three-room shape when RoomCount is 3 (no more draws needed)', () => {
    const tree = buildFloorTree(scripted([0]), 3);
    expect(tree.parent).toEqual([-1, 0, 0]);
    expect([1, 2]).toContain(tree.downRoom);
    expect(entryHeadingOf(tree, 0)).toBeUndefined();
  });
});

describe('extendShape and layoutTree', () => {
  const straight: Position[] = Array.from({ length: 6 }, (_, f) => ({ x: f, y: 0 }));
  const room = (doors: PlacedRoom['doors']): PlacedRoom => ({ width: 8, height: 8, doors });

  it('adds extension straight cells in front and moves the shape forward by that many', () => {
    expect(extendShape(straight, 3).map((c) => c.x)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const bent: Position[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2 }];
    expect(extendShape(bent, 2)).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 },
      { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 5, y: 2 }
    ]);
    expect(extendShape(straight, 0)).toEqual(straight);
  });

  // The spec's lengthening example: B at (14, 1); C's entry (0, 0) under door A2 (3, 7) -> C at (3, 14); C's exit
  // (7, 0) heading E; D's entry (0, 7). Straight 6 puts D on B; D clears B from a lengthening of 6 (length 12).
  const rooms = [
    room([{ cell: { x: 7, y: 2 }, side: 'E' }, { cell: { x: 3, y: 7 }, side: 'S' }]),
    room([{ cell: { x: 0, y: 1 }, side: 'W' }]),
    room([{ cell: { x: 0, y: 0 }, side: 'N' }, { cell: { x: 7, y: 0 }, side: 'E' }]),
    room([{ cell: { x: 0, y: 7 }, side: 'W' }])
  ];
  const graph: FloorGraph = {
    startRoom: 0,
    corridors: [
      { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
      { from: { room: 0, door: 1 }, to: { room: 2, door: 0 } },
      { from: { room: 2, door: 1 }, to: { room: 3, door: 0 } }
    ]
  };

  it('lengthens only the corridor that does not fit, by the smallest amount that does (6 -> length 12)', () => {
    const result = layoutTree(rooms, graph, [straight, straight, straight], () => straight, 20, 8);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.extensions).toEqual([0, 0, 6]);
      expect(result.shapes[2]).toHaveLength(12);
      // B (14,1) and D end up (23, 7) apart from B in the unshifted floor: D's origin x - B's origin x = 9.
      expect(result.placement.roomOrigin[3].x - result.placement.roomOrigin[1].x).toBe(9);
      expect(result.placement.roomOrigin[3].y - result.placement.roomOrigin[1].y).toBe(6);
    }
  });

  it('fails with the corridor that cannot be placed when the cap is below what it needs (cap 5)', () => {
    const result = layoutTree(rooms, graph, [straight, straight, straight], () => straight, 5, 2);
    expect(result).toEqual({ ok: false, failedCorridor: 2 });
  });

  it('tries a redrawn shape when the base shape does not fit within the cap', () => {
    let redraws = 0;
    const result = layoutTree(rooms, graph, [straight, straight, straight], () => {
      redraws += 1;
      return straight;
    }, 5, 3);
    expect(result.ok).toBe(false);
    expect(redraws).toBe(3);
  });
});

describe('a branching room (role C) anchors', () => {
  const rng = (values: number[]) => {
    let i = 0;
    return () => values[i++] ?? 0;
  };

  // The spec's example: 8x8, entered through the top wall at (4, 0) (heading S: the entry wall is the opposite, north
  // one); exits on the right and bottom walls; the distance ceil((8 - 3) * 0.9) = 5.
  it('puts the first exit on the right wall at least 5 away from the entry: (7, 5) .. (7, 7)', () => {
    expect(chooseRoomAnchors(8, 8, 'C', 'S', rng([0.5, 0, 0]), 0.9, { exits: ['E', 'S'] }).goal).toEqual({ x: 7, y: 5 });
    expect(chooseRoomAnchors(8, 8, 'C', 'S', rng([0.5, 0.999, 0]), 0.9, { exits: ['E', 'S'] }).goal).toEqual({ x: 7, y: 7 });
  });

  it('puts the second exit on the bottom wall, never on the cell the first exit uses', () => {
    const first = chooseRoomAnchors(8, 8, 'C', 'S', rng([0.5, 0, 0]), 0.9, { exits: ['E', 'S'] });
    expect(first.start).toEqual({ x: 4, y: 0 });
    expect(first.goal2).toEqual({ x: 0, y: 7 });

    // With the first exit on (7, 7) (the corner of the bottom wall too), the bottom wall has seven candidates, the last (6, 7).
    const corner = chooseRoomAnchors(8, 8, 'C', 'S', rng([0.5, 0.999, 0.999]), 0.9, { exits: ['E', 'S'] });
    expect(corner.goal).toEqual({ x: 7, y: 7 });
    expect(corner.goal2).toEqual({ x: 6, y: 7 });
  });

  it('takes the farthest cell (the first in reading order) when no cell is far enough (ratio 2)', () => {
    const anchors = chooseRoomAnchors(8, 8, 'C', 'S', rng([0.5, 0, 0]), 2, { exits: ['E', 'S'] });

    expect(anchors.goal).toEqual({ x: 7, y: 7 });
    expect(anchors.goal2).toEqual({ x: 0, y: 7 });
  });

  it('one exit gives goal only, and an exit wall that shares the entry\'s corner skips that cell', () => {
    // entry (0, 7) on the west wall (heading E); the south wall's exit may not use that corner cell.
    const anchors = chooseRoomAnchors(8, 8, 'C', 'E', rng([0.99, 0]), 0.9, { exits: ['S'] });

    expect(anchors.start).toEqual({ x: 0, y: 7 });
    // x >= 5 is far enough from (0, 7); the first of (5, 7), (6, 7), (7, 7).
    expect(anchors.goal).toEqual({ x: 5, y: 7 });
    expect(anchors.goal2).toBeUndefined();
  });
});

describe('the spec\'s five-room tree on the floor map', () => {
  const room = (doors: PlacedRoom['doors']): PlacedRoom => ({ width: 8, height: 8, doors });
  const rooms = [
    room([{ cell: { x: 7, y: 2 }, side: 'E' }, { cell: { x: 3, y: 7 }, side: 'S' }]),
    room([{ cell: { x: 0, y: 1 }, side: 'W' }]),
    room([{ cell: { x: 4, y: 0 }, side: 'N' }, { cell: { x: 7, y: 5 }, side: 'E' }, { cell: { x: 5, y: 7 }, side: 'S' }]),
    room([{ cell: { x: 0, y: 2 }, side: 'W' }]),
    room([{ cell: { x: 3, y: 0 }, side: 'N' }])
  ];
  const graph: FloorGraph = {
    startRoom: 0,
    corridors: [
      { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
      { from: { room: 0, door: 1 }, to: { room: 2, door: 0 } },
      { from: { room: 2, door: 1 }, to: { room: 3, door: 0 } },
      { from: { room: 2, door: 2 }, to: { room: 4, door: 0 } }
    ]
  };
  const straight: Position[] = Array.from({ length: 6 }, (_, f) => ({ x: f, y: 0 }));

  it('puts A (1, 0), B (15, 1), C (0, 14), D (14, 17), E (2, 28) on a 23 x 36 grid', () => {
    const placement = placeFloor(rooms, graph, [straight, straight, straight, straight]);

    expect(placement.roomOrigin).toEqual([
      { x: 1, y: 0 }, { x: 15, y: 1 }, { x: 0, y: 14 }, { x: 14, y: 17 }, { x: 2, y: 28 }
    ]);
    expect(placement.corridors[2][0]).toEqual({ x: 8, y: 19 });
    expect(placement.corridors[2][5]).toEqual({ x: 13, y: 19 });
    expect(placement.corridors[3][0]).toEqual({ x: 5, y: 22 });
    expect(placement.cols).toBe(23);
    expect(placement.rows).toBe(36);
    expect(placementFitsApart(placement, rooms, graph)).toBe(true);
  });

  it('walks back from D to the exit (7, 5) of C and from E to the exit (5, 7) of C', () => {
    expect(corridorFrom(graph, { room: 3, door: 0 })).toEqual({ corridor: 2, forward: false, to: { room: 2, door: 1 } });
    expect(corridorFrom(graph, { room: 4, door: 0 })).toEqual({ corridor: 3, forward: false, to: { room: 2, door: 2 } });
    expect(corridorFrom(graph, { room: 2, door: 0 })).toEqual({ corridor: 1, forward: false, to: { room: 0, door: 1 } });
    const state = new FloorState(rooms.map((r) => ({ ...r, cells: [] }) as unknown as Stage), graph);
    state.cross(1);
    expect(state.roomIndex).toBe(2);
    expect(state.route(1)).toEqual({ corridor: 2, forward: true, to: 3, toDoor: 0 });
    state.cross(1);
    expect(state.route(0)).toEqual({ corridor: 2, forward: false, to: 2, toDoor: 1 });
  });
});

describe('exitMarkers keeps the arrows below the HUD band', () => {
  const camera = { left: 0, top: 0, width: 400, height: 600 };
  const up = [{ x: 200, y: -100, label: 'DOOR' as const }];

  it('puts an arrow for an exit straight above at pad (30) when there is no band', () => {
    expect(exitMarkers(up, camera, 30, 0)[0]).toEqual({ text: 'DOOR ↑', x: 200, y: 30 });
  });

  it('pushes it below a band 80 px tall plus the 18 px gap: y = 98', () => {
    expect(exitMarkers(up, camera, 30, 98)[0]).toEqual({ text: 'DOOR ↑', x: 200, y: 98 });
  });

  it('keeps the plain pad when the inset is smaller than the pad (inset 10 -> y = 30)', () => {
    expect(exitMarkers(up, camera, 30, 10)[0].y).toBe(30);
  });

  it('points to an exit that sits under the band (it is hidden): y = 98', () => {
    // screen y = 50 is inside the band (0..80) and its gap: not visible, so it needs an arrow.
    const hidden = [{ x: 200, y: 50, label: 'GOAL' as const }];
    expect(exitMarkers(hidden, camera, 30, 0)).toEqual([]);
    expect(exitMarkers(hidden, camera, 30, 98)[0]).toEqual({ text: 'GOAL ↑', x: 200, y: 98 });
    // y = 98 is the first visible row.
    expect(exitMarkers([{ x: 200, y: 98, label: 'GOAL' as const }], camera, 30, 98)).toEqual([]);
  });

  it('on a short screen a tall band cannot flip the arrow: the inset stays above the middle (310 px tall)', () => {
    const short = { left: 0, top: 0, width: 667, height: 310 };
    const marker = exitMarkers([{ x: 333, y: -200, label: 'DOOR' as const }], short, 30, 200)[0];
    expect(marker.text).toBe('DOOR ↑');
    expect(marker.x).toBeCloseTo(333.5, 1);
    expect(marker.y).toBeLessThan(155);
    expect(marker.y).toBeGreaterThan(0);
  });

  it('does not move an arrow for an exit straight below, and keeps x for an upper-left exit', () => {
    const down = [{ x: 200, y: 700, label: 'DOOR' as const }];
    expect(exitMarkers(down, camera, 30, 98)[0].y).toBe(570);
    const upLeft = [{ x: -100, y: -100, label: 'GOAL' as const }];
    // dx = -300, dy = -400. Without a band the ray meets the left side first: t = (30 - 200) / -300, x = 30,
    // y = 300 - 400 t = 73.33. With the band the top is met first: t = (98 - 300) / -400 = 0.505, so the arrow
    // sits at x = 200 - 300 t = 48.5, y = 98.
    const plain = exitMarkers(upLeft, camera, 30, 0)[0];
    const pushed = exitMarkers(upLeft, camera, 30, 98)[0];
    expect(plain.text).toBe('GOAL ↖');
    expect(plain.x).toBeCloseTo(30, 5);
    expect(plain.y).toBeCloseTo(73.3333, 3);
    expect(pushed.text).toBe('GOAL ↖');
    expect(pushed.x).toBeCloseTo(48.5, 5);
    expect(pushed.y).toBeCloseTo(98, 5);
  });
});

describe('generateFloor safety valve', () => {
  it('draws from the relaxed tries once the normal rerolls are used up (limit 0), which may lengthen past the cap', () => {
    let beyondCap = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const floor = generateFloor(30, {
        seed,
        maxRetries: 1,
        maxGenerationMs: 600_000,
        maxExtension: 0,
        layoutRebuilds: 0,
        rerollLimit: 0
      });
      expect(floor.rooms).toHaveLength(5);
      beyondCap += floor.layout.corridors.some((cells) => cells.length > 26) ? 1 : 0;
    }
    expect(beyondCap).toBeGreaterThan(0);
  });

  it('rerolls a floor that cannot be placed without rebuilds or lengthening (stage 30, cap 0, no rebuild)', () => {
    let rerolled = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const floor = generateFloor(30, { seed, maxRetries: 1, maxGenerationMs: 600_000, maxExtension: 0, layoutRebuilds: 0 });
      rerolled += floor.rerolls > 0 ? 1 : 0;
    }
    expect(rerolled).toBeGreaterThan(0);
  });
});

describe('roomLevels (docs/spec/rooms-and-floors.md "部屋の難しさ": tree steps from room A)', () => {
  it('counts the tree edges from room A: A = 0, B and C = 1, a child is its parent + 1 (deep from level 2)', () => {
    expect(DEEP_ROOM_MIN_LEVEL).toBe(2);
    expect(roomLevels([-1, 0, 0, 1, 3])).toEqual([0, 1, 1, 2, 3]);
    expect(roomLevels([-1, 0, 0, 1, 1])).toEqual([0, 1, 1, 2, 2]);
    expect(roomLevels([-1, 0, 0, 2, 1])).toEqual([0, 1, 1, 2, 2]);
    expect(roomLevels([-1, 0, 0, 1])).toEqual([0, 1, 1, 2]);
    expect(roomLevels([-1, 0, 0, 1, 1, 2])).toEqual([0, 1, 1, 2, 2, 2]);
  });

  it('has RoomCount - 3 deep rooms for every tree of 4, 5 and 6 rooms (draws of every parent)', () => {
    for (const roomCount of [4, 5, 6]) {
      for (const a of [0.1, 0.5, 0.9]) {
        for (const b of [0.1, 0.5, 0.9]) {
          for (const c of [0.1, 0.5, 0.9]) {
            const tree = buildFloorTree(scripted([0.5, a, b, c, 0.5]), roomCount);
            const deep = roomLevels(tree.parent).filter((level) => level >= DEEP_ROOM_MIN_LEVEL);

            expect(deep).toHaveLength(roomCount - 3);
          }
        }
      }
    }
  });

  it('puts the down-stairs room at level 1 in 5/18 of the five-room trees (every parent draw, every leaf)', () => {
    let weight = 0;
    let seen = 0;
    // Room D picks its parent among B, C; room E among B, C, D (all with fewer than two children): 6 equal trees.
    for (const d of [0.25, 0.75]) {
      for (const e of [0.1, 0.5, 0.9]) {
        const leaves = [1, 2, 3, 4].filter((room) => {
          const tree = buildFloorTree(scripted([0.5, d, e, 0.5]), 5);
          return tree.children[room].length === 0;
        });
        for (let i = 0; i < leaves.length; i += 1) {
          const tree = buildFloorTree(scripted([0.5, d, e, (i + 0.5) / leaves.length]), 5);

          expect(tree.downRoom).toBe(leaves[i]);
          weight += roomLevels(tree.parent)[tree.downRoom] === 1 ? 1 / 6 / leaves.length : 0;
          seen += 1;
        }
      }
    }
    // Leaves of the three trees under one parent of D: 3 (E shares D's parent), 2 (E under the other), 2 (E under D).
    expect(seen).toBe(14);
    expect(weight).toBeCloseTo(5 / 18, 10);
  });
});
