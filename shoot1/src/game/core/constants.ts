// ゲームの定数
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;

export const PLAYER_RADIUS = 12;
export const PLAYER_SPEED = 280;
export const BULLET_BASE_SPEED = 180;
export const BULLET_RADIUS = 5;
export const ENEMY_RADIUS = 14;
export const MINE_RADIUS = 12;
export const MINE_EXPLODE_RADIUS = 120;
export const MINE_TIMEOUT_SEC = 10;
export const MINE_BLINK_SEC = 3;
export const MINE_PLACE_GRACE_SEC = 0.5;
export const MINE_INITIAL_COUNT = 3;
export const MINE_CHAIN_RADIUS_MULTIPLIER = 1.5;
export const SCORE_MULTIPLIER = 10;

// Presentation only (no effect on hit tests)
export const MINE_RIPPLE_START_RADIUS = 12;
export const MINE_RIPPLE_END_RADIUS = 30;
export const MINE_RIPPLE_SEC = 0.3;
export const MINE_RIPPLE_ALPHA = 0.8;
export const BULLET_VISUAL_RADIUS_MAX = 6;
export const BULLET_TAIL_LENGTH = 14;

// Backdrop (retro look). Colours are per difficulty stage 1–6.
export const BG_COLORS = [0x0a0a1a, 0x100a1e, 0x160a22, 0x1c0a26, 0x220a2a, 0x280a2e];
export const BG_STAR_COUNT = 40;
export const BG_STAR_SPEED_MIN = 30;
export const BG_STAR_SPEED_MAX = 60;
export const BG_SCANLINE_GAP = 4;
export const BG_SCANLINE_ALPHA = 0.06;

export const FORMATION_INTERVAL_EARLY_SEC = 4;
export const FORMATION_INTERVAL_SEC = 6;
export const ENEMY_SPEED = 80;

// Solo enemies (rush / stop-and-fire), added on top of the formations
export const SOLO_ENEMY_START_SEC = 30;
export const SOLO_ENEMY_INTERVAL_SEC = 12;
export const RUSH_SPEED = 160;
export const SOLO_STOP_Y = GAME_HEIGHT / 4;
export const SOLO_STOP_SEC = 3;
