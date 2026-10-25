// Pure logic of the Title screen (docs/spec/title.md, docs/spec/title-demo.md): which keys start the game and where
// things go.

export type TitleLayout = {
  /** Horizontal centre of the name and the button (rounded px). */
  centerX: number;
  /** Vertical centres (rounded px). */
  nameY: number;
  buttonY: number;
  /** Font size of the game name (px). */
  fontSize: number;
  buttonWidth: number;
  buttonHeight: number;
};

/** Space above the name and below the button. */
export const TITLE_MARGIN = 16;
export const TITLE_FONT_MIN = 24;
export const TITLE_FONT_MAX = 48;
export const TITLE_BUTTON_MAX_WIDTH = 200;
/** Space kept on the left and on the right of a narrow button. */
export const TITLE_BUTTON_SIDE_MARGIN = 16;
export const TITLE_BUTTON_HEIGHT = 64;

/** Font size of the game name: follows the width (15 letters must fit). */
export const titleFontSize = (width: number): number =>
  Math.min(TITLE_FONT_MAX, Math.max(TITLE_FONT_MIN, Math.floor(width / 10)));

/** Layout for a canvas of `width` x `height` px. */
export const titleLayout = (width: number, height: number): TitleLayout => {
  const fontSize = titleFontSize(width);
  return {
    centerX: Math.round(width / 2),
    nameY: Math.round(TITLE_MARGIN + fontSize / 2),
    buttonY: Math.round(height - TITLE_MARGIN - TITLE_BUTTON_HEIGHT / 2),
    fontSize,
    buttonWidth: Math.max(0, Math.min(TITLE_BUTTON_MAX_WIDTH, width - TITLE_BUTTON_SIDE_MARGIN * 2)),
    buttonHeight: TITLE_BUTTON_HEIGHT
  };
};

/** The 「パッド」settings button (docs/spec/title.md): its size in px. It sits in a row under the name, at the right. */
export const TITLE_SETTINGS_WIDTH = 110;
export const TITLE_SETTINGS_HEIGHT = 34;

export type TitleSettingsLayout = { centerX: number; centerY: number; width: number; height: number };

/** Where the 「パッド」button goes: the right end of the row under the name (the demo starts below that row). */
export const titleSettingsLayout = (width: number): TitleSettingsLayout => {
  const top = TITLE_MARGIN + titleFontSize(width) + DEMO_GAP;
  return {
    centerX: Math.round(width - TITLE_MARGIN - TITLE_SETTINGS_WIDTH / 2),
    centerY: Math.round(top + TITLE_SETTINGS_HEIGHT / 2),
    width: TITLE_SETTINGS_WIDTH,
    height: TITLE_SETTINGS_HEIGHT
  };
};

/** The size of one cell in `Game` (px). The demo scales every dimension of the board by `cell / REFERENCE_CELL`. */
export const REFERENCE_CELL = 30;
/** Biggest cell of the demo board (the size `Game` draws). */
export const DEMO_CELL_MAX = REFERENCE_CELL;
/** Smallest cell the demo is shown at. */
export const DEMO_MIN_CELL = 10;
/** Space between the name / the button and the demo area. */
export const DEMO_GAP = 12;
/** Stages 1..DEMO_STAGES are played by the demo in one run. */
export const DEMO_STAGES = 3;
/** Side of the biggest demo board in cells (stage n is (7 + n) x (7 + n); stage 3 is 10 x 10). */
export const DEMO_GRID_MAX = 7 + DEMO_STAGES;

export type DemoLayout = {
  /** False when the cell would be under `DEMO_MIN_CELL`: the demo is not shown. */
  visible: boolean;
  /** Size of one cell (px, integer). */
  cell: number;
  /** Centre of the board (rounded px). */
  centerX: number;
  centerY: number;
  regionTop: number;
  regionBottom: number;
  regionWidth: number;
  regionHeight: number;
};

/** Where the demo board goes between the name and the button. */
export const demoLayout = (width: number, height: number): DemoLayout => {
  const fontSize = titleFontSize(width);
  const regionTop = TITLE_MARGIN + fontSize + DEMO_GAP + TITLE_SETTINGS_HEIGHT + DEMO_GAP;
  const regionBottom = height - TITLE_MARGIN - TITLE_BUTTON_HEIGHT - DEMO_GAP;
  const regionHeight = Math.max(0, regionBottom - regionTop);
  const regionWidth = Math.max(0, width - TITLE_MARGIN * 2);
  const cell = Math.min(
    DEMO_CELL_MAX,
    Math.floor(regionWidth / DEMO_GRID_MAX),
    Math.floor(regionHeight / DEMO_GRID_MAX)
  );
  return {
    visible: cell >= DEMO_MIN_CELL,
    cell,
    centerX: Math.round(width / 2),
    centerY: Math.round(regionTop + regionHeight / 2),
    regionTop,
    regionBottom,
    regionWidth,
    regionHeight
  };
};

/** Enter and Space start the game (by `KeyboardEvent.code`); a held key (auto-repeat) does not. */
export const isStartKey = (code: string, repeat: boolean): boolean =>
  !repeat && (code === 'Enter' || code === 'Space');
