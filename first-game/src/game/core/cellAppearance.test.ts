import { describe, expect, it } from 'vitest';
import {
  cellAppearance,
  cellAppearanceKey,
  cellStateOf,
  changedCellIndices,
  glyphKey,
  HIGHLIGHT_FILL_ALPHA,
  HIGHLIGHT_STROKE,
  HIGHLIGHT_STROKE_ALPHA,
  MIN_FONT_PX,
  PLAYER_MARK_CENTER,
  PLAYER_MARK_SIZE,
  PLAYER_MARK_STROKE,
  sameBoardShape,
  scaledDimension,
  scaledFont,
  scaledShape,
  shapeKey,
  type CellGlyph,
  type CellKnowledge,
  type CellState
} from './cellAppearance';
import type { LogicalAnalysis } from './solver';
import type { Cell, Stage } from './types';

// docs/spec/board-render.md "マスの見た目の決定" and "マスの見た目": the unchanged rows are the values the view
// drew before the drawing was rewritten (a characterization table); the closed / open fills and the flag figure are
// the values of the spec table, written by hand. A reference model of the rules is compared against every combination.

const state = (over: Partial<CellState> = {}): CellState => ({
  revealed: false,
  hasBomb: false,
  flagged: false,
  hint: 0,
  gameOver: false,
  knowledge: 'none',
  stairs: 'none',
  ...over
});

const glyph = (g: Partial<CellGlyph> & Pick<CellGlyph, 'text' | 'color'>): CellGlyph => ({
  anchor: 'center',
  bold: true,
  size: 16,
  stroke: 0,
  ...g
});

const POLE = { kind: 'rect', points: [8, 5, 2, 18], color: 0xf1f2f6 } as const;
const pennant = (color: number) => ({ kind: 'triangle', points: [10, 5, 20, 11, 10, 17], color }) as const;

describe('cellAppearance: while playing', () => {
  it('a closed cell is the dark fill with no glyph', () => {
    expect(cellAppearance(state())).toEqual({ fill: 0x3d4f63, glyphs: [], shapes: [] });
  });

  it('an open cell with no bombs around is the light fill with no glyph (0 is not written)', () => {
    expect(cellAppearance(state({ revealed: true, hint: 0 }))).toEqual({ fill: 0x243341, glyphs: [], shapes: [] });
  });

  it.each([
    [1, '#4da3ff'],
    [2, '#7bed9f'],
    [3, '#ff6b81'],
    [4, '#70a1ff'],
    [5, '#ff9f43'],
    [6, '#34e7e4'],
    [7, '#f1f2f6'],
    [8, '#ced6e0']
  ])('an open cell with %i bombs around writes the digit in %s, bold 16 with a 3 px outline', (hint, color) => {
    expect(cellAppearance(state({ revealed: true, hint }))).toEqual({
      fill: 0x243341,
      glyphs: [glyph({ text: String(hint), color, size: 16, stroke: 3 })],
      shapes: []
    });
  });

  it('a digit beyond 8 (never on a real board) keeps the old white fallback colour', () => {
    expect(cellAppearance(state({ revealed: true, hint: 9 })).glyphs[0].color).toBe('#ffffff');
  });

  it('a revealed bomb outside game over is red on the light fill', () => {
    expect(cellAppearance(state({ revealed: true, hasBomb: true }))).toEqual({
      fill: 0x243341,
      glyphs: [glyph({ text: '*', color: '#ff3b30', size: 20, stroke: 3 })],
      shapes: []
    });
  });

  it('a flag is a pole and a red pennant (no letter) on the closed fill', () => {
    expect(cellAppearance(state({ flagged: true }))).toEqual({
      fill: 0x3d4f63,
      glyphs: [],
      shapes: [POLE, pennant(0xff6b6b)]
    });
  });
});

describe('cellAppearance: the stairs (docs/spec/board-render.md "マスの見た目")', () => {
  const up = glyph({ text: '▲', color: '#7bed9f', size: 16, stroke: 3 });
  const down = glyph({ text: '▼', color: '#ffa502', size: 16, stroke: 3 });

  it('the start is a revealed cell with a green ▲ in the middle', () => {
    expect(cellAppearance(state({ revealed: true, stairs: 'up' }))).toEqual({ fill: 0x243341, glyphs: [up], shapes: [] });
  });

  it('the goal is a closed cell with an orange ▼, visible from the start', () => {
    expect(cellAppearance(state({ stairs: 'down' }))).toEqual({ fill: 0x3d4f63, glyphs: [down], shapes: [] });
  });

  it('a goal opened by the start\'s chain is an open cell with ▼', () => {
    expect(cellAppearance(state({ revealed: true, stairs: 'down' }))).toEqual({ fill: 0x243341, glyphs: [down], shapes: [] });
  });

  it('a flag on the goal draws only the flag', () => {
    const a = cellAppearance(state({ flagged: true, stairs: 'down' }));
    expect(a.glyphs).toEqual([]);
    expect(a.shapes).toHaveLength(2);
  });

  it('in game over the goal keeps ▼ and the green fill, with no "○"', () => {
    const a = cellAppearance(state({ gameOver: true, knowledge: 'safe', stairs: 'down' }));
    expect(a.fill).toBe(0x0d2b1a);
    expect(a.glyphs).toEqual([down]);
  });

  it('a wrong flag on the goal in game over is the purple flag and the cross, with no ▼', () => {
    const a = cellAppearance(state({ gameOver: true, flagged: true, stairs: 'down' }));
    expect(a.fill).toBe(0x3d1f6e);
    expect(a.glyphs.map((g) => g.text)).toEqual(['×']);
  });
});

describe('cellAppearance: game-over colouring', () => {
  it('a revealed bomb that was certain from the numbers is amber on the amber fill', () => {
    expect(cellAppearance(state({ gameOver: true, revealed: true, hasBomb: true, knowledge: 'bomb' }))).toEqual({
      fill: 0x7d3800,
      glyphs: [glyph({ text: '*', color: '#ffb347', size: 20, stroke: 3 })],
      shapes: []
    });
  });

  it('a revealed bomb that was not certain stays red on the light fill', () => {
    expect(cellAppearance(state({ gameOver: true, revealed: true, hasBomb: true }))).toEqual({
      fill: 0x243341,
      glyphs: [glyph({ text: '*', color: '#ff3b30', size: 20, stroke: 3 })],
      shapes: []
    });
  });

  it('a flag on a safe cell is purple with a cross on the purple fill', () => {
    expect(cellAppearance(state({ gameOver: true, flagged: true }))).toEqual({
      fill: 0x3d1f6e,
      glyphs: [glyph({ text: '×', color: '#a29bfe', size: 18, stroke: 2 })],
      shapes: [POLE, pennant(0xa29bfe)]
    });
  });

  it('a flag on a bomb is an ordinary flag (no cross) on the closed fill', () => {
    expect(cellAppearance(state({ gameOver: true, flagged: true, hasBomb: true }))).toEqual({
      fill: 0x3d4f63,
      glyphs: [],
      shapes: [POLE, pennant(0xff6b6b)]
    });
  });

  it('a closed cell certain to be a bomb gets "!" on the amber fill', () => {
    expect(cellAppearance(state({ gameOver: true, knowledge: 'bomb', hasBomb: true }))).toEqual({
      fill: 0x7d3800,
      glyphs: [glyph({ text: '!', color: '#ffb347', size: 16, stroke: 0 })],
      shapes: []
    });
  });

  it('a closed cell certain to be safe gets a regular-weight "○" 12 on the green fill', () => {
    expect(cellAppearance(state({ gameOver: true, knowledge: 'safe' }))).toEqual({
      fill: 0x0d2b1a,
      glyphs: [glyph({ text: '○', color: '#7bed9f', bold: false, size: 12, stroke: 0 })],
      shapes: []
    });
  });

  it('a flagged cell certain to be a bomb keeps its flag and the amber fill but gets no "!"', () => {
    const a = cellAppearance(state({ gameOver: true, flagged: true, hasBomb: true, knowledge: 'bomb' }));
    expect(a.fill).toBe(0x7d3800);
    expect(a.glyphs).toEqual([]);
    expect(a.shapes).toEqual([POLE, pennant(0xff6b6b)]);
  });

  it('a wrong flag wins over "certain safe": purple fill, flag and cross, no "○"', () => {
    const a = cellAppearance(state({ gameOver: true, flagged: true, knowledge: 'safe' }));
    expect(a.fill).toBe(0x3d1f6e);
    expect(a.glyphs.map((g) => g.text)).toEqual(['×']);
    expect(a.shapes).toEqual([POLE, pennant(0xa29bfe)]);
  });

  it('an open number keeps its digit and light fill in game over', () => {
    expect(cellAppearance(state({ gameOver: true, revealed: true, hint: 3 }))).toEqual({
      fill: 0x243341,
      glyphs: [glyph({ text: '3', color: '#ff6b81', size: 16, stroke: 3 })],
      shapes: []
    });
  });
});

/**
 * The drawing's rules (createCellLayer / cellFillColor of `first-game/src/game/scenes/boardView.ts` at commit
 * c97c0df, with the closed / open fills and the flag figure of docs/spec/board-render.md "マスの見た目"),
 * transcribed as an independent reference.
 */
const referenceFill = (s: CellState): number => {
  if (s.gameOver) {
    if (s.hasBomb && s.revealed) {
      return s.knowledge === 'bomb' ? 0x7d3800 : 0x243341;
    }
    if (!s.revealed) {
      if (s.flagged && !s.hasBomb) return 0x3d1f6e;
      if (s.knowledge === 'bomb') return 0x7d3800;
      if (s.knowledge === 'safe') return 0x0d2b1a;
    }
  }
  return s.revealed ? 0x243341 : 0x3d4f63;
};

const REFERENCE_HINT_COLORS = ['', '#4da3ff', '#7bed9f', '#ff6b81', '#70a1ff', '#ff9f43', '#34e7e4', '#f1f2f6', '#ced6e0'];

const referenceGlyphs = (s: CellState): CellGlyph[] => {
  const out: CellGlyph[] = [];
  if (s.hasBomb && s.revealed) {
    out.push({ text: '*', anchor: 'center', color: s.gameOver && s.knowledge === 'bomb' ? '#ffb347' : '#ff3b30', bold: true, size: 20, stroke: 3 });
  }
  if (!s.hasBomb && s.revealed && s.hint !== 0) {
    out.push({ text: String(s.hint), anchor: 'center', color: REFERENCE_HINT_COLORS[s.hint], bold: true, size: 16, stroke: 3 });
  }
  if (s.flagged) {
    const wrong = s.gameOver && !s.hasBomb;
    if (wrong) out.push({ text: '×', anchor: 'center', color: '#a29bfe', bold: true, size: 18, stroke: 2 });
  }
  if (s.stairs === 'up' || (s.stairs === 'down' && !s.flagged)) {
    out.push({ text: s.stairs === 'up' ? '▲' : '▼', anchor: 'center', color: s.stairs === 'up' ? '#7bed9f' : '#ffa502', bold: true, size: 16, stroke: 3 });
  }
  if (s.gameOver && !s.revealed && !s.flagged && s.stairs !== 'down') {
    if (s.knowledge === 'bomb') out.push({ text: '!', anchor: 'center', color: '#ffb347', bold: true, size: 16, stroke: 0 });
    else if (s.knowledge === 'safe') out.push({ text: '○', anchor: 'center', color: '#7bed9f', bold: false, size: 12, stroke: 0 });
  }
  return out;
};

const referenceShapes = (s: CellState): unknown[] =>
  s.flagged
    ? [
        { kind: 'rect', points: [8, 5, 2, 18], color: 0xf1f2f6 },
        { kind: 'triangle', points: [10, 5, 20, 11, 10, 17], color: s.gameOver && !s.hasBomb ? 0xa29bfe : 0xff6b6b }
      ]
    : [];

describe('cellAppearance: every combination against the rules', () => {
  const knowledges: CellKnowledge[] = ['none', 'bomb', 'safe'];
  const states: CellState[] = [];
  let excluded = 0;
  for (const revealed of [false, true]) {
    for (const hasBomb of [false, true]) {
      for (const flagged of [false, true]) {
        for (let hint = 0; hint <= 8; hint += 1) {
          for (const gameOver of [false, true]) {
            for (const knowledge of knowledges) {
              // Without the game-over analysis nothing is certain: only `none` can occur.
              if (!gameOver && knowledge !== 'none') {
                excluded += 1;
                continue;
              }
              for (const stairs of ['none', 'up', 'down'] as const) {
                states.push({ revealed, hasBomb, flagged, hint, gameOver, knowledge, stairs });
              }
            }
          }
        }
      }
    }
  }

  it('the enumeration keeps every possible state: kept + excluded is all combinations', () => {
    expect(states.length).toBe(2 * 2 * 2 * 9 * (3 + 1) * 3);
    expect(excluded).toBe(2 * 2 * 2 * 9 * 2);
    expect(states.length + excluded * 3).toBe(2 * 2 * 2 * 9 * 2 * 3 * 3);
  });

  it('fill, every attribute of every glyph, and the figures equal the reference for all states', () => {
    const fills = new Set<number>();
    let withGlyph = 0;
    let withTwoGlyphs = 0;
    for (const s of states) {
      const a = cellAppearance(s);
      if (a.fill !== referenceFill(s)) expect.fail(`fill differs for ${JSON.stringify(s)}`);
      if (JSON.stringify(a.glyphs) !== JSON.stringify(referenceGlyphs(s))) {
        expect.fail(`glyphs differ for ${JSON.stringify(s)}: ${JSON.stringify(a.glyphs)} vs ${JSON.stringify(referenceGlyphs(s))}`);
      }
      if (JSON.stringify(a.shapes) !== JSON.stringify(referenceShapes(s))) {
        expect.fail(`shapes differ for ${JSON.stringify(s)}`);
      }
      fills.add(a.fill);
      if (a.glyphs.length > 0) withGlyph += 1;
      if (a.glyphs.length > 1) withTwoGlyphs += 1;
    }
    expect([...fills].sort()).toEqual([0x0d2b1a, 0x3d4f63, 0x243341, 0x3d1f6e, 0x7d3800].sort());
    expect(withGlyph).toBeGreaterThan(100);
    expect(withTwoGlyphs).toBeGreaterThan(0);
  });

  it('the key is equal exactly when the appearance is equal', () => {
    const byKey = new Map<string, string>();
    for (const s of states) {
      const a = cellAppearance(s);
      const key = cellAppearanceKey(a);
      const json = JSON.stringify(a);
      const seen = byKey.get(key);
      if (seen !== undefined && seen !== json) expect.fail(`key ${key} is shared by different appearances`);
      byKey.set(key, json);
    }
    expect(byKey.size).toBe(new Set(byKey.values()).size);
    expect(byKey.size).toBeGreaterThan(20);
  });
});

describe('glyphKey', () => {
  const base: CellGlyph = { text: '1', anchor: 'center', color: '#4da3ff', bold: true, size: 16, stroke: 3 };

  it('is equal for equal glyph looks and differs when any field differs', () => {
    expect(glyphKey({ ...base })).toBe(glyphKey(base));
    for (const change of [
      { text: '2' }, { color: '#000000' }, { bold: false }, { size: 12 }, { stroke: 2 }
    ]) {
      expect(glyphKey({ ...base, ...change })).not.toBe(glyphKey(base));
    }
  });
});

describe('shapeKey', () => {
  it('is equal for equal figures and differs when the kind, a point or the colour differs', () => {
    const a = { kind: 'triangle', points: [10, 5, 20, 11, 10, 17], color: 0xff6b6b } as const;
    expect(shapeKey({ ...a })).toBe(shapeKey(a));
    expect(shapeKey({ ...a, kind: 'rect' })).not.toBe(shapeKey(a));
    expect(shapeKey({ ...a, points: [10, 5, 20, 11, 10, 18] })).not.toBe(shapeKey(a));
    expect(shapeKey({ ...a, color: 0xa29bfe })).not.toBe(shapeKey(a));
  });
});

describe('the player marks', () => {
  it('has the spec values: a 14 px mark with a 2 px outline centred at (6, 7), a 3 px frame at 0.95 and a 0.4 fill', () => {
    expect(PLAYER_MARK_SIZE).toBe(14);
    expect(PLAYER_MARK_STROKE).toBe(2);
    expect(PLAYER_MARK_CENTER).toEqual({ x: 6, y: 7 });
    expect(HIGHLIGHT_STROKE).toBe(3);
    expect(HIGHLIGHT_STROKE_ALPHA).toBe(0.95);
    expect(HIGHLIGHT_FILL_ALPHA).toBe(0.4);
  });
});

describe('cellAppearanceKey', () => {
  it('is equal for equal appearances and differs when the fill, a colour or a glyph differs', () => {
    const a = cellAppearance(state({ revealed: true, hint: 2 }));
    const same = cellAppearance(state({ revealed: true, hint: 2 }));
    expect(cellAppearanceKey(a)).toBe(cellAppearanceKey(same));
    expect(cellAppearanceKey(a)).not.toBe(cellAppearanceKey(cellAppearance(state({ revealed: true, hint: 3 }))));
    expect(cellAppearanceKey(a)).not.toBe(cellAppearanceKey(cellAppearance(state())));
    expect(cellAppearanceKey(cellAppearance(state({ gameOver: true, revealed: true, hasBomb: true }))))
      .not.toBe(cellAppearanceKey(cellAppearance(state({ gameOver: true, revealed: true, hasBomb: true, knowledge: 'bomb' }))));
  });
});

const makeStage = (cells: Array<Partial<Cell>>, width = cells.length): Stage => ({
  width,
  height: cells.length / width,
  stageNo: 5,
  cells: cells.map((c) => ({ hasBomb: false, flagged: false, revealed: false, hint: 0, ...c })),
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  goal: { x: width - 1, y: 0 },
  generation: { retries: 0, depthTarget: 0, solverDepth: 0, generationMs: 0 }
});

describe('cellStateOf', () => {
  const stage = makeStage([
    { revealed: true, hint: 2 },
    { hasBomb: true, flagged: true },
    { hint: 1 }
  ]);

  it('without an analysis, copies the cell and is not game over', () => {
    expect(cellStateOf(stage, 0)).toEqual({ revealed: true, hasBomb: false, flagged: false, hint: 2, gameOver: false, knowledge: 'none', stairs: 'up' });
    expect(cellStateOf(stage, 1)).toEqual({ revealed: false, hasBomb: true, flagged: true, hint: 0, gameOver: false, knowledge: 'none', stairs: 'none' });
    expect(cellStateOf(stage, 2).stairs).toBe('down');
  });

  it('finds the stairs by row and column, not by the transposed index (width 4: start (1, 0) is index 1, goal (3, 1) is index 7)', () => {
    const wide = makeStage(new Array(8).fill({}), 4);
    wide.start = { x: 1, y: 0 };
    wide.goal = { x: 3, y: 1 };
    expect(cellStateOf(wide, 1).stairs).toBe('up');
    expect(cellStateOf(wide, 7).stairs).toBe('down');
    expect(cellStateOf(wide, 4).stairs).toBe('none');
  });

  it('with an analysis, reports bomb / safe / none by index and is game over', () => {
    const logical: LogicalAnalysis = { knownBombs: new Set([1]), knownSafe: new Set([2]) };
    expect(cellStateOf(stage, 0, logical).knowledge).toBe('none');
    expect(cellStateOf(stage, 1, logical).knowledge).toBe('bomb');
    expect(cellStateOf(stage, 2, logical).knowledge).toBe('safe');
    expect(cellStateOf(stage, 0, logical).gameOver).toBe(true);
  });

  it('a cell listed as both a known bomb and a known safe cell is a bomb (the previous drawing checked bombs first)', () => {
    const both: LogicalAnalysis = { knownBombs: new Set([2]), knownSafe: new Set([2]) };
    expect(cellStateOf(stage, 2, both).knowledge).toBe('bomb');
  });

  it('an empty analysis is still game over, with nothing certain', () => {
    const none: LogicalAnalysis = { knownBombs: new Set(), knownSafe: new Set() };
    expect(cellStateOf(stage, 2, none)).toMatchObject({ gameOver: true, knowledge: 'none' });
  });
});

describe('changedCellIndices (the cells the view updates)', () => {
  const keysOf = (stage: Stage, logical?: LogicalAnalysis): string[] =>
    stage.cells.map((_c, idx) => cellAppearanceKey(cellAppearance(cellStateOf(stage, idx, logical))));

  // 3 x 2 board, indices 0 1 2 / 3 4 5; the numbers below are counted by hand from the cell edits.
  const before = (): Stage => makeStage([{}, {}, { hasBomb: true }, {}, {}, {}], 3);

  it('before anything is drawn (no keys) every cell is changed', () => {
    expect(changedCellIndices([], before())).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('an unchanged board has no changed cell', () => {
    const stage = before();
    expect(changedCellIndices(keysOf(stage), stage)).toEqual([]);
  });

  it('a move that opens one cell with a number changes only that cell', () => {
    const prev = before();
    const keys = keysOf(prev);
    const next = before();
    next.cells[4] = { ...next.cells[4], revealed: true, hint: 1 };
    expect(changedCellIndices(keys, next)).toEqual([4]);
  });

  it('a zero cell that opens its neighbours changes the cell and each opened neighbour, and nothing else', () => {
    const prev = before();
    const keys = keysOf(prev);
    const next = before();
    for (const idx of [3, 4, 0, 1]) next.cells[idx] = { ...next.cells[idx], revealed: true, hint: idx === 1 ? 1 : 0 };
    expect(changedCellIndices(keys, next)).toEqual([0, 1, 3, 4]);
  });

  it('placing a flag changes that cell; removing it changes it back', () => {
    const prev = before();
    const flagged = before();
    flagged.cells[5] = { ...flagged.cells[5], flagged: true };
    expect(changedCellIndices(keysOf(prev), flagged)).toEqual([5]);
    expect(changedCellIndices(keysOf(flagged), prev)).toEqual([5]);
  });

  it('a hint number that stays the same on an already open cell is not changed (a move onto an open cell)', () => {
    const prev = before();
    prev.cells[0] = { ...prev.cells[0], revealed: true, hint: 2 };
    const next = before();
    next.cells[0] = { ...next.cells[0], revealed: true, hint: 2 };
    next.player = { x: 1, y: 0 };
    expect(changedCellIndices(keysOf(prev), next)).toEqual([]);
  });

  it('the game-over colouring changes the bombs, the certain cells and the wrong flags, not the open numbers', () => {
    const playing = before();
    playing.cells[0] = { ...playing.cells[0], revealed: true, hint: 1 }; // an open number
    playing.cells[3] = { ...playing.cells[3], flagged: true }; // a flag on a safe cell: wrong
    const over = before();
    over.cells[0] = { ...over.cells[0], revealed: true, hint: 1 };
    over.cells[3] = { ...over.cells[3], flagged: true };
    over.cells[2] = { ...over.cells[2], revealed: true }; // the bomb is shown
    const logical: LogicalAnalysis = { knownBombs: new Set([2]), knownSafe: new Set([4]) };
    // 2: bomb shown; 3: wrong flag (purple, cross); 4: certain safe ("○"); 0 and 1, 5 do not change
    expect(changedCellIndices(keysOf(playing), over, logical)).toEqual([2, 3, 4]);
  });
});

describe('sameBoardShape', () => {
  const base = { width: 8, height: 9, start: { x: 0, y: 4 }, goal: { x: 7, y: 4 } };

  it('is true for the same size and markers, whatever else differs', () => {
    expect(sameBoardShape(base, { ...base, start: { ...base.start }, goal: { ...base.goal } })).toBe(true);
    // extra fields (a whole Stage has a stage number, cells ...) are not compared
    expect(sameBoardShape(base, { ...base, stageNo: 3, cells: [] } as typeof base)).toBe(true);
  });

  it.each([
    ['width', { width: 9 }],
    ['height', { height: 10 }],
    ['start x', { start: { x: 1, y: 4 } }],
    ['start y', { start: { x: 0, y: 3 } }],
    ['goal x', { goal: { x: 6, y: 4 } }],
    ['goal y', { goal: { x: 7, y: 5 } }]
  ])('is false when only the %s differs', (_name, change) => {
    expect(sameBoardShape(base, { ...base, ...change })).toBe(false);
  });
});

describe('scaling to a smaller cell (reference cell 30)', () => {
  it('the reference cell is the identity', () => {
    expect(scaledDimension(28, 30)).toBe(28);
    expect(scaledDimension(3, 30)).toBe(3);
    expect(scaledFont(16, 30)).toBe(16);
    expect(scaledFont(20, 30)).toBe(20);
  });

  it('a dimension scales by cell / 30 and rounds to the nearest pixel', () => {
    expect(scaledDimension(20, 15)).toBe(10); // 20 * 15 / 30 = 10
    expect(scaledDimension(3, 20)).toBe(2); // 2.0
    expect(scaledDimension(3, 14)).toBe(1); // 1.4 -> 1
    expect(scaledDimension(5, 21)).toBe(4); // 3.5 -> 4 (round half up)
  });

  it('a dimension is never under 1 px', () => {
    expect(scaledDimension(3, 10)).toBe(1); // 1.0
    expect(scaledDimension(2, 10)).toBe(1); // 0.67 -> 1
    expect(scaledDimension(1, 1)).toBe(1); // 0.03 -> 0 -> 1
  });

  it('a font is never under the minimum readable size', () => {
    expect(MIN_FONT_PX).toBe(8);
    expect(scaledFont(12, 10)).toBe(8); // 4 -> 8
    expect(scaledFont(20, 10)).toBe(8); // 6.67 -> 7 -> 8
    expect(scaledFont(16, 20)).toBe(11); // 10.67 -> 11, above the minimum
    expect(scaledFont(20, 14)).toBe(9); // 9.33 -> 9
  });
});

describe('scaledShape (the flag at the demo and game cell sizes)', () => {
  const pole = { kind: 'rect', points: [8, 5, 2, 18], color: 0xf1f2f6 } as const;
  const pennant = { kind: 'triangle', points: [10, 5, 20, 11, 10, 17], color: 0xff6b6b } as const;

  it('at the reference cell (30 px) keeps every coordinate', () => {
    expect(scaledShape(pole, 30).points).toEqual([8, 5, 2, 18]);
    expect(scaledShape(pennant, 30).points).toEqual([10, 5, 20, 11, 10, 17]);
  });

  it('at a 15 px cell halves every coordinate and keeps them fractional: the pole is (4, 2.5, 1 x 9)', () => {
    expect(scaledShape(pole, 15).points).toEqual([4, 2.5, 1, 9]);
    expect(scaledShape(pennant, 15).points).toEqual([5, 2.5, 10, 5.5, 5, 8.5]);
  });

  it('never makes the pole thinner than one pixel, however small the cell', () => {
    expect(scaledShape(pole, 8).points[2]).toBe(1);
    expect(scaledShape(pole, 3).points[2]).toBe(1);
    // the pennant has no such floor
    expect(scaledShape(pennant, 3).points[2]).toBeCloseTo(2, 6);
  });

  it('keeps the kind and the colour', () => {
    expect(scaledShape(pennant, 15)).toMatchObject({ kind: 'triangle', color: 0xff6b6b });
  });
});
