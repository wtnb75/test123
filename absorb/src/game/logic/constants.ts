export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;
/** Horizontal margin kept free at both screen edges for spawning and swaying. */
export const EDGE_MARGIN = 40;

export const READY_DURATION = 3;
export const ENDING_DURATION = 1;

export const PLAYER_RADIUS = 10;
export const PLAYER_SPEED = 320;
export const PLAYER_LIVES = 3;
export const PLAYER_INVULNERABLE = 1.5;
export const PLAYER_START_X = GAME_WIDTH / 2;
export const PLAYER_START_Y = GAME_HEIGHT * 0.85;
/** The player may not move above this y (top of the lower half). */
export const PLAYER_MIN_Y = GAME_HEIGHT * 0.5;

export const FIELD_RADIUS = 60;
export const STOCK_MAX = 50;

export const RELEASE_SPEED = 600;
export const RELEASE_SPREAD = Math.PI / 6;
export const RELEASE_TURN_RATE = Math.PI * 2;
export const RELEASE_LIFETIME = 2.5;
export const RELEASE_RADIUS = 4;
export const RELEASE_BONUS_STEP = 0.5;

export const ENEMY_BULLET_RADIUS = 5;
export const THREE_WAY_SPREAD = Math.PI / 12;
export const RADIAL_COUNT = 8;

export const MAX_ENEMIES = 6;
export const MAX_RAMMERS = 3;
export const FIRST_RAMMER_AT = 10;

export const ENTER_SPEED = 150;
export const SWAY_RANGE = 120;
export const SWAY_SPEED = 60;

export const GRUNT_MIN_Y = GAME_HEIGHT * 0.15;
export const GRUNT_MAX_Y = GAME_HEIGHT * 0.3;
export const GRUNT_DIVE_MIN_INTERVAL = 5;
export const GRUNT_DIVE_MAX_INTERVAL = 7;
export const GRUNT_WARN = 0.5;
export const GRUNT_DIVE_SPEED = 320;
export const GRUNT_WEAVE_AMPLITUDE = 40;
export const GRUNT_WEAVE_PERIOD = 0.6;

export const SHOOTER_Y = GAME_HEIGHT * 0.2;
export const SHOOTER_BOB_AMPLITUDE = 30;
export const SHOOTER_BOB_PERIOD = 2;
export const SHOOTER_CROSS_INTERVAL = 8;
export const SHOOTER_CROSS_Y = GAME_HEIGHT * 0.65;
export const SHOOTER_VERTICAL_SPEED = 200;
export const SHOOTER_CROSS_SPEED = 180;

export const HEAVY_Y = GAME_HEIGHT * 0.15;
export const HEAVY_DRIFT_SPEED = 25;

export const RAMMER_Y = GAME_HEIGHT * 0.15;
export const RAMMER_WARN = 1;
export const RAMMER_SPEED = 450;
export const RAMMER_HOMING_FROM = 60;
export const RAMMER_HOMING_DURATION = 0.8;
export const RAMMER_TURN_RATE = Math.PI / 3;

export type EnemyKind = 'grunt' | 'shooter' | 'heavy' | 'rammer';

export interface EnemySpec {
    hp: number;
    score: number;
    radius: number;
    /** Seconds between shots; 0 means the enemy never fires. */
    fireInterval: number;
}

export const ENEMY_SPECS: Record<EnemyKind, EnemySpec> = {
    grunt: { hp: 2, score: 100, radius: 14, fireInterval: 1.6 },
    shooter: { hp: 4, score: 400, radius: 16, fireInterval: 2.0 },
    heavy: { hp: 8, score: 1600, radius: 28, fireInterval: 2.5 },
    rammer: { hp: 3, score: 300, radius: 14, fireInterval: 0 }
};
