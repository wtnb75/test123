// The gravestone screen (docs/spec/game-over.md "墓石画面（2 段目）"): the tombstone art, which variant fits, where it goes. No Phaser.

import { RESTART_BUTTON_HEIGHT, RESTART_ROW_Y_RATIO } from './restartButtons';

/** After the gravestone screen appears, RETRY / NEW GAME / TITLE inputs are ignored for this long (ms). */
export const GRAVE_INPUT_LOCK_MS = 300;
export const GRAVE_DIM_COLOR = 0x000000;
export const GRAVE_DIM_ALPHA = 0.55;
/** The art is drawn with this monospace size at scale 1: one row per `GRAVE_ART_ROW_HEIGHT` px (variants B and C), `GRAVE_ROW_HEIGHT_A` (variant A). */
export const GRAVE_ART_FONT = 14;
export const GRAVE_ART_ROW_HEIGHT = 18;
export const GRAVE_ROW_HEIGHT_A = 24;
/** Width of the stone inside the walls and outside them; the ground continues this far to each side of the stone. */
export const GRAVE_INNER = 22;
export const GRAVE_STONE_WIDTH = 24;
export const GRAVE_GROUND_EXTRA = 4;
/** Variant A has more grass on both sides. */
export const GRAVE_GROUND_EXTRA_A = 8;
/** Width of the whole art: the stone plus the ground on both sides (variants B and C; A has its own below). */
export const GRAVE_ART_WIDTH = GRAVE_STONE_WIDTH + 2 * GRAVE_GROUND_EXTRA;
export const GRAVE_ART_WIDTH_A = GRAVE_STONE_WIDTH + 2 * GRAVE_GROUND_EXTRA_A;
/** The art grows with the screen: at most this many times, never below 1; it keeps this margin to each side of the screen. */
export const GRAVE_SCALE_MAX = 3;
export const GRAVE_SIDE_MARGIN = 8;
/** One character's width / the font size of the monospace font (the scale and variant A's width condition use it). */
export const GRAVE_CHAR_WIDTH_RATIO = 0.6;
/** One character's width at scale 1 (px). */
export const GRAVE_CHAR_WIDTH = GRAVE_CHAR_WIDTH_RATIO * GRAVE_ART_FONT;
/** Float noise in a comparison or a floor must not move a result across its border. */
const EPSILON = 1e-9;
/** Art bottom to the top of the RETRY / NEW GAME row. */
export const GRAVE_GAP = 12;
/** Smallest distance between the HUD band's bottom and the art's top for a variant to count as fitting. */
export const GRAVE_TOP_MARGIN = 8;
/** The rectangle behind the art: left and right margin, colour and opacity. */
export const GRAVE_PLATE_PAD_X = 8;
export const GRAVE_PLATE_COLOR = 0x0a1f2f;
export const GRAVE_PLATE_ALPHA = 0.85;
/** Colours (delegated by the spec): the art, and the words "New record!" (not the walls around them). */
export const GRAVE_TEXT_COLOR = '#e5e7eb';
export const GRAVE_RECORD_COLOR = '#fbbf24';

/** Layers: the dim sits between the board ("@" / "†") and the HUD band; the art over the pad, under the buttons. */
export const GRAVE_DIM_DEPTH = 6.5;
export const GRAVE_PLATE_DEPTH = 45;
export const GRAVE_TEXT_DEPTH = 46;

export type GraveCause = 'mine' | 'false-flag';
export type GraveVariant = 'A' | 'B' | 'C';

export type GraveRow = {
  /** The row, padded on the right so that every row of the art is equally long. */
  text: string;
  /** Where "New record!" stands in `text` (start inclusive, end exclusive), drawn in the accent colour; none elsewhere. */
  accent: { start: number; end: number } | null;
};

export type GraveInfo = {
  stageNo: number;
  cause: GraveCause;
  /** The high score after this death (what the status line shows). */
  high: number;
  /** The score beat the high score from before this death. */
  record: boolean;
};

/** The cause shown for a rule result tag: `false-flag` is the wrong flag, everything else is a mine. */
export const graveCauseOf = (ruleMessage?: string): GraveCause => (ruleMessage === 'false-flag' ? 'false-flag' : 'mine');

/** True when `score` beats the high score from before the death (a failed save does not matter). */
export const isNewRecord = (score: number, previousHigh: number): boolean => score > previousHigh;

/** True while `now` is inside the lock that starts when the gravestone screen appears at `enteredAt`. */
export const graveLocked = (now: number, enteredAt: number): boolean => now - enteredAt < GRAVE_INPUT_LOCK_MS;

/** `s` in the middle of `width` characters: the left blanks are rounded down; a longer `s` stays as it is. */
export const centerText = (s: string, width: number): string => {
  if (s.length >= width) {
    return s;
  }
  const left = Math.floor((width - s.length) / 2);
  return ' '.repeat(left) + s + ' '.repeat(width - s.length - left);
};

/** The grass of the ground line, as wide as the stone. */
const GRASS = '_)/\\_//(\\/(/\\)/\\//\\/|_)_';
const RECORD_TEXT = 'New record!';

/** The rows of a variant, top to bottom, before padding. */
const artRows = (variant: GraveVariant, info: GraveInfo): Array<[string, boolean]> => {
  const mine = info.cause === 'mine';
  const cause1 = mine ? 'killed by a' : 'stepped on a';
  const cause2 = mine ? 'mine' : 'false flag';
  const score = `Score:${info.stageNo - 1}  High:${info.high}`;
  const extra = variant === 'A' ? GRAVE_GROUND_EXTRA_A : GRAVE_GROUND_EXTRA;
  const sideGround = '_'.repeat(extra);
  /** A stone row: shifted right by the ground's overhang, so the stone sits in the middle of the ground. */
  const stone = (row: string): string => ' '.repeat(extra) + row;
  const wall = (s: string): string => stone(`|${centerText(s, GRAVE_INNER)}|`);
  const rows: Array<[string, boolean]> = [];
  const add = (text: string, highlight = false): void => {
    rows.push([text, highlight]);
  };
  const record = (): void => {
    if (info.record) {
      add(wall(RECORD_TEXT), true);
    }
  };

  if (variant === 'C') {
    add(stone(`  ${'_'.repeat(20)}`));
    add(stone(` /${centerText(`R.I.P. Stage ${info.stageNo}`, 20)}\\`));
    add(wall(mine ? 'killed by a mine' : 'stepped on false flag'));
    add(wall(score));
    record();
    add(`${sideGround}|${'_'.repeat(GRAVE_INNER)}|${sideGround}`);
    return rows;
  }

  add(stone(`    ${'_'.repeat(16)}`));
  add(stone(`   /${' '.repeat(16)}\\`));
  if (variant === 'A') {
    // The blank arch row once more: room above the first words.
    add(stone(`   /${' '.repeat(16)}\\`));
    add(stone(`  /${centerText('REST', 18)}\\`));
    add(stone(` /${centerText('IN', 20)}\\`));
    add(stone(`/${centerText('PEACE', 22)}\\`));
    add(wall(''));
    add(wall(`Stage ${info.stageNo}`));
    add(wall(cause1));
    add(wall(cause2));
  } else {
    add(stone(`  /${centerText('R.I.P.', 18)}\\`));
    add(stone(` /${centerText(`Stage ${info.stageNo}`, 20)}\\`));
    add(stone(`/${centerText(cause1, 22)}\\`));
    add(wall(cause2));
  }
  add(wall(score));
  record();
  if (variant === 'A') {
    // A blank wall row under the words: room above the ground.
    add(wall(''));
  }
  add(`${sideGround}${GRASS}${sideGround}`);
  return rows;
};

/** The art of a variant: every row as long as the longest (at least the variant's width). */
export const graveArt = (variant: GraveVariant, info: GraveInfo): GraveRow[] => {
  const rows = artRows(variant, info);
  const width = Math.max(variant === 'A' ? GRAVE_ART_WIDTH_A : GRAVE_ART_WIDTH, ...rows.map(([text]) => text.length));
  return rows.map(([text, highlight]) => {
    const start = highlight ? text.indexOf(RECORD_TEXT) : -1;
    return { text: text.padEnd(width), accent: start >= 0 ? { start, end: start + RECORD_TEXT.length } : null };
  });
};

/** Width of the rectangle behind the art: every row is equally long; `charWidth` is one character's width (px), `padX` the margin on each side. */
export const gravePlateWidth = (rows: GraveRow[], charWidth: number, padX: number = GRAVE_PLATE_PAD_X): number =>
  (rows[0]?.text.length ?? 0) * charWidth + 2 * padX;

/**
 * A row split in two lines of equal length: `base` in the body colour (the accent words blanked out) and
 * `accent` with only those words (everything else blank), to be drawn over each other: with a monospace font
 * the columns line up, so the walls beside "New record!" keep the body colour. `accent` is null for other rows.
 */
export const graveRowParts = (row: GraveRow): { base: string; accent: string | null } => {
  if (!row.accent) {
    return { base: row.text, accent: null };
  }
  const { start, end } = row.accent;
  const blank = (s: string): string => s.replace(/./g, ' ');
  return {
    base: row.text.slice(0, start) + blank(row.text.slice(start, end)) + row.text.slice(end),
    accent: blank(row.text.slice(0, start)) + row.text.slice(start, end) + blank(row.text.slice(end))
  };
};

/** The row height of a variant at scale 1 (px). */
export const graveRowHeight = (variant: GraveVariant): number => (variant === 'A' ? GRAVE_ROW_HEIGHT_A : GRAVE_ART_ROW_HEIGHT);

/** Height of the art (px): rows x the row height (`graveRowHeight(variant)` at scale 1, or the scaled one). */
export const graveArtHeight = (rows: GraveRow[], rowHeight: number): number => rows.length * rowHeight;

/**
 * The first of A, B, C that fits: by height at scale 1 (`available`), and variant A also by width (its plate plus
 * `GRAVE_SIDE_MARGIN` to each side must fit `screenWidth`); C when none does (it may reach under the band).
 */
export const graveVariantFor = (
  available: number,
  record: boolean,
  screenWidth: number,
  charWidth: number = GRAVE_CHAR_WIDTH
): GraveVariant => {
  const probe: GraveInfo = { stageNo: 2, cause: 'mine', high: 0, record };
  for (const variant of ['A', 'B'] as const) {
    const rows = graveArt(variant, probe);
    const fitsHeight = graveArtHeight(rows, graveRowHeight(variant)) <= available + EPSILON;
    const fitsWidth = variant !== 'A' || gravePlateWidth(rows, charWidth) <= screenWidth - 2 * GRAVE_SIDE_MARGIN + EPSILON;
    if (fitsHeight && fitsWidth) {
      return variant;
    }
  }
  return 'C';
};

/** How big the art is drawn: the scale `k` (1 to `GRAVE_SCALE_MAX`), the font size, the row height and the plate's side margin (px). */
export type GraveScale = { k: number; fontPx: number; rowHeight: number; platePadX: number };

/**
 * The largest scale at which the chosen variant fits the usable height (`available`) and the screen's width
 * (docs/spec/game-over.md "墓石の大きさ（画面に合わせる）"), whole-px sizes: never below 1 (the art then keeps its size).
 */
export const graveScale = (
  variant: GraveVariant,
  rows: GraveRow[],
  available: number,
  screenWidth: number,
  charWidth: number = GRAVE_CHAR_WIDTH
): GraveScale => {
  const baseRowHeight = graveRowHeight(variant);
  const plateAt1 = gravePlateWidth(rows, charWidth);
  const kw = plateAt1 > 0 ? (screenWidth - 2 * GRAVE_SIDE_MARGIN) / plateAt1 : Infinity;
  const kh = rows.length > 0 ? available / (rows.length * baseRowHeight) : Infinity;
  const k = Math.max(1, Math.min(GRAVE_SCALE_MAX, kw, kh));
  const fontPx = Math.max(GRAVE_ART_FONT, Math.floor(GRAVE_ART_FONT * k + EPSILON));
  return {
    k,
    fontPx,
    rowHeight: Math.floor((fontPx * baseRowHeight) / GRAVE_ART_FONT + EPSILON),
    platePadX: Math.floor((GRAVE_PLATE_PAD_X * fontPx) / GRAVE_ART_FONT + EPSILON)
  };
};

export type GravePanelLayout = GraveScale & {
  variant: GraveVariant;
  rows: GraveRow[];
  /** Centre x of the art (canvas px), its top, bottom and height. */
  centerX: number;
  top: number;
  bottom: number;
  height: number;
  /** Where each row's centre goes (canvas px), same order as `rows`. */
  rowCenterY: number[];
};

/** Where the art goes on a `width` x `height` screen whose HUD band ends at `bandBottom`, and how big it is. */
export const gravePanelLayout = (
  width: number,
  height: number,
  bandBottom: number,
  info: GraveInfo,
  charWidth: number = GRAVE_CHAR_WIDTH
): GravePanelLayout => {
  const retryTop = height * RESTART_ROW_Y_RATIO - RESTART_BUTTON_HEIGHT / 2;
  const bottom = retryTop - GRAVE_GAP;
  const available = bottom - (bandBottom + GRAVE_TOP_MARGIN);
  const variant = graveVariantFor(available, info.record, width, charWidth);
  const rows = graveArt(variant, info);
  const scale = graveScale(variant, rows, available, width, charWidth);
  const artHeight = graveArtHeight(rows, scale.rowHeight);
  const top = bottom - artHeight;
  const rowCenterY = rows.map((_, i) => top + (i + 0.5) * scale.rowHeight);
  return { ...scale, variant, rows, centerX: width / 2, top, bottom, height: artHeight, rowCenterY };
};
