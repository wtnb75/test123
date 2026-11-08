// Every number with gameplay weight (docs/spec.md "パラメータ表"). Tune here, not in the logic.

// Screen
export const SCREEN_WIDTH = 360;
export const SCREEN_HEIGHT_MIN = 520;
export const SCREEN_HEIGHT_MAX = 780;
export const ROTATE_PROMPT_SCALE = 0.875;
export const PROMPT_REAL_FONT_SIZE = 18;
export const PROMPT_MAX_FONT_SIZE = 53;
export const START_Y_RATIO = 0.5;
export const DT_MAX = 1 / 30;

// Player
export const PLAYER_W = 20;
export const PLAYER_H = 28;
export const MOVE_SPEED = 190;
export const GRAVITY = 1500;
export const JUMP_SPEED = 560;
export const MAX_FALL = 900;

// Platforms
export const PLATFORM_W = 80;
export const PLATFORM_H = 10;
export const PLATFORM_LIFE = 3.0;
export const PLATFORM_MIN_ALPHA = 0.3;
export const MAX_PLATFORMS = 2;
export const JUMP_LOCK = 0.3;

// Goal and scroll
export const GOAL_METERS = 200;
export const GOAL_VIEW_MARGIN = 170;
export const GOAL_H = 14;
export const PX_PER_METER = 10;
export const SCROLL_BASE = 32;
export const SCROLL_PER_METER = 0.05;
export const SCROLL_MAX = 45;

// Bullets
export const BULLET_R = 7;
export const BULLET_SPEED_BASE = 200;
export const BULLET_SPEED_PER_METER = 0.8;
export const BULLET_SPEED_MAX = 380;
export const WARN_TIME = 0.8;
export const FIRST_SPAWN_DELAY = 1.0;
export const SPAWN_INTERVAL_BASE = 1.2;
export const SPAWN_INTERVAL_PER_METER = 0.004;
export const SPAWN_INTERVAL_MIN = 0.45;
export const DOUBLE_SPAWN_METERS = 90;
export const DIAGONAL_START_METERS = 8;
export const DIAGONAL_CHANCE_BASE = 0.25;
export const DIAGONAL_CHANCE_PER_METER = 0.003;
export const DIAGONAL_CHANCE_MAX = 0.65;
export const BULLET_VX = 110;
export const BULLET_X_MARGIN = 14;
export const BULLET_OFFSCREEN = 20;
export const WARN_Y = 44;
export const WARN_HALF_W = 9;
export const WARN_BACK = 9;
export const WARN_TIP = 11;

// Touch
export const TAP_MAX_MOVE = 12;
export const TAP_MAX_MS = 300;
export const SWIPE_DEAD = 8;
export const SWIPE_RADIUS = 28;

// Scenes
export const RESULT_DELAY = 0.8;
export const RESULT_INPUT_GUARD_MS = 500;
export const BUTTON_W = 200;
export const BUTTON_H = 56;
export const TITLE_BUTTON_FROM_BOTTOM = 130;
export const RESULT_BUTTON1_FROM_BOTTOM = 140;
export const RESULT_BUTTON2_FROM_BOTTOM = 70;

// Fonts (logical px)
export const FONT_HUD = 18;
export const FONT_HINT = 14;
export const FONT_SUB = 16;
export const FONT_HELP = 14;
export const FONT_RESULT = 18;
export const FONT_BUTTON = 18;
export const FONT_TITLE = 36;
export const FONT_RESULT_TITLE = 32;

// Layout details the spec fixes (docs/spec.md "Title" / "Result" / "Game")
export const HUD_X = 8;
export const HUD_Y = 6;
export const HINT_OFFSET_1 = 50;
export const HINT_OFFSET_2 = 74;
export const TITLE_NAME_Y = 100;
export const TITLE_SUB_Y = 140;
export const TITLE_STAGE_Y = 170;
export const TITLE_HELP_Y = 218;
export const TITLE_HELP_STEP = 24;
export const RESULT_STAGE_Y = 100;
export const RESULT_TITLE_Y = 146;
export const RESULT_REASON_Y = 196;
export const RESULT_HEIGHT_Y = 232;
