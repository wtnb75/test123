// Every number with gameplay weight lives here (docs/spec.md "パラメータ表").

// Screen
export const SCREEN_WIDTH = 360;
export const SCREEN_HEIGHT_MIN = 520;
export const SCREEN_HEIGHT_MAX = 800;
export const ROTATE_PROMPT_SCALE = 0.875;
export const PROMPT_REAL_FONT_SIZE = 18;
export const PROMPT_MAX_FONT_SIZE = 53;

// Targets
export const TARGET_COUNT = 3;
/** Selection weight per word length (3..8 letters). */
export const LENGTH_WEIGHT: Readonly<Record<number, number>> = { 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1 };

// Tray: TRAY_COLS x TRAY_ROWS slots (the layout constants are further down)
export const TRAY_COLS = 5;
export const TRAY_ROWS = 2;
export const TRAY_CAPACITY = TRAY_COLS * TRAY_ROWS;

// Time and score
export const START_TIME_SEC = 60;
export const BONUS_SEC_PER_LETTER = 1;
export const SCORE_BY_LENGTH: Readonly<Record<number, number>> = { 3: 30, 4: 50, 5: 80, 6: 120, 7: 170, 8: 230 };

// Falling letters
export const SPAWN_INTERVAL_MS = 650;
export const COLUMNS = 7;
/** Fall speeds are in field heights per second, so every screen height gives the same pace. */
export const FALL_SPEED_START = 0.25;
export const FALL_SPEED_RAMP = 0.0025;
export const FALL_SPEED_MAX = 0.63;
export const NEEDED_RATIO = 0.55;
export const LETTER_SIZE = 40;
export const LETTER_HIT_SIZE = 50;

// Timing and effects
export const RESULT_DELAY = 0.8; // seconds
export const RESULT_INPUT_GUARD_MS = 500;
export const COMPLETE_FLASH_MS = 120;
export const FULL_SHAKE_MS = 80;
export const FULL_SHAKE_INTENSITY = 0.004;
// Effects (docs/spec.md "演出・UI")
export const COMPLETE_GHOST_MS = 250;
export const COMPLETE_GHOST_SCALE = 1.2;
export const COMPLETE_GHOST_ALPHA = 0.7;
export const POP_MS = 600;
export const POP_RISE = 40;
export const POP_STAGGER_MS = 120;
export const POP_START_BELOW = 30;
export const POP_STACK_DY = 24;
export const TIME_BUMP_MS = 300;
export const TIME_BUMP_SCALE = 1.25;
export const WARN_SEC = 10;
export const FULL_RIM_MS = 250;
export const FLY_MS = 120;
export const COUNT_UP_MS = 600;
export const BEST_BLINK_MS = 300;
export const BEST_BLINK_ALPHA = 0.2;
export const BEST_BLINK_COUNT = 3;
export const BUTTON_PRESS_SCALE = 0.97;

// Font sizes (logical px)
export const FONT_TITLE = 40;
export const FONT_TITLE_SUB = 16;
export const FONT_HUD = 18;
export const FONT_TARGET = 24;
export const FONT_MEANING = 14;
export const FONT_LETTER = 26;
export const FONT_TRAY = 22;
export const FONT_HINT = 13;
export const FONT_HELP = 14;
export const FONT_BUTTON = 18;
export const FONT_RESULT_TITLE = 28;
export const FONT_RESULT_SCORE = 22;
export const FONT_RESULT = 16;
export const FONT_POP = 18;

// Layout (logical px)
export const HUD_Y = 4;
export const TARGET_Y0 = 44;
export const TARGET_ROW_STEP = 50;
export const TARGET_LETTER_STEP = 26;
export const MEANING_OFFSET = 22;
export const FIELD_TOP = 180;
export const FLOOR_FROM_BOTTOM = 130;
export const TRAY_SLOT_H = 44;
export const TRAY_GAP = 4;
export const TRAY_BOTTOM_MARGIN = 6;
export const HINT_GAP = 16;
export const BUTTON_W = 180;
export const BUTTON_H = 52;
export const TITLE_BUTTON_FROM_BOTTOM = 130;
export const RESULT_BUTTON_W = 156;
export const RESULT_BUTTON_GAP = 16;
export const RESULT_BUTTON_FROM_BOTTOM = 44;
export const RESULT_LIST_TOP = 124;
export const RESULT_LIST_BOTTOM_MARGIN = 78;
export const RESULT_ROW_H = 26;
/** Rows the list scrolls per mouse-wheel notch. */
export const RESULT_WHEEL_ROWS = 2;

// Persistence
export const BEST_KEY = 'wordfall:best';
