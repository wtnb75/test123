// What one cell looks like (docs/spec/board-render.md "マスの見た目の決定"). Pure: no Phaser.
// Dimensions are given at the reference cell size (30 px); the view scales them to its own cell.
import type { LogicalAnalysis } from './solver';
import { REFERENCE_CELL } from './title';
import type { Position, Stage } from './types';

/** Text is never drawn smaller than this (px), also in the smallest demo cell. */
export const MIN_FONT_PX = 8;

/** A dimension given at the reference cell, scaled to a view's `cell` (at least 1 px). */
export const scaledDimension = (value: number, cell: number): number =>
  Math.max(1, Math.round(value * cell / REFERENCE_CELL));

/** A font size scaled like `scaledDimension`, but never under MIN_FONT_PX. */
export const scaledFont = (value: number, cell: number): number => Math.max(MIN_FONT_PX, scaledDimension(value, cell));

export type CellStairs = 'none' | 'up' | 'down';

/** What the game-over analysis says about a cell. `none` is "nothing certain" and also "no analysis". */
export type CellKnowledge = 'bomb' | 'safe' | 'none';

/** What decides whether a drawn board can be updated in place: the same size and the same start / goal. */
export type BoardShape = {
  width: number;
  height: number;
  start: Position;
  goal: Position;
  startKind?: Stage['startKind'];
  goalKind?: Stage['goalKind'];
  doorSide?: Stage['doorSide'];
};

export const sameBoardShape = (a: BoardShape, b: BoardShape): boolean =>
  a.width === b.width &&
  a.height === b.height &&
  a.start.x === b.start.x &&
  a.start.y === b.start.y &&
  a.goal.x === b.goal.x &&
  a.goal.y === b.goal.y &&
  a.startKind === b.startKind &&
  a.goalKind === b.goalKind &&
  a.doorSide === b.doorSide;

const stairsOf = (stage: Stage, idx: number): CellStairs => {
  if (stage.start.y * stage.width + stage.start.x === idx) {
    return stage.startKind === 'door' ? 'none' : 'up';
  }
  if (stage.goal.y * stage.width + stage.goal.x === idx) {
    return stage.goalKind === 'door' ? 'none' : 'down';
  }
  return 'none';
};

/** The state of cell `idx` of `stage`; `logical` is the game-over analysis (none while playing). */
export const cellStateOf = (stage: Stage, idx: number, logical?: LogicalAnalysis): CellState => {
  const cell = stage.cells[idx];
  let knowledge: CellKnowledge = 'none';
  if (logical) {
    if (logical.knownBombs.has(idx)) {
      knowledge = 'bomb';
    } else if (logical.knownSafe.has(idx)) {
      knowledge = 'safe';
    }
  }
  return {
    revealed: cell.revealed,
    hasBomb: cell.hasBomb,
    flagged: cell.flagged,
    hint: cell.hint,
    gameOver: logical != null,
    knowledge,
    stairs: stairsOf(stage, idx)
  };
};

export type CellState = {
  revealed: boolean;
  hasBomb: boolean;
  flagged: boolean;
  /** Number of bombs around the cell (0..8). */
  hint: number;
  /** True while the game-over colouring is shown (the analysis exists). */
  gameOver: boolean;
  knowledge: CellKnowledge;
  /** The up-stairs (the start) or the down-stairs (the goal) stand on this cell (a door cell has none). */
  stairs: CellStairs;
};

export type CellGlyph = {
  text: string;
  /** Glyphs are centred on the cell (the flag is a figure now, see `CellShape`). */
  anchor: 'center';
  color: string;
  bold: boolean;
  /** Font size at the reference cell. */
  size: number;
  /** Outline thickness at the reference cell (0: none). */
  stroke: number;
};

/**
 * A drawn figure (the flag), in reference px from the cell's top-left corner.
 * `rect`: [x, y, width, height]; `triangle`: [x1, y1, x2, y2, x3, y3].
 */
export type CellShape = {
  kind: 'rect' | 'triangle';
  points: number[];
  color: number;
};

export type CellAppearance = {
  fill: number;
  /** Bottom to top. */
  glyphs: CellGlyph[];
  /** Figures, drawn under the glyphs (a wrong flag's "×" goes over its flag). */
  shapes: CellShape[];
};

/** Closed cells are lighter (raised), open ones darker (sunken): the board reads against the 0x0a1f2f background. */
export const COLOR_CLOSED = 0x3d4f63;
export const COLOR_OPEN = 0x243341;
export const COLOR_KNOWN_BOMB = 0x7d3800;
export const COLOR_KNOWN_SAFE = 0x0d2b1a;
export const COLOR_WRONG_FLAG = 0x3d1f6e;

export const HINT_COLORS: Record<number, string> = {
  1: '#4da3ff',
  2: '#7bed9f',
  3: '#ff6b81',
  4: '#70a1ff',
  5: '#ff9f43',
  6: '#34e7e4',
  7: '#f1f2f6',
  8: '#ced6e0'
};

export const GLYPH_OUTLINE_COLOR = '#0b1220';

/** The colours of the stairs glyphs: the up-stairs (the start) and the down-stairs (the goal). */
export const STAIRS_UP_COLOR = '#7bed9f';
export const STAIRS_DOWN_COLOR = '#ffa502';
export const DOOR_COLOR = '#74b9ff';

/** The flag figure at the reference cell: a pole and a pennant (docs/spec/board-render.md "マスの見た目"). */
export const FLAG_POLE_COLOR = 0xf1f2f6;
export const FLAG_COLOR = 0xff6b6b;
export const FLAG_WRONG_COLOR = 0xa29bfe;
export const FLAG_POLE = [8, 5, 2, 18];
export const FLAG_PENNANT = [10, 5, 20, 11, 10, 17];

/** The player's mark ("@") and highlight: the mark's size, outline and centre, and the highlight's frame and fill. */
export const PLAYER_MARK_SIZE = 14;
export const PLAYER_MARK_STROKE = 2;
export const PLAYER_MARK_CENTER = { x: 6, y: 7 };
export const HIGHLIGHT_STROKE = 3;
export const HIGHLIGHT_STROKE_COLOR = 0xdfe4ea;
export const HIGHLIGHT_STROKE_ALPHA = 0.95;
export const HIGHLIGHT_FILL = 0x7fb2ff;
export const HIGHLIGHT_FILL_ALPHA = 0.4;

const fillColor = (s: CellState): number => {
  if (s.gameOver) {
    if (s.hasBomb && s.revealed) {
      // A revealed bomb: amber when it was certain from the numbers, the plain colour otherwise.
      return s.knowledge === 'bomb' ? COLOR_KNOWN_BOMB : COLOR_OPEN;
    }
    if (!s.revealed) {
      if (s.flagged && !s.hasBomb) {
        return COLOR_WRONG_FLAG;
      }
      if (s.knowledge === 'bomb') {
        return COLOR_KNOWN_BOMB;
      }
      if (s.knowledge === 'safe') {
        return COLOR_KNOWN_SAFE;
      }
    }
  }
  return s.revealed ? COLOR_OPEN : COLOR_CLOSED;
};

export const cellAppearance = (s: CellState): CellAppearance => {
  const glyphs: CellGlyph[] = [];
  const shapes: CellShape[] = [];

  if (s.hasBomb && s.revealed) {
    glyphs.push({
      text: '*',
      anchor: 'center',
      color: s.gameOver && s.knowledge === 'bomb' ? '#ffb347' : '#ff3b30',
      bold: true,
      size: 20,
      stroke: 3
    });
  }

  if (!s.hasBomb && s.revealed && s.hint !== 0) {
    glyphs.push({
      text: String(s.hint),
      anchor: 'center',
      color: HINT_COLORS[s.hint] ?? '#ffffff',
      bold: true,
      size: 16,
      stroke: 3
    });
  }

  if (s.flagged) {
    const wrong = s.gameOver && !s.hasBomb;
    shapes.push(
      { kind: 'rect', points: FLAG_POLE, color: FLAG_POLE_COLOR },
      { kind: 'triangle', points: FLAG_PENNANT, color: wrong ? FLAG_WRONG_COLOR : FLAG_COLOR }
    );
    if (wrong) {
      glyphs.push({ text: '×', anchor: 'center', color: '#a29bfe', bold: true, size: 18, stroke: 2 });
    }
  }

  // The stairs: a flag on the down-stairs hides it (only the flag is drawn); the "○" never covers it.
  if (s.stairs === 'up' || (s.stairs === 'down' && !s.flagged)) {
    glyphs.push({
      text: s.stairs === 'up' ? '▲' : '▼',
      anchor: 'center',
      color: s.stairs === 'up' ? STAIRS_UP_COLOR : STAIRS_DOWN_COLOR,
      bold: true,
      size: 16,
      stroke: 3
    });
  }

  if (s.gameOver && !s.revealed && !s.flagged && s.stairs !== 'down') {
    if (s.knowledge === 'bomb') {
      glyphs.push({ text: '!', anchor: 'center', color: '#ffb347', bold: true, size: 16, stroke: 0 });
    } else if (s.knowledge === 'safe') {
      glyphs.push({ text: '○', anchor: 'center', color: '#7bed9f', bold: false, size: 12, stroke: 0 });
    }
  }

  return { fill: fillColor(s), glyphs, shapes };
};

/** Equal keys mean equal appearances: the view redraws a cell only when its key changed. */
export const cellAppearanceKey = (a: CellAppearance): string => {
  let key = String(a.fill);
  for (const g of a.glyphs) {
    key += `|${glyphKey(g)}`;
  }
  for (const s of a.shapes) {
    key += `|${shapeKey(s)}`;
  }
  return key;
};

/**
 * A figure at the cell size `cell`: every coordinate scaled by `cell / 30`, kept fractional. A pole (`rect`) is never
 * thinner than one pixel, however small the cell (docs/spec/board-render.md "マスの見た目").
 */
export const scaledShape = (shape: CellShape, cell: number): CellShape => {
  const k = cell / REFERENCE_CELL;
  const points = shape.points.map((v) => v * k);
  if (shape.kind === 'rect') {
    points[2] = Math.max(1, points[2]);
  }
  return { kind: shape.kind, points, color: shape.color };
};

/** Equal keys mean the same figure. */
export const shapeKey = (s: CellShape): string => `${s.kind},${s.points.join(',')},${s.color}`;

/** Equal keys mean the same picture: one sample text (and its texture) serves every cell with that glyph look. */
export const glyphKey = (g: CellGlyph): string =>
  `${g.text},${g.anchor},${g.color},${g.bold ? 1 : 0},${g.size},${g.stroke}`;

/**
 * The cells of `stage` whose appearance differs from what was drawn (`prevKeys`: the appearance key each cell was
 * drawn with, `undefined` for a cell not drawn yet). The view updates exactly these cells.
 */
export const changedCellIndices = (
  prevKeys: ReadonlyArray<string | undefined>,
  stage: Stage,
  logical?: LogicalAnalysis
): number[] => {
  const changed: number[] = [];
  for (let idx = 0; idx < stage.cells.length; idx += 1) {
    if (prevKeys[idx] !== cellAppearanceKey(cellAppearance(cellStateOf(stage, idx, logical)))) {
      changed.push(idx);
    }
  }
  return changed;
};
