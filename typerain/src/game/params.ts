// Every number with gameplay weight lives here (docs/spec.md "パラメータ表").

// Screen
export const SCREEN_WIDTH = 360;
export const SCREEN_HEIGHT_MIN = 240;
export const SCREEN_HEIGHT_MAX = 800;
export const ROTATE_PROMPT_SCALE = 0.875;
export const PROMPT_REAL_FONT_SIZE = 18;
export const PROMPT_MAX_FONT_SIZE = 30;

// Run
export const LIVES = 3;
export const WORD_MIN_LEN = 3;
export const WORD_MAX_LEN = 8;
export const WORD_MAX_LEN_START = 4;
export const WORD_LEN_UP_SEC = 20;
export const MAX_ON_SCREEN = 6;
export const FIRST_SPAWN_SEC = 0.4;
export const SPAWN_START_SEC = 2.4;
export const SPAWN_MIN_SEC = 0.8;
export const SPAWN_DECAY_PER_SEC = 0.02;
export const SPAWN_GAP = 4;
/** Fall speeds are fractions of the fall distance per second, so every screen height gives the same pace. */
export const FALL_SPEED_START = 0.084;
export const FALL_SPEED_RAMP = 0.0014;
export const FALL_SPEED_MAX = 0.28;
export const DT_MAX_SEC = 0.1;

// Score
export const SCORE_PER_CHAR = 10;
export const COMBO_STEP = 0.1;
export const COMBO_MULT_CAP = 3;
export const BEST_KEY = 'typerain:best';

// Timing and effects
export const RESULT_DELAY = 0.8; // seconds
export const RESULT_INPUT_GUARD_MS = 500;
export const MISS_SHAKE_MS = 80;
export const MISS_SHAKE_INTENSITY = 0.004;
export const FLOOR_SHAKE_MS = 150;
export const FLOOR_SHAKE_INTENSITY = 0.01;
export const CLEAR_POP_MS = 150;
export const CLEAR_POP_SCALE = 1.3;
export const SCORE_POP_MS = 500;
export const SCORE_POP_RISE = 40;
export const LAND_FLASH_MS = 250;
export const FLOOR_GLOW_MS = 250;
export const HEART_LOSE_MS = 300;
export const LOCK_BAND_ALPHA = 0.15;
export const LOCK_PAD_X = 4;
/** Typed characters are read from the hidden input's value; past this length it is emptied. */
export const INPUT_MAX_LENGTH = 24;

// Words
export const MARGIN = 8;
export const CHAR_W = 13;
export const WORD_H = 26;

// Fonts (logical px)
export const FONT_WORD = 22;
export const FONT_HUD = 18;
export const FONT_COMBO = 16;
export const FONT_HINT = 13;
export const FONT_TITLE = 36;
export const FONT_HELP = 14;
export const FONT_RESULT_TITLE = 28;
export const FONT_RESULT_SCORE = 24;
export const FONT_RESULT = 16;
export const FONT_BUTTON = 18;
export const FONT_POP = 18;

// Layout
export const HUD_Y = 4;
export const COMBO_Y = 34;
export const FIELD_TOP = 48;
export const FLOOR_FROM_BOTTOM = 30;
export const BUTTON_W = 180;
export const BUTTON_H = 52;
export const BUTTON_FROM_BOTTOM = 44;
export const RESULT_BUTTON_W = 156;
export const RESULT_BUTTON_GAP = 16;
export const TITLE_NAME_MIN_Y = 43;
