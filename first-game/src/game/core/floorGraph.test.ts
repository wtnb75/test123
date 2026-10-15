import { describe, expect, it } from 'vitest';
import { FloorState } from './floor';
import { corridorFrom, doorCountOf, floorDoors, starGraph, type FloorGraph } from './floorGraph';
import { placeFloor, placementFitsApart, type PlacedRoom } from './floorLayout';
import { roomExits } from './exits';
import { generateFloor } from './generator';
import type { Stage } from './types';

const stage = (doors?: Stage['doors']): Stage => ({
  width: 8,
  height: 8,
  stageNo: 1,
  cells: [],
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  goal: { x: 0, y: 0 },
  doors,
  generation: { retries: 0, depthTarget: 1, solverDepth: 1, generationMs: 0 }
});

const straight = Array.from({ length: 6 }, (_, f) => ({ x: f, y: 0 }));

describe('starGraph', () => {
  it('joins door i of the start room to room i + 1 for every other room', () => {
    expect(starGraph(3)).toEqual({
      startRoom: 0,
      corridors: [
        { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
        { from: { room: 0, door: 1 }, to: { room: 2, door: 0 } }
      ]
    });
  });

  it('has no corridor for a floor of one room or none', () => {
    expect(starGraph(1).corridors).toEqual([]);
    expect(starGraph(0).corridors).toEqual([]);
  });
});

describe('floor data lookups', () => {
  const graph = starGraph(3);

  it('lists the doors of every room in room order with their room and door index', () => {
    const rooms = [
      stage([{ cell: { x: 7, y: 2 }, side: 'E' }, { cell: { x: 3, y: 7 }, side: 'S' }]),
      stage([{ cell: { x: 0, y: 1 }, side: 'W' }]),
      stage([{ cell: { x: 4, y: 0 }, side: 'N' }])
    ];
    expect(floorDoors(rooms).map((d) => [d.room, d.door, d.side])).toEqual([
      [0, 0, 'E'], [0, 1, 'S'], [1, 0, 'W'], [2, 0, 'N']
    ]);
  });

  it('walks a corridor forward from its first door and back from its last', () => {
    expect(corridorFrom(graph, { room: 0, door: 1 })).toEqual({ corridor: 1, forward: true, to: { room: 2, door: 0 } });
    expect(corridorFrom(graph, { room: 1, door: 0 })).toEqual({ corridor: 0, forward: false, to: { room: 0, door: 0 } });
  });

  it('finds no corridor for a door the graph does not use', () => {
    expect(corridorFrom(graph, { room: 1, door: 1 })).toBeUndefined();
  });

  it('counts the doors the corridors use, at least one', () => {
    expect(doorCountOf(graph, 0)).toBe(2);
    expect(doorCountOf(graph, 1)).toBe(1);
    expect(doorCountOf(graph, 7)).toBe(1);
  });
});

describe('FloorState on a graph of more rooms', () => {
  // A - B through A's door 0, B - D through B's door 1: a chain, so D is two corridors away.
  const chain: FloorGraph = {
    startRoom: 0,
    corridors: [
      { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
      { from: { room: 1, door: 1 }, to: { room: 2, door: 0 } }
    ]
  };

  it('crosses a later room\'s own door onwards and back along the same corridor', () => {
    const a = stage();
    const b = stage();
    const d = stage();
    const floor = new FloorState([a, b, d], chain);
    expect(floor.cross(0)).toBe(b);
    expect(floor.route(1)).toEqual({ corridor: 1, forward: true, to: 2, toDoor: 0 });
    expect(floor.cross(1)).toBe(d);
    expect(floor.route()).toEqual({ corridor: 1, forward: false, to: 1, toDoor: 1 });
    expect(floor.cross()).toBe(b);
    expect(floor.route(0)).toEqual({ corridor: 0, forward: false, to: 0, toDoor: 0 });
  });

  it('throws when the door used joins no corridor', () => {
    const floor = new FloorState([stage(), stage()], { startRoom: 0, corridors: [] });
    expect(() => floor.route(0)).toThrow('joins no corridor');
  });

  it('starts in the graph\'s start room', () => {
    const floor = new FloorState([stage(), stage()], { startRoom: 1, corridors: [{ from: { room: 1, door: 0 }, to: { room: 0, door: 0 } }] });
    expect(floor.roomIndex).toBe(1);
    expect(floor.route(0)).toEqual({ corridor: 0, forward: true, to: 0, toDoor: 0 });
  });
});

describe('roomExits for a room without a goalKind', () => {
  const plain = (): Stage => ({
    ...stage([{ cell: { x: 7, y: 2 }, side: 'E' }]),
    start: { x: 1, y: 1 },
    goal: { x: 5, y: 5 }
  });

  it('points at the doors in room 0 and at the down-stairs in another room', () => {
    expect(roomExits(plain(), 0, { x: 0, y: 0 }, 10).map((e) => e.label)).toEqual(['DOOR']);
    expect(roomExits(plain(), 1, { x: 0, y: 0 }, 10).map((e) => e.label)).toEqual(['GOAL']);
  });
});

describe('roomExits decides the start room by its goalKind, not its index', () => {
  const doors: Stage['doors'] = [{ cell: { x: 7, y: 2 }, side: 'E' }, { cell: { x: 3, y: 7 }, side: 'S' }];

  it('points at every door of a goalKind door room even when it is room 1', () => {
    const start: Stage = { ...stage(doors), startKind: 'up', goalKind: 'door', goal: { x: 7, y: 2 } };
    expect(roomExits(start, 1, { x: 0, y: 0 }, 10).map((e) => e.label)).toEqual(['DOOR', 'DOOR']);
  });

  it('points at the down-stairs of a goalKind down room even when it is room 0', () => {
    const down: Stage = { ...stage([{ cell: { x: 0, y: 1 }, side: 'W' }]), startKind: 'door', goalKind: 'down', goal: { x: 5, y: 5 } };
    expect(roomExits(down, 0, { x: 0, y: 0 }, 10).map((e) => e.label)).toEqual(['GOAL']);
  });
});

describe('a generated floor as data', () => {
  const floors = [1, 2, 3, 4, 5].flatMap((seed) =>
    [1, 5].map((stageNo) => generateFloor(stageNo, { seed, maxRetries: 1, maxGenerationMs: 600_000, maxLoops: 0 }))
  );

  it('has RoomCount rooms, one corridor per room but room A, one entry door per room but room A, and starts in room A', () => {
    for (const floor of floors) {
      const exits = floor.tree.children.reduce((sum, children) => sum + children.length, 0);

      expect(floor.rooms).toHaveLength(5);
      expect(floorDoors(floor.rooms)).toHaveLength(exits + 4);
      expect(floor.graph.corridors).toHaveLength(4);
      expect(floor.layout.corridors).toHaveLength(4);
      expect(floor.graph.startRoom).toBe(0);
    }
  });

  it('joins door A1 to room B and door A2 to room C, walked back from their own entry door', () => {
    for (const floor of floors) {
      expect(corridorFrom(floor.graph, { room: 0, door: 0 })).toEqual({ corridor: 0, forward: true, to: { room: 1, door: 0 } });
      expect(corridorFrom(floor.graph, { room: 0, door: 1 })).toEqual({ corridor: 1, forward: true, to: { room: 2, door: 0 } });
      expect(corridorFrom(floor.graph, { room: 2, door: 0 })).toEqual({ corridor: 1, forward: false, to: { room: 0, door: 1 } });
    }
  });

  it('joins a branching room\'s exits (after its entry door) to its children', () => {
    for (const floor of floors) {
      floor.tree.children.forEach((children, room) => {
        children.forEach((child, i) => {
          const door = room === 0 ? i : 1 + i;
          expect(corridorFrom(floor.graph, { room, door })).toEqual({
            corridor: child - 1,
            forward: true,
            to: { room: child, door: 0 }
          });
        });
      });
    }
  });

  it('walks room A\'s door into the other room and back with a FloorState on the generated graph', () => {
    const floor = floors[0];
    const state = new FloorState(floor.rooms, floor.graph);
    expect(state.roomIndex).toBe(0);
    expect(state.route(0)).toEqual({ corridor: 0, forward: true, to: 1, toDoor: 0 });
    // Arriving opens the door cell the player stands on (room C was closed): the same room, the cell now open.
    const arrived = state.cross(1);
    expect(arrived.cells.map((cell) => cell.hasBomb)).toEqual(floor.rooms[2].cells.map((cell) => cell.hasBomb));
    expect(arrived.player).toEqual(floor.rooms[2].start);
    expect(arrived.cells[arrived.player.y * arrived.width + arrived.player.x].revealed).toBe(true);
    expect(state.route()).toEqual({ corridor: 1, forward: false, to: 0, toDoor: 1 });
  });
});

describe('placeFloor', () => {
  const room = (doors: PlacedRoom['doors']): PlacedRoom => ({ width: 8, height: 8, doors });

  it('puts rooms B and C where the star graph example of the spec says (heading E and S, straight corridors)', () => {
    const rooms = [
      room([{ cell: { x: 7, y: 2 }, side: 'E' }, { cell: { x: 3, y: 7 }, side: 'S' }]),
      room([{ cell: { x: 0, y: 1 }, side: 'W' }]),
      room([{ cell: { x: 4, y: 0 }, side: 'N' }])
    ];
    const placement = placeFloor(rooms, starGraph(3), [straight, straight]);
    // Room A (0,0), B (14,1), C (-1,14); moved right by 1: A (1,0), B (15,1), C (0,14).
    expect(placement.roomOrigin).toEqual([{ x: 1, y: 0 }, { x: 15, y: 1 }, { x: 0, y: 14 }]);
    expect(placement.corridors[0][0]).toEqual({ x: 9, y: 2 });
    expect(placement.corridors[0][5]).toEqual({ x: 14, y: 2 });
    expect(placement.corridors[1][0]).toEqual({ x: 4, y: 8 });
    expect(placement.cols).toBe(23);
    expect(placement.rows).toBe(22);
    expect(placementFitsApart(placement, rooms, starGraph(3))).toBe(true);
  });

  it('places a room joined through a later room\'s own door (A - B - D chain)', () => {
    const rooms = [
      room([{ cell: { x: 7, y: 2 }, side: 'E' }]),
      room([{ cell: { x: 0, y: 1 }, side: 'W' }, { cell: { x: 7, y: 3 }, side: 'E' }]),
      room([{ cell: { x: 0, y: 1 }, side: 'W' }])
    ];
    const graph: FloorGraph = {
      startRoom: 0,
      corridors: [
        { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
        { from: { room: 1, door: 1 }, to: { room: 2, door: 0 } }
      ]
    };
    const placement = placeFloor(rooms, graph, [straight, straight]);
    // B (14,1); door B2 at (21,4); corridor (22,4)..(27,4); D = (27,4) + (1,0) - (0,1) = (28,3).
    expect(placement.roomOrigin).toEqual([{ x: 0, y: 0 }, { x: 14, y: 1 }, { x: 28, y: 3 }]);
    expect(placement.corridors[1][0]).toEqual({ x: 22, y: 4 });
    expect(placement.corridors[1][5]).toEqual({ x: 27, y: 4 });
    expect(placementFitsApart(placement, rooms, graph)).toBe(true);
  });

  it('is independent of the order of the corridors in the list', () => {
    const rooms = [
      room([{ cell: { x: 7, y: 2 }, side: 'E' }]),
      room([{ cell: { x: 0, y: 1 }, side: 'W' }, { cell: { x: 7, y: 3 }, side: 'E' }]),
      room([{ cell: { x: 0, y: 1 }, side: 'W' }])
    ];
    const reversed: FloorGraph = {
      startRoom: 0,
      corridors: [
        { from: { room: 1, door: 1 }, to: { room: 2, door: 0 } },
        { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } }
      ]
    };
    const placement = placeFloor(rooms, reversed, [straight, straight]);
    expect(placement.roomOrigin).toEqual([{ x: 0, y: 0 }, { x: 14, y: 1 }, { x: 28, y: 3 }]);
  });

  it('puts the start room at (0, 0) and the others relative to it when the start room is not room 0', () => {
    // Room 1 is the start (door 0 on its east wall at (7, 2)); room 0 hangs off it through its own west door (0, 1).
    const rooms = [
      room([{ cell: { x: 0, y: 1 }, side: 'W' }]),
      room([{ cell: { x: 7, y: 2 }, side: 'E' }])
    ];
    const graph: FloorGraph = {
      startRoom: 1,
      corridors: [{ from: { room: 1, door: 0 }, to: { room: 0, door: 0 } }]
    };
    const placement = placeFloor(rooms, graph, [straight]);
    // Start room (0,0); corridor (8,2)..(13,2); room 0 = (13,2) + (1,0) - (0,1) = (14,1).
    expect(placement.roomOrigin).toEqual([{ x: 14, y: 1 }, { x: 0, y: 0 }]);
    expect(placement.corridors[0][0]).toEqual({ x: 8, y: 2 });
  });

  it('throws when a corridor leads to a room that already has a place (a ring)', () => {
    const rooms = [
      room([{ cell: { x: 7, y: 2 }, side: 'E' }, { cell: { x: 3, y: 7 }, side: 'S' }]),
      room([{ cell: { x: 0, y: 1 }, side: 'W' }, { cell: { x: 4, y: 0 }, side: 'N' }])
    ];
    const ring: FloorGraph = {
      startRoom: 0,
      corridors: [
        { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
        { from: { room: 0, door: 1 }, to: { room: 1, door: 1 } }
      ]
    };
    expect(() => placeFloor(rooms, ring, [straight, straight])).toThrow('already has a place');
  });

  it('throws when a room is not reached from the start room', () => {
    const rooms = [room([{ cell: { x: 7, y: 2 }, side: 'E' }]), room([{ cell: { x: 0, y: 1 }, side: 'W' }]), room([])];
    expect(() => placeFloor(rooms, starGraph(2), [straight])).toThrow('not reached');
  });
});

describe('placementFitsApart', () => {
  const sizes = [{ width: 8, height: 8 }, { width: 8, height: 8 }, { width: 8, height: 8 }];
  const graph = starGraph(3);
  const at = (roomOrigin: { x: number; y: number }[], corridors: { x: number; y: number }[][]) =>
    ({ roomOrigin, corridors, cols: 0, rows: 0 });

  it('rejects two rooms that touch, even diagonally', () => {
    const placement = at([{ x: 0, y: 0 }, { x: 8, y: 8 }, { x: 40, y: 40 }], [[], []]);
    expect(placementFitsApart(placement, sizes, graph)).toBe(false);
  });

  it('rejects a corridor cell inside a room or next to a room it does not join', () => {
    const rooms = [{ x: 0, y: 0 }, { x: 14, y: 1 }, { x: 4, y: 14 }];
    expect(placementFitsApart(at(rooms, [[{ x: 8, y: 8 }], []]), sizes, graph)).toBe(true);
    // (5, 5) is inside room A.
    expect(placementFitsApart(at(rooms, [[{ x: 5, y: 5 }], []]), sizes, graph)).toBe(false);
    // (11, 13) touches room C's top-right corner (11, 14), and corridor 1 joins only rooms A and B.
    expect(placementFitsApart(at(rooms, [[{ x: 11, y: 13 }], []]), sizes, graph)).toBe(false);
  });

  it('rejects a corridor next to a room it does not join on a chain A - B - D, but not next to its own rooms', () => {
    const chain: FloorGraph = {
      startRoom: 0,
      corridors: [
        { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
        { from: { room: 1, door: 1 }, to: { room: 2, door: 0 } }
      ]
    };
    const rooms = [{ x: 0, y: 0 }, { x: 14, y: 1 }, { x: 28, y: 3 }];
    // Corridor 2 joins B and D; (8, 8) is diagonal to room A's corner (7, 7), a room it does not join.
    expect(placementFitsApart(at(rooms, [[], [{ x: 8, y: 8 }]]), sizes, chain)).toBe(false);
    // (22, 4) is right next to room B's east column (21, 4), a room it joins.
    expect(placementFitsApart(at(rooms, [[], [{ x: 22, y: 4 }]]), sizes, chain)).toBe(true);
  });

  it('rejects two corridors that share a cell or a side', () => {
    const rooms = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 0, y: 30 }];
    expect(placementFitsApart(at(rooms, [[{ x: 9, y: 7 }], [{ x: 9, y: 8 }]]), sizes, graph)).toBe(false);
    expect(placementFitsApart(at(rooms, [[{ x: 9, y: 7 }], [{ x: 9, y: 9 }]]), sizes, graph)).toBe(true);
  });
});
