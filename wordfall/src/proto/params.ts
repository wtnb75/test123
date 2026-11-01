// Prototype parameters. Every tunable number lives here (mirrors the spec-lite table).

export const WORLD_W = 360;
export const WORLD_H = 640;

// Targets
export const TARGET_COUNT = 3;
/** Selection weight per word length (3..8). */
export const LENGTH_WEIGHT: Record<number, number> = { 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1 };

// Tray
export const TRAY_CAPACITY = 10;

// Time
export const START_TIME_SEC = 60;
/** Seconds added on completing a word = length * this. */
export const BONUS_SEC_PER_LETTER = 1;

// Score
/** Score for completing a word of the given length. */
export const SCORE_BY_LENGTH: Record<number, number> = { 3: 30, 4: 50, 5: 80, 6: 120, 7: 170, 8: 230 };

// Falling letters
export const COLUMNS = 8;
export const SPAWN_INTERVAL_MS = 650;
export const FALL_SPEED_START = 80; // px/s
export const FALL_SPEED_RAMP = 0.8; // px/s added per second elapsed
export const FALL_SPEED_MAX = 200;
/** Probability that a spawned letter is one still needed by a target (else a random decoy). */
export const NEEDED_RATIO = 0.55;

// Layout
export const HUD_Y = 6;
export const ROW_Y = [56, 112, 168];
export const FALL_TOP = 205;
export const FLOOR_Y = 520;
export const TRAY_Y = 575;
export const LETTER_SIZE = 38;
