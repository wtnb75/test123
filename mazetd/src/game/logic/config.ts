// Every gameplay-relevant number from the spec's parameter table lives here.

export const CANVAS_W = 540;
export const CANVAS_H = 960;
export const HUD_H = 88;
export const BG_COLOR = 0x14202b;

export const GRID_COLS = 9;
export const GRID_ROWS = 12;
export const CELL = 56;
export const BOARD_TOP = 96;
export const BOARD_LEFT = (CANVAS_W - GRID_COLS * CELL) / 2;
export const START_COL = 4;
export const GOAL_COL = 4;

export const WAVE_MAX = 10;
export const LIVES_START = 10;
export const COINS_START = 60;

export const WALL_COST = 5;
export const TURRET_COST = 25;
export const SELL_RATE = 0.5;
export const KILL_REWARD = 2;
export const WAVE_BONUS = 10;

export const ENEMY_COUNT_BASE = 8;
export const ENEMY_COUNT_STEP = 2;
export const ENEMY_HP_BASE = 3;
export const ENEMY_HP_STEP = 2;
export const ENEMY_SPEED = 64;
export const ENEMY_RADIUS = 14;
export const SPAWN_INTERVAL = 0.8;

export const TURRET_RANGE = 112;
export const TURRET_DAMAGE = 1;
export const TURRET_INTERVAL = 0.5;

export const SHOT_FLASH = 0.08;
export const INVALID_FLASH = 0.3;
export const DT_MAX = 0.1;
export const RESULT_INPUT_DELAY = 0.5;

export const SCORE_PER_KILL = 10;
export const SCORE_PER_LIFE = 50;

// Tolerance for comparing accumulated float seconds against interval boundaries.
export const TIME_EPS = 1e-9;

// Presentation timings and sizes (spec: 演出・UI).
export const FADE_TIME = 0.3;
export const RANGE_PULSE = 0.8;
export const KILL_FX = 0.25;
export const POPUP_TIME = 0.6;
export const POPUP_RISE = 30;
export const POPUP_MAX = 12;
export const LEAK_FLASH = 0.3;
export const LIFE_FLASH = 0.4;
export const BANNER_TIME = 1.0;
export const BANNER_FADE = 0.3;
export const BUTTON_FLASH = 0.1;
