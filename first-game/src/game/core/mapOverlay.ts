import { corridorFrom, type FloorGraph } from './floorGraph';
import { HEADING_VECTOR } from './floorLayout';
import type { FlowPhase } from './flow';
import type { Position, Stage } from './types';
import { roomDoors } from './walls';

// The floor map (docs/spec/floor-map.md): pure parts. Nothing here knows Phaser.

/** How long the map is fully visible, and how long it then takes to fade out (ms, from the press). */
export const MAP_HOLD_MS = 1500;
export const MAP_FADE_MS = 500;
/** The biggest size of one floor cell on the map (px). */
export const MAP_CELL_MAX = 6;
/** The map's area: the side and bottom margins, and the gap below the HUD band (px). */
export const MAP_SIDE_MARGIN = 16;
export const MAP_BOTTOM_MARGIN = 16;
export const MAP_TOP_GAP = 8;
/** The thinnest a corridor or line is drawn, and the size of a door mark and of the player's dot (px). */
export const MAP_MIN_STROKE = 2;
export const MAP_DOOR_MARK_MIN = 3;
export const MAP_PLAYER_DOT_MIN = 4;
/** An unwalked door's line is this many cells long; its "?" sits 2.5 cells out. */
export const MAP_STUB_CELLS = 2;
export const MAP_QUESTION_CELLS = 2.5;
/** Gap between the MAP circle and the FLAG circle, and the hit area's margin beyond the circle (px). */
export const MAP_BUTTON_GAP = 12;
export const MAP_BUTTON_HIT_MARGIN = 2;

/** The map's opacity `elapsedMs` after it was shown: 1 while held, then a straight fade to 0; `null` once it is gone. */
export const mapAlpha = (elapsedMs: number): number | null => {
  if (elapsedMs < MAP_HOLD_MS) {
    return 1;
  }
  if (elapsedMs >= MAP_HOLD_MS + MAP_FADE_MS) {
    return null;
  }
  return 1 - (elapsedMs - MAP_HOLD_MS) / MAP_FADE_MS;
};

/** The map takes input in play and while a corridor is walked; in every other phase it does not. */
export const mapAccepted = (phase: FlowPhase): boolean => phase === 'play' || phase === 'corridor';

/** The M key shows the map: not a held key's repeat, and not with Ctrl, Alt or Meta (Shift is fine). */
export const mapKeyPressed = (
  code: string,
  repeat: boolean,
  modifiers: { ctrlKey: boolean; altKey: boolean; metaKey: boolean }
): boolean => code === 'KeyM' && !repeat && !modifiers.ctrlKey && !modifiers.altKey && !modifiers.metaKey;

/** The FLAG circle and the MAP circle above it, for a screen of `width` x `height` (px). */
export type ControlsLayout = {
  compact: boolean;
  flag: { x: number; y: number; size: number; hitRadius: number };
  map: { x: number; y: number; size: number; hitRadius: number };
};

/** Distance of the round controls (and the pad, and STAGE) from the screen edge (px). */
export const CONTROL_MARGIN = 20;
/** FLAG's hit circle reaches this far beyond its drawn circle (px). */
export const FLAG_HIT_MARGIN = 10;

export const controlsLayout = (width: number, height: number): ControlsLayout => {
  const compact = height <= 520 || width <= 400;
  const size = compact ? 44 : 52;
  const flag = {
    x: width - CONTROL_MARGIN - size / 2,
    y: height - CONTROL_MARGIN - size / 2,
    size,
    hitRadius: size / 2 + FLAG_HIT_MARGIN
  };
  return {
    compact,
    flag,
    map: { x: flag.x, y: flag.y - size - MAP_BUTTON_GAP, size, hitRadius: size / 2 + MAP_BUTTON_HIT_MARGIN }
  };
};

/** Where the map goes on the screen: its area, the size of a floor cell and the screen position of floor cell (0, 0). */
export type MapView = {
  area: { left: number; top: number; width: number; height: number };
  cell: number;
  originX: number;
  originY: number;
};

/**
 * The map's place for a floor of `cols` x `rows` cells on a `screenWidth` x `screenHeight` screen whose HUD band ends
 * at `bandBottom`: the area below the band, `cell = min(MAP_CELL_MAX, fit)`, centred in the area.
 */
export const mapView = (
  cols: number,
  rows: number,
  screenWidth: number,
  screenHeight: number,
  bandBottom: number
): MapView => {
  const left = MAP_SIDE_MARGIN;
  const top = bandBottom + MAP_TOP_GAP;
  const width = Math.max(1, screenWidth - MAP_SIDE_MARGIN * 2);
  const height = Math.max(1, screenHeight - MAP_BOTTOM_MARGIN - top);
  const cell = Math.min(MAP_CELL_MAX, Math.min(width / cols, height / rows));
  return {
    area: { left, top, width, height },
    cell,
    originX: left + (width - cols * cell) / 2,
    originY: top + (height - rows * cell) / 2
  };
};

export type MapInput = {
  /** The floor's placement: each room's top-left cell, each corridor's cells (loops after the tree's). */
  roomOrigin: readonly Position[];
  corridors: readonly (readonly Position[])[];
  rooms: readonly Stage[];
  graph: FloorGraph;
  /** Which rooms the player has entered and which corridors they have started to walk. */
  entered: readonly boolean[];
  walked: readonly boolean[];
  /** The room the player is in (the one left, during a walk) and the player's cell on the floor's grid. */
  current: number;
  player: Position;
  view: MapView;
};

export type MapShapes = {
  rooms: { x: number; y: number; width: number; height: number; current: boolean }[];
  /** Top-left and side of a square. */
  corridors: { x: number; y: number; size: number }[];
  doors: { x: number; y: number; size: number }[];
  /** A line from (x1, y1) to (x2, y2) and the centre of its "?". */
  stubs: { x1: number; y1: number; x2: number; y2: number; thickness: number; qx: number; qy: number }[];
  stairs: { x: number; y: number; glyph: '▲' | '▼' }[];
  player: { x: number; y: number; size: number };
};

/** What to draw (screen px) for the floor so far (docs/spec/floor-map.md "描くもの"). */
export const mapShapes = (input: MapInput): MapShapes => {
  const { view, roomOrigin, rooms, graph } = input;
  const c = view.cell;
  const sx = (gx: number): number => view.originX + gx * c;
  const sy = (gy: number): number => view.originY + gy * c;
  const stroke = Math.max(c, MAP_MIN_STROKE);
  const result: MapShapes = { rooms: [], corridors: [], doors: [], stubs: [], stairs: [], player: { x: 0, y: 0, size: 0 } };

  rooms.forEach((room, index) => {
    if (!input.entered[index]) {
      return;
    }
    const origin = roomOrigin[index];
    result.rooms.push({
      x: sx(origin.x),
      y: sy(origin.y),
      width: room.width * c,
      height: room.height * c,
      current: index === input.current
    });
  });

  input.corridors.forEach((cells, k) => {
    if (!input.walked[k]) {
      return;
    }
    for (const cell of cells) {
      const cx = sx(cell.x + 0.5);
      const cy = sy(cell.y + 0.5);
      result.corridors.push({ x: cx - stroke / 2, y: cy - stroke / 2, size: stroke });
    }
  });

  const doorSize = Math.max(c, MAP_DOOR_MARK_MIN);
  rooms.forEach((room, index) => {
    if (!input.entered[index]) {
      return;
    }
    const origin = roomOrigin[index];
    roomDoors(room).forEach((door, doorIndex) => {
      const d = HEADING_VECTOR[door.side];
      const gx = origin.x + door.cell.x + 0.5 + d.x * 0.5;
      const gy = origin.y + door.cell.y + 0.5 + d.y * 0.5;
      result.doors.push({ x: sx(gx) - doorSize / 2, y: sy(gy) - doorSize / 2, size: doorSize });
      const walk = corridorFrom(graph, { room: index, door: doorIndex });
      if (walk && !input.walked[walk.corridor]) {
        result.stubs.push({
          x1: sx(gx),
          y1: sy(gy),
          x2: sx(gx + d.x * MAP_STUB_CELLS),
          y2: sy(gy + d.y * MAP_STUB_CELLS),
          thickness: stroke,
          qx: sx(gx + d.x * MAP_QUESTION_CELLS),
          qy: sy(gy + d.y * MAP_QUESTION_CELLS)
        });
      }
    });
  });

  const startRoom = graph.startRoom;
  if (input.entered[startRoom]) {
    const at = rooms[startRoom].start;
    result.stairs.push({
      x: sx(roomOrigin[startRoom].x + at.x + 0.5),
      y: sy(roomOrigin[startRoom].y + at.y + 0.5),
      glyph: '▲'
    });
  }
  rooms.forEach((room, index) => {
    if (input.entered[index] && room.goalKind === 'down') {
      result.stairs.push({
        x: sx(roomOrigin[index].x + room.goal.x + 0.5),
        y: sy(roomOrigin[index].y + room.goal.y + 0.5),
        glyph: '▼'
      });
    }
  });

  result.player = {
    x: sx(input.player.x + 0.5),
    y: sy(input.player.y + 0.5),
    size: Math.max(c, MAP_PLAYER_DOT_MIN)
  };
  return result;
};
