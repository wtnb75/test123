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

/** What the game-over analysis says about a cell. `none` is "nothing certain" and also "no analysis". */
export type CellKnowledge = 'bomb' | 'safe' | 'none';

/** What decides whether a drawn board can be updated in place: the same size and the same markers. */
export type BoardShape = { width: number; height: number; start: Position; goal: Position };

export const sameBoardShape = (a: BoardShape, b: BoardShape): boolean =>
  a.width === b.width &&
  a.height === b.height &&
  a.start.x === b.start.x &&
  a.start.y === b.start.y &&
  a.goal.x === b.goal.x &&
  a.goal.y === b.goal.y;

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
    knowledge
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
};

export type CellGlyph = {
  text: string;
  /** `center`: centred on the cell; `top-left`: the flag, at (5, 3) from the cell's corner (reference px). */
  anchor: 'center' | 'top-left';
  color: string;
  bold: boolean;
  /** Font size at the reference cell. */
  size: number;
  /** Outline thickness at the reference cell (0: none). */
  stroke: number;
};

export type CellAppearance = {
  fill: number;
  /** Bottom to top. */
  glyphs: CellGlyph[];
};

export const COLOR_CLOSED = 0x1e272e;
export const COLOR_OPEN = 0x2f3542;
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
    glyphs.push({
      text: 'F',
      anchor: 'top-left',
      color: wrong ? '#a29bfe' : '#ff4757',
      bold: wrong,
      size: 16,
      stroke: 0
    });
    if (wrong) {
      glyphs.push({ text: '×', anchor: 'center', color: '#a29bfe', bold: true, size: 18, stroke: 2 });
    }
  }

  if (s.gameOver && !s.revealed && !s.flagged) {
    if (s.knowledge === 'bomb') {
      glyphs.push({ text: '!', anchor: 'center', color: '#ffb347', bold: true, size: 16, stroke: 0 });
    } else if (s.knowledge === 'safe') {
      glyphs.push({ text: '○', anchor: 'center', color: '#7bed9f', bold: false, size: 12, stroke: 0 });
    }
  }

  return { fill: fillColor(s), glyphs };
};

/** Equal keys mean equal appearances: the view redraws a cell only when its key changed. */
export const cellAppearanceKey = (a: CellAppearance): string => {
  let key = String(a.fill);
  for (const g of a.glyphs) {
    key += `|${glyphKey(g)}`;
  }
  return key;
};

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
