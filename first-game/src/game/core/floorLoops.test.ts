import { describe, expect, it } from 'vitest';
import type { FloorGraph } from './floorGraph';
import type { FloorPlacement, PlacedRoom } from './floorLayout';
import {
  LOOP_COUNT_MAX,
  LOOP_MAX_LENGTH,
  LOOP_MIN_LENGTH,
  chooseLoop,
  enterableDoors,
  loopCandidates,
  loopCountFromDraw,
  placeLoops
} from './floorLoops';
import type { StageDoor } from './types';

// docs/spec/rooms-and-floors.md "輪": the hand-worked examples (8x8 rooms) of the "テスト観点".
const room = (doors: StageDoor[] = []): PlacedRoom => ({ width: 8, height: 8, doors });
const FAR = { x: 60, y: 60 };

/** Room 0 (the start room: never in a loop) far away, then rooms 1.. at the given top-left cells. */
const floorOf = (origins: { x: number; y: number }[], rooms: PlacedRoom[] = origins.map(() => room())) => ({
  rooms: [room(), ...rooms],
  placement: {
    roomOrigin: [FAR, ...origins],
    corridors: [],
    cols: 100,
    rows: 100
  } as FloorPlacement,
  graph: { startRoom: 0, corridors: [] } as FloorGraph
});

describe('loopCountFromDraw', () => {
  it('is floor(r * (max + 1)): 0, 1 and 2 are equally likely', () => {
    expect([0, 0.33, 0.34, 0.66, 0.67, 0.99].map((r) => loopCountFromDraw(r))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(LOOP_COUNT_MAX).toBe(2);
  });

  it('never exceeds the maximum, also for a draw of exactly 1 and for another maximum', () => {
    expect(loopCountFromDraw(1)).toBe(2);
    expect(loopCountFromDraw(0.99, 0)).toBe(0);
    expect(loopCountFromDraw(0.99, 1)).toBe(1);
    expect(loopCountFromDraw(0.5, 1)).toBe(1);
    expect(loopCountFromDraw(0.49, 1)).toBe(0);
  });
});

describe('loopCandidates', () => {
  it('offers a horizontal pair with the rows both rooms contain (P (0,0), Q (14,2): gap 6, rows 2..7)', () => {
    const { rooms, placement, graph } = floorOf([{ x: 0, y: 0 }, { x: 14, y: 2 }]);

    expect(loopCandidates(rooms, placement, graph)).toEqual([
      { from: 1, to: 2, heading: 'E', length: 6, lines: [2, 3, 4, 5, 6, 7] }
    ]);
  });

  it('offers a vertical pair with the columns both rooms contain (P (0,0), Z (2,12): gap 4, columns 2..7)', () => {
    const { rooms, placement, graph } = floorOf([{ x: 0, y: 0 }, { x: 2, y: 12 }]);

    expect(loopCandidates(rooms, placement, graph)).toEqual([
      { from: 1, to: 2, heading: 'S', length: 4, lines: [2, 3, 4, 5, 6, 7] }
    ]);
  });

  it('heads left or up when the room with the smaller index lies to the right or below', () => {
    const across = floorOf([{ x: 14, y: 2 }, { x: 0, y: 0 }]);
    const down = floorOf([{ x: 2, y: 12 }, { x: 0, y: 0 }]);

    expect(loopCandidates(across.rooms, across.placement, across.graph)[0]).toMatchObject({ heading: 'W', length: 6 });
    expect(loopCandidates(down.rooms, down.placement, down.graph)[0]).toMatchObject({ heading: 'N', length: 4 });
  });

  it('needs a gap of LoopMinLength..LoopMaxLength cells (2 and 27 are out, 3 and 26 are in)', () => {
    const gap = (g: number) => {
      const { rooms, placement, graph } = floorOf([{ x: 0, y: 0 }, { x: 8 + g, y: 2 }]);
      return loopCandidates(rooms, placement, graph).map((c) => c.length);
    };

    expect([gap(2), gap(3), gap(26), gap(27)]).toEqual([[], [3], [26], []]);
    expect([LOOP_MIN_LENGTH, LOOP_MAX_LENGTH]).toEqual([3, 26]);
  });

  it('offers nothing for rooms that share no row or column (Q (14,10) against P (0,0))', () => {
    const { rooms, placement, graph } = floorOf([{ x: 0, y: 0 }, { x: 14, y: 10 }]);

    expect(loopCandidates(rooms, placement, graph)).toEqual([]);
  });

  it('drops a row whose corridor would cross or touch a third room: every row 2..7 is blocked by R at (9,3)', () => {
    // R is 4x4 (x 9..12, y 3..6): rows 3..6 run through it, rows 2 and 7 touch it (also diagonally).
    const { rooms, placement, graph } = floorOf(
      [{ x: 0, y: 0 }, { x: 14, y: 2 }, { x: 9, y: 3 }],
      [room(), room(), { width: 4, height: 4, doors: [] }]
    );

    expect(loopCandidates(rooms, placement, graph)).toEqual([]);
  });

  it('drops the rows that touch another corridor: a cell at (10,5) leaves rows 2, 3 and 7', () => {
    const { rooms, placement } = floorOf([{ x: 0, y: 0 }, { x: 14, y: 2 }]);
    const withCorridor: FloorPlacement = { ...placement, corridors: [[{ x: 10, y: 5 }]] };
    const linkedGraph: FloorGraph = {
      startRoom: 0,
      corridors: [{ from: { room: 0, door: 0 }, to: { room: 1, door: 0 } }]
    };

    expect(loopCandidates(rooms, withCorridor, linkedGraph).map((c) => c.lines)).toEqual([[2, 3, 7]]);
  });

  it('keeps a door cell 2 apart from the room\'s other doors (an exit at (7,3) leaves (7,5), (7,6), (7,7))', () => {
    const { rooms, placement, graph } = floorOf(
      [{ x: 0, y: 0 }, { x: 14, y: 2 }],
      [room([{ cell: { x: 7, y: 3 }, side: 'E' }]), room()]
    );

    expect(loopCandidates(rooms, placement, graph).map((c) => c.lines)).toEqual([[5, 6, 7]]);
  });

  it('also keeps the far door cell apart from the other room\'s doors', () => {
    // Q's west wall: local (0, y - 2); a door at (0, 2) is on floor row 4: rows 3, 4 and 5 are too near.
    const { rooms, placement, graph } = floorOf(
      [{ x: 0, y: 0 }, { x: 14, y: 2 }],
      [room(), room([{ cell: { x: 0, y: 2 }, side: 'W' }])]
    );

    expect(loopCandidates(rooms, placement, graph).map((c) => c.lines)).toEqual([[2, 6, 7]]);
  });

  it('never joins room 0, a pair a corridor already joins, or a pair of rooms that touch', () => {
    const near = floorOf([{ x: 0, y: 0 }]);
    const joined = floorOf([{ x: 0, y: 0 }, { x: 14, y: 2 }]);
    const withRoomA: FloorPlacement = { ...near.placement, roomOrigin: [{ x: 0, y: 0 }, { x: 14, y: 2 }] };
    const linked: FloorGraph = {
      startRoom: 0,
      corridors: [{ from: { room: 1, door: 0 }, to: { room: 2, door: 0 } }]
    };

    // Room 0 (the start room) is at (0,0) and room 1 lies across from it: no loop for room 0.
    expect(loopCandidates([room(), room()], withRoomA, near.graph)).toEqual([]);
    expect(loopCandidates(joined.rooms, { ...joined.placement, corridors: [[{ x: 8, y: 2 }]] }, linked)).toEqual([]);
  });
});

describe('chooseLoop', () => {
  const horizontal = floorOf([{ x: 0, y: 0 }, { x: 14, y: 2 }]);
  const vertical = floorOf([{ x: 0, y: 0 }, { x: 2, y: 12 }]);

  it('puts a horizontal loop on row 4: P (7,4) east, cells (8,4)..(13,4), Q (0,2) west', () => {
    const [candidate] = loopCandidates(horizontal.rooms, horizontal.placement, horizontal.graph);
    const loop = chooseLoop(horizontal.rooms, horizontal.placement, [candidate], 0, 0.34);

    expect(loop).toEqual({
      from: 1,
      to: 2,
      heading: 'E',
      length: 6,
      cells: [8, 9, 10, 11, 12, 13].map((x) => ({ x, y: 4 })),
      fromDoor: { cell: { x: 7, y: 2 + 2 }, side: 'E' },
      toDoor: { cell: { x: 0, y: 2 }, side: 'W' }
    });
  });

  it('puts a vertical loop on column 5: P (5,7) south, cells (5,8)..(5,11), Z (3,0) north', () => {
    const [candidate] = loopCandidates(vertical.rooms, vertical.placement, vertical.graph);
    const loop = chooseLoop(vertical.rooms, vertical.placement, [candidate], 0, 0.5);

    expect(loop.cells).toEqual([8, 9, 10, 11].map((y) => ({ x: 5, y })));
    expect(loop.fromDoor).toEqual({ cell: { x: 5, y: 7 }, side: 'S' });
    expect(loop.toDoor).toEqual({ cell: { x: 3, y: 0 }, side: 'N' });
  });

  it('walks left from a P that lies to the right: P (0,2) west, cells (13,4)..(8,4), Q (7,4) east', () => {
    const across = floorOf([{ x: 14, y: 2 }, { x: 0, y: 0 }]);
    const [candidate] = loopCandidates(across.rooms, across.placement, across.graph);
    const loop = chooseLoop(across.rooms, across.placement, [candidate], 0, 0.34);

    expect(loop.heading).toBe('W');
    expect(loop.fromDoor).toEqual({ cell: { x: 0, y: 2 }, side: 'W' });
    expect(loop.cells).toEqual([13, 12, 11, 10, 9, 8].map((x) => ({ x, y: 4 })));
    expect(loop.toDoor).toEqual({ cell: { x: 7, y: 4 }, side: 'E' });
  });

  it('walks up from a P below: P (3,0) north, cells (5,11)..(5,8), Q (5,7) south', () => {
    const below = floorOf([{ x: 2, y: 12 }, { x: 0, y: 0 }]);
    const [candidate] = loopCandidates(below.rooms, below.placement, below.graph);
    const loop = chooseLoop(below.rooms, below.placement, [candidate], 0, 0.5);

    expect(loop.heading).toBe('N');
    expect(loop.fromDoor).toEqual({ cell: { x: 3, y: 0 }, side: 'N' });
    expect(loop.cells).toEqual([11, 10, 9, 8].map((y) => ({ x: 5, y })));
    expect(loop.toDoor).toEqual({ cell: { x: 5, y: 7 }, side: 'S' });
  });

  it('picks the pair floor(r1 * pairs) and the line floor(r2 * lines), and stays inside the list for a draw of 1', () => {
    const candidates = [
      { from: 1, to: 2, heading: 'E' as const, length: 6, lines: [2, 3, 4, 5, 6, 7] },
      { from: 1, to: 3, heading: 'E' as const, length: 6, lines: [2, 3] }
    ];
    const three = floorOf([{ x: 0, y: 0 }, { x: 14, y: 2 }, { x: 14, y: 20 }]);
    // Pair 1 (to room 3) needs room 3 to the right of room 1 with overlapping rows: use rows from the list only.
    const placement: FloorPlacement = {
      ...three.placement,
      roomOrigin: [FAR, { x: 0, y: 0 }, { x: 14, y: 2 }, { x: 14, y: 0 }]
    };
    const rooms = three.rooms;

    expect(chooseLoop(rooms, placement, candidates, 0.49, 0).to).toBe(2);
    expect(chooseLoop(rooms, placement, candidates, 0.5, 0).to).toBe(3);
    expect(chooseLoop(rooms, placement, candidates, 0.99, 0.99).fromDoor.cell.y).toBe(3);
    expect(chooseLoop(rooms, placement, candidates, 1, 1).fromDoor.cell.y).toBe(3);
  });
});

describe('placeLoops', () => {
  const rooms = [
    room(),
    room([{ cell: { x: 0, y: 0 }, side: 'W' }]),
    room([{ cell: { x: 7, y: 7 }, side: 'E' }])
  ];
  const placement = (): FloorPlacement => ({
    roomOrigin: [FAR, { x: 0, y: 0 }, { x: 14, y: 2 }],
    corridors: [],
    cols: 100,
    rows: 100
  });
  const graph: FloorGraph = { startRoom: 0, corridors: [] };
  const draws = (...values: number[]) => {
    let at = 0;
    return () => values[Math.min(at++, values.length - 1)];
  };

  it('places no loop when the count draw says 0, or when the maximum is 0', () => {
    expect(placeLoops(rooms, placement(), graph, draws(0.2)).loops).toEqual([]);
    expect(placeLoops(rooms, placement(), graph, draws(0.99), 0).loops).toEqual([]);
  });

  it('adds the loop\'s corridor, and its door at the end of both rooms\' door lists, with matching door refs', () => {
    const looped = placeLoops(rooms, placement(), graph, draws(0.34, 0, 0.34));

    expect(looped.loops).toHaveLength(1);
    expect(looped.placement.corridors).toHaveLength(1);
    expect(looped.placement.corridors[0]).toEqual(looped.loops[0].cells);
    expect(looped.graph.corridors).toEqual([{ from: { room: 1, door: 1 }, to: { room: 2, door: 1 } }]);
    expect(looped.rooms[1].doors).toEqual([rooms[1].doors[0], looped.loops[0].fromDoor]);
    expect(looped.rooms[2].doors).toEqual([rooms[2].doors[0], looped.loops[0].toDoor]);
    // The inputs are not changed.
    expect(rooms[1].doors).toHaveLength(1);
    expect(graph.corridors).toHaveLength(0);
  });

  it('stops when no pair is left: two loops asked, one pair available, one loop placed', () => {
    const looped = placeLoops(rooms, placement(), graph, draws(0.67, 0, 0));

    expect(looped.loops).toHaveLength(1);
  });

  it('places a second loop between another pair when there is one', () => {
    const four = [...rooms, room([{ cell: { x: 0, y: 0 }, side: 'W' }])];
    const place: FloorPlacement = {
      ...placement(),
      roomOrigin: [FAR, { x: 0, y: 0 }, { x: 14, y: 2 }, { x: 0, y: 14 }]
    };
    const looped = placeLoops(four, place, graph, draws(0.67, 0, 0, 0, 0));

    expect(looped.loops.map((loop) => [loop.from, loop.to])).toEqual([[1, 2], [1, 3]]);
    expect(looped.graph.corridors.map((link) => link.from.door)).toEqual([1, 2]);
  });
});

describe('enterableDoors', () => {
  // Rooms A=0, B=1, C=2, D=3, E=4. Tree: A -> B -> D, A -> C -> E (door 0 of a non-A room leads to its parent).
  const tree: FloorGraph = {
    startRoom: 0,
    corridors: [
      { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
      { from: { room: 0, door: 1 }, to: { room: 2, door: 0 } },
      { from: { room: 1, door: 1 }, to: { room: 3, door: 0 } },
      { from: { room: 2, door: 1 }, to: { room: 4, door: 0 } }
    ]
  };

  it('is only the entry door in a tree, and nothing for the start room', () => {
    expect([1, 2, 3, 4].map((r) => enterableDoors(tree, r))).toEqual([[0], [0], [0], [0]]);
    expect(enterableDoors(tree, 0)).toEqual([]);
  });

  it('adds the exits and loop doors that a loop makes reachable: loop D-E makes B, C, D and E two-doored', () => {
    const looped: FloorGraph = {
      ...tree,
      corridors: [...tree.corridors, { from: { room: 3, door: 1 }, to: { room: 4, door: 1 } }]
    };

    expect([1, 2, 3, 4].map((r) => enterableDoors(looped, r))).toEqual([[0, 1], [0, 1], [0, 1], [0, 1]]);
  });

  it('leaves out an exit whose room is only reachable through the room itself: loop B-C', () => {
    const looped: FloorGraph = {
      ...tree,
      corridors: [...tree.corridors, { from: { room: 1, door: 2 }, to: { room: 2, door: 2 } }]
    };

    expect([1, 2, 3, 4].map((r) => enterableDoors(looped, r))).toEqual([[0, 2], [0, 2], [0], [0]]);
  });
});
