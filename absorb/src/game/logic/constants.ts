/** Horizontal margin kept free at both screen edges for spawning and swaying. */
export const EDGE_MARGIN = 40;

export const READY_DURATION = 3;
export const ENDING_DURATION = 1;

export const PLAYER_RADIUS = 10;
export const PLAYER_SPEED = 320;
export const PLAYER_LIVES = 3;
export const PLAYER_INVULNERABLE = 1.5;
/** Stock granted when an enemy rams the player. */
export const HIT_STOCK_BONUS = 10;
/** Start position as a fraction of the screen height (horizontally centered). */
export const PLAYER_START_Y_RATIO = 0.85;
/** Height of the HUD band at the top of the screen, which the player cannot enter. */
export const HUD_HEIGHT = 48;
/** Smallest y the player's center may reach (just below the HUD band). */
export const PLAYER_MIN_Y = HUD_HEIGHT + PLAYER_RADIUS;

export const FIELD_RADIUS = 90;
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
export const MAX_RAMMERS = 6;
export const FIRST_RAMMER_AT = 10;

export const ENTER_SPEED = 150;
export type SpawnEdge = 'top' | 'left' | 'right';
/** How often each screen edge is chosen for a spawn, by screen orientation. */
export const EDGE_WEIGHTS_PORTRAIT: Record<SpawnEdge, number> = { top: 50, left: 25, right: 25 };
export const EDGE_WEIGHTS_LANDSCAPE: Record<SpawnEdge, number> = { top: 70, left: 15, right: 15 };
/** Enemies entering from a side do so at this height range (fraction of the screen height)... */
export const SIDE_Y_MIN_RATIO = 0.15;
export const SIDE_Y_MAX_RATIO = 0.45;
/** ...and stop this far in from the edge they came from (fraction of the screen width). */
export const SIDE_STATION_MIN_RATIO = 0.2;
export const SIDE_STATION_MAX_RATIO = 0.35;
export const SWAY_RANGE = 120;
export const SWAY_SPEED = 60;

export const GRUNT_MIN_Y_RATIO = 0.15;
export const GRUNT_MAX_Y_RATIO = 0.3;
export const GRUNT_DIVE_MIN_INTERVAL = 5;
export const GRUNT_DIVE_MAX_INTERVAL = 7;
export const GRUNT_WARN = 0.5;
export const GRUNT_DIVE_SPEED = 320;
export const GRUNT_WEAVE_AMPLITUDE = 40;
export const GRUNT_WEAVE_PERIOD = 0.6;

export const SHOOTER_Y_RATIO = 0.2;
export const SHOOTER_BOB_AMPLITUDE = 30;
export const SHOOTER_BOB_PERIOD = 2;
export const SHOOTER_SWEEP_INTERVAL = 6;
export const SHOOTER_SWEEP_WARN = 0.6;
export const SHOOTER_ALIGN_SPEED = 300;
export const SHOOTER_SWEEP_SPEED = 360;
export const SHOOTER_RETURN_SPEED = 200;

export const HEAVY_Y_RATIO = 0.15;
/** Heavies hold posts on a ring of this radius around the player... */
export const HEAVY_RING_RADIUS = 180;
export const HEAVY_SURROUND_SPEED = 70;
/** ...and every HEAVY_CYCLE seconds all of them charge the player together. */
export const HEAVY_CYCLE = 5;
export const HEAVY_WARN_AT = 3;
export const HEAVY_CHARGE_AT = 3.5;
export const HEAVY_CHARGE_SPEED = 150;
export const HEAVY_LATE_FROM = 120;
export const HEAVY_SURROUND_SPEED_LATE = 90;
export const HEAVY_CHARGE_SPEED_LATE = 190;

export const RAMMER_Y_RATIO = 0.15;
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
    grunt: { hp: 2, score: 100, radius: 14, fireInterval: 1.0 },
    shooter: { hp: 4, score: 400, radius: 16, fireInterval: 1.5 },
    heavy: { hp: 8, score: 1600, radius: 28, fireInterval: 2.0 },
    rammer: { hp: 3, score: 300, radius: 14, fireInterval: 0 }
};
