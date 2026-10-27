// Every number with gameplay weight (docs/spec.md "パラメータ表"), under the table's names.

export const SCREEN_WIDTH = 540;
export const SCREEN_HEIGHT_MIN = 756;
export const SCREEN_HEIGHT_MAX = 1170;
export const ROTATE_PROMPT_SCALE = 0.54;

export const PADDLE_WIDTH = 110;
export const PADDLE_HEIGHT = 16;
export const PADDLE_BOTTOM_MARGIN = 100;
export const PADDLE_KEY_SPEED = 720; // px/s
export const PADDLE_MAX_ANGLE = 60; // degrees from straight up

export const BALL_RADIUS = 9;
export const ENEMY_BALL_SPEED = 240; // px/s
export const ENEMY_BALL_SPREAD = 20; // degrees from straight down
export const MY_BALL_SPEED = 460; // px/s

export const ENEMY_COLS = 6;
export const ENEMY_ROWS_BASE = 3;
export const ENEMY_ROWS_EVERY_WAVES = 2;
export const ENEMY_ROWS_MAX = 6;
export const ENEMY_WIDTH = 56;
export const ENEMY_HEIGHT = 30;
export const ENEMY_GAP = 14;
export const FIELD_TOP = 64; // the top wall, just below the HUD row
export const FRAME_WIDTH = 8; // px, the visible walls
export const FIELD_LEFT = FRAME_WIDTH; // inner face of the left wall
export const FIELD_RIGHT = SCREEN_WIDTH - FRAME_WIDTH; // inner face of the right wall
export const FORMATION_TOP = 130;
export const FORMATION_SPEED = 50; // px/s with every enemy alive
export const FORMATION_SPEEDUP = 2; // up to (1 + this) x as the formation empties
export const FORMATION_TURNS_TO_INVADE = 25; // turns until an untouched formation reaches the danger line
export const DANGER_MARGIN = 80; // danger line height above the paddle centre (px)

export const FIRE_INTERVAL_BASE = 1.2; // s
export const FIRE_INTERVAL_DECAY = 0.85;
export const FIRE_INTERVAL_MIN = 0.45; // s

export const LIVES = 3;
export const SCORE_PER_ENEMY = 10;
export const WAVE_DELAY = 1.0; // s
export const RESULT_DELAY = 0.8; // s
export const MAX_FRAME_DT = 0.05; // s

export const SHAKE_DURATION = 150; // ms
export const SHAKE_INTENSITY = 0.01;

export const TITLE_FONT_SIZE = 48;
export const HUD_FONT_SIZE = 26;
export const HELP_FONT_SIZE = 21;
export const PROMPT_REAL_FONT_SIZE = 18; // on-screen px of the rotate prompt text
// Effects and UI (docs/spec.md "演出・UI").
export const HINT_TIMEOUT = 3.0; // s
export const HINT_FADE = 0.3; // s
export const KILL_FLASH_DURATION = 0.2; // s
export const KILL_FLASH_SCALE = 1.5;
export const COMBO_MAX_TIER = 4; // own-ball tier cap; a kill scores SCORE_PER_ENEMY x wave x tier
export const SCORE_POP_DURATION = 0.9; // s
export const SCORE_POP_RISE = 48; // px
export const SCORE_POP_FONT_SIZE = 28; // logical px at tier 1
export const SCORE_POP_TIER_STEP = 4; // px added per tier above 1
export const SCORE_POP_STROKE = 4; // px outline
export const SCORE_BUMP_SCALE = 1.3; // HUD SCORE scale right after a kill
export const SCORE_BUMP_DURATION = 0.25; // s back to 1.0
export const CATCH_FLASH_DURATION = 0.1; // s
export const CATCH_RING_DURATION = 0.2; // s
export const CATCH_RING_RADIUS = 24; // px
export const DAMAGE_FLASH_ALPHA = 0.25;
export const DAMAGE_FLASH_DURATION = 0.15; // s
export const LIFE_BLINK_INTERVAL = 0.1; // s
export const LIFE_BLINK_DURATION = 0.4; // s
export const WAVE_TEXT_POP_DURATION = 0.25; // s
export const WAVE_TEXT_POP_FROM = 0.6;
export const SCENE_FADE_DURATION = 0.2; // s

export const PROMPT_MAX_FONT_SIZE = 83; // logical px cap: 6 characters per 500 px line (normally 2 lines; always fits)
export const BUTTON_WIDTH = 220;
export const BUTTON_HEIGHT = 84;
