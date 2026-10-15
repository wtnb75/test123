import { describe, expect, it } from 'vitest';
import type { FloorGraph } from './floorGraph';
import {
  MAP_CELL_MAX,
  MAP_FADE_MS,
  MAP_HOLD_MS,
  controlsLayout,
  mapAccepted,
  mapAlpha,
  mapKeyPressed,
  mapShapes,
  mapView,
  type MapView
} from './mapOverlay';
import type { FlowPhase } from './flow';
import type { Position, Stage, StageDoor } from './types';

// docs/spec/floor-map.md "テスト観点": the hand-worked values.
describe('mapAlpha', () => {
  it('is 1 while held, then fades straight to 0 over MapFadeMs, then is gone (null)', () => {
    expect([MAP_HOLD_MS, MAP_FADE_MS]).toEqual([1500, 500]);
    expect(mapAlpha(0)).toBe(1);
    expect(mapAlpha(1000)).toBe(1);
    expect(mapAlpha(1499)).toBe(1);
    expect(mapAlpha(1500)).toBe(1);
    expect(mapAlpha(1600)).toBeCloseTo(0.8, 10);
    expect(mapAlpha(1750)).toBeCloseTo(0.5, 10);
    expect(mapAlpha(1900)).toBeCloseTo(0.2, 10);
    expect(mapAlpha(1999)).toBeCloseTo(0.002, 10);
    expect(mapAlpha(2000)).toBeNull();
    expect(mapAlpha(2100)).toBeNull();
  });
});

describe('mapAccepted', () => {
  it('takes the map in play and in a corridor walk, and in no other phase', () => {
    const phases: FlowPhase[] = ['play', 'clearing', 'corridor', 'dying', 'gameover', 'grave', 'restarting'];

    expect(phases.filter((phase) => mapAccepted(phase))).toEqual(['play', 'corridor']);
  });
});

describe('mapKeyPressed', () => {
  const none = { ctrlKey: false, altKey: false, metaKey: false };

  it('shows on KeyM once per press: a held key\'s repeat does not, Ctrl / Alt / Meta are refused (Shift is not a refused modifier)', () => {
    expect(mapKeyPressed('KeyM', false, none)).toBe(true);
    expect(mapKeyPressed('KeyM', true, none)).toBe(false);
    expect(mapKeyPressed('KeyM', false, { ...none, ctrlKey: true })).toBe(false);
    expect(mapKeyPressed('KeyM', false, { ...none, altKey: true })).toBe(false);
    expect(mapKeyPressed('KeyM', false, { ...none, metaKey: true })).toBe(false);
  });

  it('is not triggered by other keys (the neighbours, the movement and the restart keys)', () => {
    for (const code of ['KeyN', 'Comma', 'KeyS', 'KeyR', 'KeyT', 'Enter', 'Space', 'ShiftLeft', 'Numpad5', 'ArrowUp']) {
      expect(mapKeyPressed(code, false, none)).toBe(false);
    }
  });
});

describe('controlsLayout', () => {
  it('390 x 844 is compact (width <= 400): FLAG 44 at (348, 802), MAP right above at (348, 746)', () => {
    const c = controlsLayout(390, 844);

    expect(c.compact).toBe(true);
    expect(c.flag).toEqual({ x: 348, y: 802, size: 44, hitRadius: 32 });
    expect(c.map).toEqual({ x: 348, y: 746, size: 44, hitRadius: 24 });
    // The circle's bottom is 12 above FLAG's top, and the hit circles only touch (FLAG's is the circle + 10).
    expect(c.map.y + c.map.size / 2).toBe(c.flag.y - c.flag.size / 2 - 12);
    expect(c.map.y + c.map.hitRadius).toBe(c.flag.y - c.flag.hitRadius);
  });

  it('1280 x 720 is not compact: FLAG 52 at (1234, 674), MAP at (1234, 610), hit radius 28', () => {
    const c = controlsLayout(1280, 720);

    expect(c.compact).toBe(false);
    expect(c.flag).toEqual({ x: 1234, y: 674, size: 52, hitRadius: 36 });
    expect(c.map).toEqual({ x: 1234, y: 610, size: 52, hitRadius: 28 });
    expect(c.map.y + c.map.hitRadius).toBe(c.flag.y - c.flag.hitRadius);
  });

  it('375 x 550 and 667 x 310 are compact', () => {
    expect(controlsLayout(375, 550).flag).toEqual({ x: 333, y: 508, size: 44, hitRadius: 32 });
    expect(controlsLayout(375, 550).map).toMatchObject({ x: 333, y: 452, hitRadius: 24 });
    expect(controlsLayout(667, 310).flag).toEqual({ x: 625, y: 268, size: 44, hitRadius: 32 });
    expect(controlsLayout(667, 310).map).toMatchObject({ x: 625, y: 212 });
  });

  it('the compact rule is height <= 520 or width <= 400 (boundaries 520 / 400 in, 521 / 401 out)', () => {
    expect(controlsLayout(1000, 520).compact).toBe(true);
    expect(controlsLayout(1000, 521).compact).toBe(false);
    expect(controlsLayout(400, 900).compact).toBe(true);
    expect(controlsLayout(401, 900).compact).toBe(false);
  });
});

describe('mapView', () => {
  it('390 x 844, band 52, a 23 x 36 floor: area x 16..374, y 60..828; cell 6; the picture 138 x 216 centred', () => {
    const v = mapView(23, 36, 390, 844, 52);

    expect(v.area).toEqual({ left: 16, top: 60, width: 358, height: 768 });
    expect(v.cell).toBe(6);
    expect(v.originX).toBe(126);
    expect(v.originY).toBe(336);
  });

  it('375 x 550, band 52, 23 x 36: area 343 x 474; fit 13.17 is capped at 6', () => {
    const v = mapView(23, 36, 375, 550, 52);

    expect(v.area).toEqual({ left: 16, top: 60, width: 343, height: 474 });
    expect(v.cell).toBe(MAP_CELL_MAX);
    // 23 x 36 cells of 6 px = 138 x 216 px, centred: 16 + (343 - 138) / 2 and 60 + (474 - 216) / 2.
    expect(v.originX).toBe(118.5);
    expect(v.originY).toBe(189);
  });

  it('a 110 x 120 floor on 375 x 550 is not capped: cell = min(343 / 110, 474 / 120), and it fits the area', () => {
    const v = mapView(110, 120, 375, 550, 52);

    expect(v.cell).toBeCloseTo(343 / 110, 10);
    expect(v.cell).toBeLessThan(6);
    expect(v.originX).toBeGreaterThanOrEqual(v.area.left);
    expect(v.originX + 110 * v.cell).toBeLessThanOrEqual(v.area.left + v.area.width + 1e-9);
    expect(v.originY + 120 * v.cell).toBeLessThanOrEqual(v.area.top + v.area.height + 1e-9);
  });

  it('a screen too small for the margins still gives a 1 px area (never zero or negative)', () => {
    const v = mapView(10, 10, 20, 40, 30);

    expect(v.area.width).toBe(1);
    expect(v.area.height).toBe(1);
    expect(v.cell).toBeCloseTo(0.1, 10);
  });

  it('a 1 x 1 floor is still at most MapCellMax per cell, and a taller HUD band moves the area down', () => {
    expect(mapView(1, 1, 390, 844, 52).cell).toBe(6);
    expect(mapView(23, 36, 390, 844, 90).area.top).toBe(98);
  });
});

// A small floor: room A (1,0) 8x8 with doors A1 (7,2) E and A2 (3,7) S; room B (15,1) 8x8 with entry (0,1) W.
const room = (width: number, height: number, doors: StageDoor[], extra: Partial<Stage> = {}): Stage =>
  ({ width, height, doors, start: { x: 0, y: 0 }, goal: { x: 0, y: 0 }, ...extra }) as unknown as Stage;

const A = room(8, 8, [{ cell: { x: 7, y: 2 }, side: 'E' }, { cell: { x: 3, y: 7 }, side: 'S' }], {
  start: { x: 1, y: 1 },
  goalKind: 'door',
  startKind: 'up'
});
const B = room(8, 8, [{ cell: { x: 0, y: 1 }, side: 'W' }], { start: { x: 0, y: 1 }, goal: { x: 5, y: 4 }, goalKind: 'down' });
const C = room(8, 8, [{ cell: { x: 4, y: 0 }, side: 'N' }], { start: { x: 4, y: 0 }, goalKind: 'none' });
const graph: FloorGraph = {
  startRoom: 0,
  corridors: [
    { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
    { from: { room: 0, door: 1 }, to: { room: 2, door: 0 } }
  ]
};
const roomOrigin: Position[] = [{ x: 1, y: 0 }, { x: 15, y: 1 }, { x: 0, y: 14 }];
const corridor1: Position[] = [9, 10, 11, 12, 13, 14].map((x) => ({ x, y: 2 }));
const corridor2: Position[] = [8, 9, 10, 11, 12, 13].map((y) => ({ x: 4, y }));
const view: MapView = mapView(23, 36, 390, 844, 52);

describe('mapShapes', () => {
  const base = {
    roomOrigin,
    corridors: [corridor1, corridor2],
    rooms: [A, B, C],
    graph,
    view
  };

  it('at the floor\'s start: room A only (current), no corridor, A1 and A2 as door marks with a line and a "?", ▲ and the dot', () => {
    const s = mapShapes({ ...base, entered: [true, false, false], walked: [false, false], current: 0, player: { x: 2, y: 1 } });

    expect(s.rooms).toEqual([{ x: 132, y: 336, width: 48, height: 48, current: true }]);
    expect(s.corridors).toEqual([]);
    expect(s.doors).toEqual([{ x: 177, y: 348, size: 6 }, { x: 150, y: 381, size: 6 }]);
    expect(s.stubs).toEqual([
      { x1: 180, y1: 351, x2: 192, y2: 351, thickness: 6, qx: 195, qy: 351 },
      { x1: 153, y1: 384, x2: 153, y2: 396, thickness: 6, qx: 153, qy: 399 }
    ]);
    expect(s.stairs).toEqual([{ x: 141, y: 345, glyph: '▲' }]);
    expect(s.player).toEqual({ x: 141, y: 345, size: 6 });
  });

  it('after A1 was walked and B entered: both rooms, corridor 1 squares, no line on A1 / B\'s entry, B current, ▼ shown', () => {
    const s = mapShapes({ ...base, entered: [true, true, false], walked: [true, false], current: 1, player: { x: 15, y: 2 } });

    expect(s.rooms).toEqual([
      { x: 132, y: 336, width: 48, height: 48, current: false },
      { x: 216, y: 342, width: 48, height: 48, current: true }
    ]);
    expect(s.corridors).toHaveLength(6);
    expect(s.corridors[0]).toEqual({ x: 180, y: 348, size: 6 });
    expect(s.corridors[5]).toEqual({ x: 210, y: 348, size: 6 });
    // Doors: A1, A2, B's entry. Only A2 has no walked corridor, so it keeps its line.
    expect(s.doors).toHaveLength(3);
    expect(s.stubs).toHaveLength(1);
    expect(s.stubs[0]).toMatchObject({ x1: 153, y1: 384, x2: 153, y2: 396, qx: 153, qy: 399 });
    expect(s.stairs).toEqual([{ x: 141, y: 345, glyph: '▲' }, { x: 249, y: 369, glyph: '▼' }]);
  });

  it('draws no room that was not entered, no corridor that was not started, and no ▼ of a room not entered', () => {
    const s = mapShapes({ ...base, entered: [true, false, false], walked: [false, false], current: 0, player: { x: 2, y: 1 } });

    expect(s.rooms).toHaveLength(1);
    expect(s.stairs.map((x) => x.glyph)).toEqual(['▲']);
  });

  it('a dead end (no ▼) shows no ▼ even when entered', () => {
    const s = mapShapes({ ...base, entered: [true, false, true], walked: [false, true], current: 2, player: { x: 4, y: 14 } });

    expect(s.stairs.map((x) => x.glyph)).toEqual(['▲']);
    expect(s.rooms.filter((r) => r.current)).toHaveLength(1);
  });

  it('keeps shapes visible at a tiny scale: corridor and line 2 px, door mark 3 px, dot 4 px', () => {
    const tiny: MapView = { area: { left: 0, top: 0, width: 30, height: 40 }, cell: 1, originX: 0, originY: 0 };
    const s = mapShapes({
      ...base,
      view: tiny,
      entered: [true, true, false],
      walked: [true, false],
      current: 0,
      player: { x: 9, y: 2 }
    });

    expect(new Set(s.corridors.map((c) => c.size))).toEqual(new Set([2]));
    expect(new Set(s.doors.map((d) => d.size))).toEqual(new Set([3]));
    expect(s.stubs[0].thickness).toBe(2);
    expect(s.player.size).toBe(4);
    expect(s.rooms[0]).toMatchObject({ width: 8, height: 8 });
  });

  it('a loop: a door whose loop corridor was not walked has its line on both rooms; once walked it has none', () => {
    const looped: FloorGraph = {
      startRoom: 0,
      corridors: [...graph.corridors, { from: { room: 1, door: 1 }, to: { room: 2, door: 1 } }]
    };
    const bWithLoop = room(8, 8, [{ cell: { x: 0, y: 1 }, side: 'W' }, { cell: { x: 3, y: 7 }, side: 'S' }], { start: { x: 0, y: 1 } });
    const cWithLoop = room(8, 8, [{ cell: { x: 4, y: 0 }, side: 'N' }, { cell: { x: 3, y: 0 }, side: 'N' }], { start: { x: 4, y: 0 } });
    const loopCells = [{ x: 3, y: 10 }];
    const input = {
      roomOrigin,
      corridors: [corridor1, corridor2, loopCells],
      rooms: [A, bWithLoop, cWithLoop],
      graph: looped,
      entered: [true, true, true],
      current: 1,
      player: { x: 15, y: 2 },
      view
    };

    const unwalked = mapShapes({ ...input, walked: [true, true, false] });
    const walked = mapShapes({ ...input, walked: [true, true, true] });

    // B's loop door and C's loop door each have a line; A's two doors and both entries are walked.
    expect(unwalked.stubs).toHaveLength(2);
    expect(walked.stubs).toHaveLength(0);
    expect(walked.corridors).toHaveLength(corridor1.length + corridor2.length + loopCells.length);
  });

  it('draws the line of a door on the north and on the west wall outwards: B (15,1) with an exit (3,0) N and an entry (0,1) W', () => {
    const b = room(8, 8, [{ cell: { x: 0, y: 1 }, side: 'W' }, { cell: { x: 3, y: 0 }, side: 'N' }], { start: { x: 0, y: 1 } });
    const tree: FloorGraph = {
      startRoom: 0,
      corridors: [
        { from: { room: 0, door: 0 }, to: { room: 1, door: 0 } },
        { from: { room: 0, door: 1 }, to: { room: 2, door: 0 } },
        { from: { room: 1, door: 1 }, to: { room: 3, door: 0 } }
      ]
    };
    const at: Position[] = [...roomOrigin, { x: 15, y: -12 }];
    const input = {
      roomOrigin: at,
      corridors: [corridor1, corridor2, [{ x: 18, y: -1 }]],
      rooms: [A, b, C, C],
      graph: tree,
      entered: [true, true, false, false],
      current: 1,
      player: { x: 15, y: 2 },
      view
    };

    // Corridor 1 (A1 - B) was not walked: B's west entry has a line going left (x 216 -> 204, "?" at 201).
    const west = mapShapes({ ...input, walked: [false, false, false] });
    const entry = west.stubs.find((stub) => stub.x1 === 216 && stub.y1 === 351);

    expect(entry).toEqual({ x1: 216, y1: 351, x2: 204, y2: 351, thickness: 6, qx: 201, qy: 351 });
    // Corridor 1 walked, B's north exit not: the line goes up (y 342 -> 330, "?" at 327).
    const north = mapShapes({ ...input, walked: [true, false, false] });

    expect(north.stubs).toContainEqual({ x1: 237, y1: 342, x2: 237, y2: 330, thickness: 6, qx: 237, qy: 327 });
    expect(north.stubs.some((stub) => stub.x1 === 216)).toBe(false);
    // Entering room D alone does not draw room E: only entered rooms are drawn (here C and D are not entered).
    expect(north.rooms).toHaveLength(2);
  });

  it('the dot is on the corridor cell during a walk (a floor cell outside every room)', () => {
    const s = mapShapes({ ...base, entered: [true, false, false], walked: [true, false], current: 0, player: { x: 11, y: 2 } });

    expect(s.player).toEqual({ x: 126 + 11 * 6 + 3, y: 336 + 2 * 6 + 3, size: 6 });
    expect(s.rooms).toHaveLength(1);
    expect(s.rooms[0].current).toBe(true);
  });
});
