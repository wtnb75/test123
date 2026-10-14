// The gravestone screen (docs/spec/game-over.md "墓石画面（2 段目）"): the tombstone art, which variant fits, where it goes. No Phaser.

import { RESTART_BUTTON_HEIGHT, RESTART_ROW_Y_RATIO } from './restartButtons';

/** After the gravestone screen appears, RETRY / NEW GAME / TITLE inputs are ignored for this long (ms). */
export const GRAVE_INPUT_LOCK_MS = 300;
export const GRAVE_DIM_COLOR = 0x000000;
export const GRAVE_DIM_ALPHA = 0.55;
/** The art is drawn with this monospace size, one row per `GRAVE_ART_ROW_HEIGHT` px. */
export const GRAVE_ART_FONT = 14;
export const GRAVE_ART_ROW_HEIGHT = 18;
/** Width of the stone inside the walls and outside them; the ground continues this far to each side of the stone. */
export const GRAVE_INNER = 22;
export const GRAVE_STONE_WIDTH = 24;
export const GRAVE_GROUND_EXTRA = 4;
/** Width of the whole art: the stone plus the ground on both sides. */
export const GRAVE_ART_WIDTH = GRAVE_STONE_WIDTH + 2 * GRAVE_GROUND_EXTRA;
/** Art bottom to the top of the RETRY / NEW GAME row. */
export const GRAVE_GAP = 12;
/** Smallest distance between the HUD band's bottom and the art's top for a variant to count as fitting. */
export const GRAVE_TOP_MARGIN = 8;
/** The rectangle behind the art: left and right margin, colour and opacity. */
export const GRAVE_PLATE_PAD_X = 8;
export const GRAVE_PLATE_COLOR = 0x0a1f2f;
export const GRAVE_PLATE_ALPHA = 0.85;
/** Colours (delegated by the spec): the art, and the "New record!" row. */
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
  /** The "New record!" row. */
  highlight: boolean;
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
const MARGIN = ' '.repeat(GRAVE_GROUND_EXTRA);
const SIDE_GROUND = '_'.repeat(GRAVE_GROUND_EXTRA);
/** A stone row: shifted right by the ground's overhang, so the stone sits in the middle of the ground. */
const stone = (row: string): string => MARGIN + row;
const wall = (s: string): string => stone(`|${centerText(s, GRAVE_INNER)}|`);

/** The rows of a variant, top to bottom, before padding: [text, is the "New record!" row]. */
const artRows = (variant: GraveVariant, info: GraveInfo): Array<[string, boolean]> => {
  const mine = info.cause === 'mine';
  const cause1 = mine ? 'killed by a' : 'stepped on a';
  const cause2 = mine ? 'mine' : 'false flag';
  const score = `Score:${info.stageNo - 1}  High:${info.high}`;
  const rows: Array<[string, boolean]> = [];
  const add = (text: string, highlight = false): void => {
    rows.push([text, highlight]);
  };
  const record = (): void => {
    if (info.record) {
      add(wall('New record!'), true);
    }
  };

  if (variant === 'C') {
    add(stone(`  ${'_'.repeat(20)}`));
    add(stone(` /${centerText(`R.I.P. Stage ${info.stageNo}`, 20)}\\`));
    add(wall(mine ? 'killed by a mine' : 'stepped on false flag'));
    add(wall(score));
    record();
    add(`${SIDE_GROUND}|${'_'.repeat(GRAVE_INNER)}|${SIDE_GROUND}`);
    return rows;
  }

  add(stone(`    ${'_'.repeat(16)}`));
  add(stone(`   /${' '.repeat(16)}\\`));
  if (variant === 'A') {
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
  add(`${SIDE_GROUND}${GRASS}${SIDE_GROUND}`);
  return rows;
};

/** The art of a variant: every row as long as the longest (at least `GRAVE_ART_WIDTH`). */
export const graveArt = (variant: GraveVariant, info: GraveInfo): GraveRow[] => {
  const rows = artRows(variant, info);
  const width = Math.max(GRAVE_ART_WIDTH, ...rows.map(([text]) => text.length));
  return rows.map(([text, highlight]) => ({ text: text.padEnd(width), highlight }));
};

/** Width of the rectangle behind the art: every row is equally long; `charWidth` is one character's width (px). */
export const gravePlateWidth = (rows: GraveRow[], charWidth: number): number =>
  (rows[0]?.text.length ?? 0) * charWidth + 2 * GRAVE_PLATE_PAD_X;

/** Height of the art (px): rows x row height. */
export const graveArtHeight = (rows: GraveRow[]): number => rows.length * GRAVE_ART_ROW_HEIGHT;

/** The first of A, B, C whose height fits in `available`; C when none does (it may reach under the band). */
export const graveVariantFor = (available: number, record: boolean): GraveVariant => {
  const probe: GraveInfo = { stageNo: 2, cause: 'mine', high: 0, record };
  for (const variant of ['A', 'B'] as const) {
    if (graveArtHeight(graveArt(variant, probe)) <= available) {
      return variant;
    }
  }
  return 'C';
};

export type GravePanelLayout = {
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

/** Where the art goes on a `width` x `height` screen whose HUD band ends at `bandBottom`. */
export const gravePanelLayout = (width: number, height: number, bandBottom: number, info: GraveInfo): GravePanelLayout => {
  const retryTop = height * RESTART_ROW_Y_RATIO - RESTART_BUTTON_HEIGHT / 2;
  const bottom = retryTop - GRAVE_GAP;
  const available = bottom - (bandBottom + GRAVE_TOP_MARGIN);
  const variant = graveVariantFor(available, info.record);
  const rows = graveArt(variant, info);
  const artHeight = graveArtHeight(rows);
  const top = bottom - artHeight;
  const rowCenterY = rows.map((_, i) => top + (i + 0.5) * GRAVE_ART_ROW_HEIGHT);
  return { variant, rows, centerX: width / 2, top, bottom, height: artHeight, rowCenterY };
};
