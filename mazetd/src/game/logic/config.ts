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
export const SLOW_TOWER_COST = 20;
export const SPLASH_TOWER_COST = 40;
export const SELL_RATE = 0.5;
export const KILL_REWARD = 2;
export const WAVE_BONUS = 10;

// Path cost of one cell (proportional to the time spent in it); the weight of a step is the sum of both cells.
export const COST_PLAIN = 1;
export const COST_SWAMP = 2;

// The game's fixed terrain as [row, col] pairs (row 0 is the start row); every other cell is plain.
export const INITIAL_ROCKS: ReadonlyArray<readonly [number, number]> = [[2, 2], [3, 6], [5, 4], [6, 1], [8, 6]];
export const INITIAL_SWAMPS: ReadonlyArray<readonly [number, number]> = [
    [3, 3], [3, 4], [4, 3], [7, 3], [7, 4], [9, 2], [9, 3], [10, 5], [10, 6]
];

export const ENEMY_COUNT_BASE = 8;
export const ENEMY_COUNT_STEP = 2;
export const ENEMY_HP_BASE = 3;
export const ENEMY_HP_STEP = 2;
export const ENEMY_SPEED = 64;
/** Enemies walk at this fraction of ENEMY_SPEED while their position belongs to a swamp cell. */
export const SWAMP_SPEED_RATE = 0.5;
export const ENEMY_RADIUS = 14;
export const SPAWN_INTERVAL = 0.8;

export const TURRET_RANGE = 112;
export const TURRET_DAMAGE = 1;
export const TURRET_INTERVAL = 0.5;

/** Enemies within SLOW_RANGE of a slow tower walk at SLOW_RATE times their speed; several towers don't stack. */
export const SLOW_RANGE = 100;
export const SLOW_RATE = 0.5;

/** Splash tower: attacks like a turret, and damages every enemy within SPLASH_RADIUS of the target. */
export const SPLASH_RANGE = 90;
export const SPLASH_RADIUS = 40;
export const SPLASH_INTERVAL = 1.0;
export const SPLASH_DAMAGE = 1;

// Tool bar: five tools in one row, then the Start button.
export const TOOL_W = 104;
export const TOOL_GAP = 4;
export const TOOL_H = 72;
export const START_H = 64;

export const SHOT_FLASH = 0.08;
/** A splash tower fires only once a second, so its line and ring stay (and fade) longer than a turret's line. */
export const SPLASH_FLASH = 0.3;
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
