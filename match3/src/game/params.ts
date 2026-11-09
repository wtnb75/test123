// Every number with gameplay weight lives here (docs/spec.md "パラメータ表"). game-balance tunes this file.

// ---- board and rules -------------------------------------------------------------------------------
export const COLS = 8;
export const ROWS = 8;
export const COLORS = 6;
export const MOVES = 30;
export const SCORE_PER_GEM = 10;
export const BONUS_PER_EXTRA_GEM = 20;
/** A match needs this many in a row; the bonus counts cleared cells beyond it. */
export const MATCH_MIN = 3;
/** A straight run of this many stones leaves a line stone (docs/spec/special-gems.md). */
export const LINE_MIN = 4;
/** A straight run of this many or more leaves a colour stone. */
export const RAINBOW_MIN = 5;
/** A bomb clears this many cells around itself in each direction (1 = the 3 x 3 around it). */
export const BOMB_RADIUS = 1;
export const SHUFFLE_MAX_TRIES = 100;
/** Safety net for board generation (a constant rng can make every attempt fail to have a move). */
export const BOARD_MAX_TRIES = 1000;

// ---- input -----------------------------------------------------------------------------------------
export const CELL = 44;
export const SWIPE_RATIO = 0.4;
export const CURSOR_START = { r: 3, c: 3 } as const;

// ---- screen ----------------------------------------------------------------------------------------
export const SCREEN_WIDTH = 360;
export const SCREEN_HEIGHT_MIN = 520;
export const SCREEN_HEIGHT_MAX = 800;
export const ROTATE_PROMPT_SCALE = 0.875;
export const PROMPT_REAL_FONT_SIZE = 18;
export const PROMPT_MAX_FONT_SIZE = 53;

// ---- timing (ms) -----------------------------------------------------------------------------------
export const SWAP_MS = 150;
export const CLEAR_MS = 200;
export const FALL_MS_PER_CELL = 90;
export const HINT_DELAY_MS = 5000;
export const HINT_SCALE = 1.25;
export const HINT_HALF_MS = 350;
export const POP_MS = 900;
export const POP_RISE = 70;
export const POP_CLAMP_X = 60;
export const POP_CLAMP_Y = 40;
export const POP_CHAIN_SCALE_STEP = 0.15;
export const POP_CHAIN_SCALE_MAX = 1.5;
export const SCORE_BUMP_MS = 200;
export const SCORE_BUMP_SCALE = 1.25;
/** The remaining moves at or below which MOVES turns red (a cue only; no rule or score depends on it). */
export const MOVES_WARN = 5;
export const SHUFFLE_NOTICE_MS = 700;
export const RESULT_DELAY_MS = 800;
export const RESULT_INPUT_GUARD_MS = 500;
export const COUNT_UP_MS = 600;
export const BEST_BLINK_MS = 300;
export const BEST_BLINK_ALPHA = 0.2;
export const BEST_BLINK_COUNT = 3;
export const BUTTON_PRESS_SCALE = 0.97;

// ---- fonts (logical px) ----------------------------------------------------------------------------
export const FONT_HUD_VALUE = 28;
export const FONT_HUD_LABEL = 14;
export const FONT_POP = 22;
export const FONT_NOTICE = 24;
export const FONT_TITLE = 36;
export const FONT_TITLE_SUB = 16;
export const FONT_HELP = 14;
export const FONT_RESULT = 18;
export const FONT_RESULT_TITLE = 28;
export const FONT_RESULT_SCORE = 40;
export const FONT_BUTTON = 18;

// ---- layout ----------------------------------------------------------------------------------------
export const HUD_H = 88;
export const HUD_GAP = 8;
export const GROUP_H = HUD_H + HUD_GAP + ROWS * CELL;
export const HUD_SIDE_MARGIN = 16;
/** The board's plate reaches this far outside the board; it never reaches past the screen edge. */
export const PANEL_PAD = 3;
export const PANEL_RADIUS = 10;
export const BUTTON_W = 180;
export const BUTTON_H = 52;
export const TITLE_BUTTON_FROM_BOTTOM = 130;
export const TITLE_BLOCK_H = 240;
export const TITLE_BLOCK_GAP = 24;
export const RESULT_BUTTON_W = 156;
export const RESULT_BUTTON_GAP = 16;
export const RESULT_BUTTON_FROM_BOTTOM = 70;
export const RESULT_BLOCK_H = 200;
export const RESULT_BLOCK_GAP = 24;

/** The game directory name: the best is saved under the key `match3.best`. */
export const GAME_ID = 'match3';
