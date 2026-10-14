import { describe, expect, it } from 'vitest';
import { cellAppearance, cellStateOf, DOOR_COLOR, sameBoardShape } from './cellAppearance';
import type { Stage } from './types';

// docs/spec/board-render.md: a door cell (the cell next to a door) is an ordinary cell with no stairs glyph;
// the "+" is drawn on the wall (core/walls). The door's colour is `#74b9ff`.
const makeStage = (over: Partial<Stage>): Stage => ({
  width: 4,
  height: 3,
  stageNo: 1,
  player: { x: 1, y: 1 },
  start: { x: 1, y: 1 },
  goal: { x: 3, y: 2 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 12 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 })),
  ...over
});

describe('cellStateOf for rooms with a door', () => {
  it('room A: the start is the up-stairs and the door cell (the goal) has no stairs', () => {
    const stage = makeStage({ startKind: 'up', goalKind: 'door', doorSide: 'E' });

    expect(cellStateOf(stage, 5).stairs).toBe('up');
    expect(cellStateOf(stage, 11).stairs).toBe('none');
  });

  it('room B: the entry cell (the start) has no stairs and the goal is the down-stairs', () => {
    const stage = makeStage({ startKind: 'door', goalKind: 'down', doorSide: 'W' });

    expect(cellStateOf(stage, 5).stairs).toBe('none');
    expect(cellStateOf(stage, 11).stairs).toBe('down');
  });

  it('a stage that says nothing about kinds keeps the up- and down-stairs', () => {
    const stage = makeStage({});

    expect(cellStateOf(stage, 5).stairs).toBe('up');
    expect(cellStateOf(stage, 11).stairs).toBe('down');
  });

  it('draws the door cell as a plain cell: no glyph, the closed or the opened fill', () => {
    const stage = makeStage({ startKind: 'up', goalKind: 'door', doorSide: 'E' });
    const closed = cellAppearance(cellStateOf(stage, 11));
    stage.cells[11].revealed = true;
    const opened = cellAppearance(cellStateOf(stage, 11));

    expect(closed).toEqual({ fill: 0x3d4f63, glyphs: [], shapes: [] });
    expect(opened.fill).toBe(0x243341);
    expect(opened.glyphs).toEqual([]);
  });

  it('uses the colour of the spec for the door\'s "+"', () => {
    expect(DOOR_COLOR).toBe('#74b9ff');
  });
});

describe('sameBoardShape for doors', () => {
  const a = {
    width: 4, height: 3, start: { x: 1, y: 1 }, goal: { x: 3, y: 2 }, startKind: 'up', goalKind: 'door', doorSide: 'E'
  } as const;

  it('is the same board for the same room, and another when the kinds or the wall of the door differ (the walls are drawn again)', () => {
    expect(sameBoardShape(a, { ...a })).toBe(true);
    expect(sameBoardShape(a, { ...a, startKind: 'door', goalKind: 'down' })).toBe(false);
    expect(sameBoardShape(a, { ...a, doorSide: 'S' })).toBe(false);
  });
});
