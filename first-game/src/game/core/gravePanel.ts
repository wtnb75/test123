// The gravestone screen (docs/spec/game-over.md "墓石画面（2 段目）"): wording, which rows fit, where the panel goes. No Phaser.

import { RESTART_BUTTON_HEIGHT, RESTART_ROW_Y_RATIO } from './restartButtons';

/** After the gravestone screen appears, RETRY / NEW GAME / TITLE inputs are ignored for this long (ms). */
export const GRAVE_INPUT_LOCK_MS = 300;
export const GRAVE_DIM_COLOR = 0x000000;
export const GRAVE_DIM_ALPHA = 0.55;
export const GRAVE_PANEL_WIDTH = 280;
/** Panel bottom to the top of the RETRY / NEW GAME row. */
export const GRAVE_PANEL_GAP = 12;
/** Smallest distance between the HUD band's bottom and the panel's top for a variant to count as fitting. */
export const GRAVE_PANEL_TOP_MARGIN = 8;
export const GRAVE_PANEL_PADDING = 12;
/** Colours (delegated by the spec): panel fill and frame, text, and the "New record!" accent. */
export const GRAVE_PANEL_FILL = 0x111827;
export const GRAVE_PANEL_FILL_ALPHA = 0.95;
export const GRAVE_PANEL_STROKE = 0x6b7280;
export const GRAVE_TEXT_COLOR = '#e5e7eb';
export const GRAVE_RECORD_COLOR = '#fbbf24';
export const GRAVE_ROW_GAP = 4;

/** Layers: the dim sits between the board ("@" / "†") and the HUD band; the panel under the buttons, over the pad. */
export const GRAVE_DIM_DEPTH = 6.5;
export const GRAVE_PANEL_DEPTH = 45;
export const GRAVE_PANEL_TEXT_DEPTH = 46;

export type GraveCause = 'mine' | 'false-flag';
export type GraveVariant = 'A' | 'B' | 'C';
export type GraveRowKind = 'tomb' | 'title' | 'cause' | 'score' | 'record';

export type GraveRow = {
  kind: GraveRowKind;
  text: string;
  /** Height of the row inside the panel (px). */
  height: number;
  fontSize: number;
  bold: boolean;
  /** The row carries the "New record!" accent. */
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

const ROW_HEIGHT: Record<GraveRowKind, number> = { tomb: 32, title: 24, cause: 20, score: 20, record: 20 };
const FONT_SIZE: Record<GraveRowKind, number> = { tomb: 28, title: 18, cause: 14, score: 14, record: 14 };

/** The cause shown for a rule result tag: `false-flag` is the wrong flag, everything else is a mine. */
export const graveCauseOf = (ruleMessage?: string): GraveCause => (ruleMessage === 'false-flag' ? 'false-flag' : 'mine');

/** True when `score` beats the high score from before the death (a failed save does not matter). */
export const isNewRecord = (score: number, previousHigh: number): boolean => score > previousHigh;

/** True while `now` is inside the lock that starts when the gravestone screen appears at `enteredAt`. */
export const graveLocked = (now: number, enteredAt: number): boolean => now - enteredAt < GRAVE_INPUT_LOCK_MS;

const causeText = (cause: GraveCause): string => (cause === 'false-flag' ? 'Stepped on a false flag.' : 'Killed by a mine.');

/** The rows of a variant, top to bottom. C folds the record into the score row; B and C leave the tombstone out. */
export const graveRows = (variant: GraveVariant, info: GraveInfo): GraveRow[] => {
  const score = `Score:${info.stageNo - 1}  High:${info.high}`;
  const row = (kind: GraveRowKind, text: string, highlight = false): GraveRow => ({
    kind,
    text,
    height: ROW_HEIGHT[kind],
    fontSize: FONT_SIZE[kind],
    bold: kind === 'title',
    highlight
  });
  const rows: GraveRow[] = [];
  if (variant === 'A') {
    rows.push(row('tomb', '†'));
  }
  rows.push(row('title', `R.I.P. Stage ${info.stageNo}`), row('cause', causeText(info.cause)));
  if (variant === 'C') {
    rows.push(row('score', info.record ? `${score}  New record!` : score, info.record));
  } else {
    rows.push(row('score', score));
    if (info.record) {
      rows.push(row('record', 'New record!', true));
    }
  }
  return rows;
};

/** Height of a panel with these rows: row heights + gaps + padding above and below. */
export const gravePanelHeight = (rows: GraveRow[]): number =>
  rows.reduce((sum, r) => sum + r.height, 0) + GRAVE_ROW_GAP * (rows.length - 1) + GRAVE_PANEL_PADDING * 2;

/** The first of A, B, C whose height fits in `available`; C when none does (it may reach under the band). */
export const graveVariantFor = (available: number, record: boolean): GraveVariant => {
  const probe: GraveInfo = { stageNo: 2, cause: 'mine', high: 0, record };
  for (const variant of ['A', 'B'] as const) {
    if (gravePanelHeight(graveRows(variant, probe)) <= available) {
      return variant;
    }
  }
  return 'C';
};

export type GravePanelLayout = {
  variant: GraveVariant;
  rows: GraveRow[];
  /** Centre x, top and bottom of the panel (canvas px), and its size. */
  centerX: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  /** Where each row's centre goes (canvas px), same order as `rows`. */
  rowCenterY: number[];
};

/** Where the panel goes on a `width` x `height` screen whose HUD band ends at `bandBottom`. */
export const gravePanelLayout = (width: number, height: number, bandBottom: number, info: GraveInfo): GravePanelLayout => {
  const retryTop = height * RESTART_ROW_Y_RATIO - RESTART_BUTTON_HEIGHT / 2;
  const bottom = retryTop - GRAVE_PANEL_GAP;
  const available = bottom - (bandBottom + GRAVE_PANEL_TOP_MARGIN);
  const variant = graveVariantFor(available, info.record);
  const rows = graveRows(variant, info);
  const panelHeight = gravePanelHeight(rows);
  const top = bottom - panelHeight;
  const rowCenterY: number[] = [];
  let y = top + GRAVE_PANEL_PADDING;
  for (const r of rows) {
    rowCenterY.push(y + r.height / 2);
    y += r.height + GRAVE_ROW_GAP;
  }
  return { variant, rows, centerX: width / 2, top, bottom, width: GRAVE_PANEL_WIDTH, height: panelHeight, rowCenterY };
};
