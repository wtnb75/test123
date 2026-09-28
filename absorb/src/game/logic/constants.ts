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
/** Resting outline of the field. */
export const FIELD_EDGE_WIDTH = 2;
export const FIELD_EDGE_ALPHA = 0.7;
/** An absorbed bullet is drawn being pulled into the player over this many seconds. */
export const ABSORB_SUCK_DURATION = 0.25;
export const ABSORB_TRAIL_COUNT = 3;
/** Each afterimage shows the pulled bullet this many seconds earlier than the one before. */
export const ABSORB_TRAIL_INTERVAL = 0.03;
/** Afterimage k is drawn at opacity 1 - k * ABSORB_TRAIL_ALPHA_STEP. */
export const ABSORB_TRAIL_ALPHA_STEP = 0.25;
export const ABSORB_PULSE_DURATION = 0.15;
/** Field outline width at the start of a pulse, easing back to FIELD_EDGE_WIDTH. */
export const ABSORB_PULSE_WIDTH = 5;
export const ABSORB_RING_DURATION = 0.25;
export const ABSORB_RING_MAX_RADIUS = 120;
export const ABSORB_RING_WIDTH = 3;
/** Debris thrown out by each regular enemy a release bullet kills. */
export const DEBRIS_COUNT = 8;
/** Initial debris speed, easing linearly to a stop over DEBRIS_DURATION. */
export const DEBRIS_SPEED = 240;
export const DEBRIS_DURATION = 0.4;
/** Debris radius at the start, shrinking to 0. */
export const DEBRIS_RADIUS = 4;
/** How far rammer debris is pushed toward white (0 = body color, 1 = white), so it isn't mistaken for enemy bullets. */
export const DEBRIS_RAMMER_WHITEN = 0.5;
/** Shockwave ring drawn at each release, growing from the player's size to a radius set by the bullet count. */
export const RELEASE_RING_DURATION = 0.35;
export const RELEASE_RING_MIN_RADIUS = 100;
export const RELEASE_RING_MAX_RADIUS = 220;
export const RELEASE_RING_MIN_WIDTH = 2;
export const RELEASE_RING_MAX_WIDTH = 8;
/** Camera shake, only for a full-stock release. */
export const RELEASE_SHAKE_DURATION = 0.2;
export const RELEASE_SHAKE_AMPLITUDE = 6;
/** "k HIT ×multiplier" counter shown from a release's second kill; its text size grows with k. */
export const MULTIKILL_FONT_BASE = 24;
export const MULTIKILL_FONT_STEP = 4;
export const MULTIKILL_FONT_MAX = 48;
/** Kill counts at which the counter turns yellow, then orange. */
export const MULTIKILL_TIER_YELLOW = 3;
export const MULTIKILL_TIER_ORANGE = 5;
/** The counter sits this far above the last enemy the release killed. */
export const MULTIKILL_OFFSET_Y = 30;
/** Minimum gap between the counter / result text and the left or right screen edge. */
export const MULTIKILL_EDGE_MARGIN = 16;
export const MULTIKILL_POP_SCALE = 1.4;
export const MULTIKILL_POP_DURATION = 0.15;
/** The "+points" result is this much larger than the counter it replaces. */
export const MULTIKILL_RESULT_SCALE = 1.5;
export const MULTIKILL_RESULT_DURATION = 1;
export const MULTIKILL_RESULT_RISE = 40;
/** Extra lift for the result when the release's last kill was the boss, clearing the boss's own popup. */
export const MULTIKILL_BOSS_OFFSET_Y = 50;
/** Full-screen red tint when the player loses a life. */
export const HIT_TINT_ALPHA = 0.25;
export const HIT_TINT_DURATION = 0.2;
/** Red band along the four screen edges on a hit, strongest at the edge and fading inward. */
export const HIT_EDGE_WIDTH = 64;
export const HIT_EDGE_ALPHA = 0.7;
export const HIT_EDGE_DURATION = 0.4;
/** Red ring spreading from where the player was hit. */
export const HIT_RING_MAX_RADIUS = 140;
export const HIT_RING_WIDTH = 8;
export const HIT_RING_DURATION = 0.35;
/** Game-over breakdown lines appear one after another, each fading in. */
export const GAMEOVER_ROW_INTERVAL = 0.12;
export const GAMEOVER_ROW_FADE = 0.2;
/** The retry hint fades in over this once retry input is accepted. */
export const GAMEOVER_HINT_FADE = 0.2;
/** Longest frame step fed to the simulation, so a tab switch doesn't teleport everything. */
export const MAX_DT = 0.05;
/** Opacity of the black veil over the game while it is auto-paused. */
export const PAUSE_DIM_ALPHA = 0.6;

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

export const SPLITTER_HP = 4;
export const SPLITTER_SCORE = 400;
export const SPLITTER_RADIUS = 18;
export const SPLITTER_FIRE_INTERVAL = 1.5;
export const SPLITTER_Y_RATIO = 0.15;
export const SPLITTER_DRIFT_SPEED = 40;
/** A splitter killed by a release bullet splits into this many children... */
export const SPLITTER_CHILD_COUNT = 2;
export const SPLITTER_CHILD_HP = 1;
export const SPLITTER_CHILD_SCORE = 100;
export const SPLITTER_CHILD_RADIUS = 8;
/** ...which scatter sideways for a moment, then dash straight at where the player was. */
export const SPLITTER_SCATTER_SPEED = 120;
export const SPLITTER_SCATTER_DURATION = 0.4;
export const SPLITTER_CHILD_SPEED = 260;
/** A scattering child blinks white over its last SPLITTER_DASH_WARN seconds, toggling every blink step. */
export const SPLITTER_DASH_WARN = 0.15;
export const SPLITTER_DASH_WARN_BLINK = 0.05;
/** White outline that keeps the small children visible; drawing only, the hit radius is unchanged. */
export const SPLITTER_CHILD_OUTLINE_WIDTH = 1.5;
export const SPLITTER_CHILD_OUTLINE_ALPHA = 0.7;
/** Ring spreading from where a splitter split, from its body radius outward. */
export const SPLIT_RING_DURATION = 0.2;
export const SPLIT_RING_MAX_RADIUS = 40;
export const SPLIT_RING_WIDTH = 3;

export const CARRIER_HP = 12;
export const CARRIER_SCORE = 1500;
export const CARRIER_RADIUS = 30;
/** A carrier crosses the screen at this height (fraction of the screen height)... */
export const CARRIER_Y_RATIO = 0.1;
export const CARRIER_SPEED = 60;
/** ...on its own schedule: first at CARRIER_FIRST_AT, then CARRIER_INTERVAL after the previous one appeared. */
export const CARRIER_FIRST_AT = 70;
export const CARRIER_INTERVAL = 35;
/** It drops its first enemy this long after its centre comes on screen, then one every drop interval. */
export const CARRIER_FIRST_DROP = 1.5;
export const CARRIER_DROP_INTERVAL = 3;
/** A dropping carrier's centre mark flashes white for this long. */
export const CARRIER_DROP_FLASH = 0.15;

export type EnemyKind = 'grunt' | 'shooter' | 'heavy' | 'rammer' | 'splitter';

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
    rammer: { hp: 3, score: 300, radius: 14, fireInterval: 0 },
    splitter: { hp: SPLITTER_HP, score: SPLITTER_SCORE, radius: SPLITTER_RADIUS, fireInterval: SPLITTER_FIRE_INTERVAL }
};

/** A splitter's child: never spawned on its own, so kept out of EnemyKind and the spawn tables. */
export const SPLITTER_CHILD_SPEC: EnemySpec = {
    hp: SPLITTER_CHILD_HP, score: SPLITTER_CHILD_SCORE, radius: SPLITTER_CHILD_RADIUS, fireInterval: 0
};

/** The boss and splitter children are kept out of EnemyKind so the regular spawn tables and ENEMY_SPECS stay unchanged. */
export type ActorKind = EnemyKind | 'splitterChild' | 'carrier' | 'boss';

/** The carrier: scheduled like the boss, so kept out of EnemyKind and the spawn tables too. */
export const CARRIER_SPEC: EnemySpec = { hp: CARRIER_HP, score: CARRIER_SCORE, radius: CARRIER_RADIUS, fireInterval: 0 };

/** How a killed regular enemy is reported (debris, breakdown): splitter children count as splitters. */
export type DefeatKind = EnemyKind | 'carrier';

/** The kinds a carrier can carry: the ones the regular spawn picks from. */
export type CargoKind = Exclude<EnemyKind, 'rammer'>;

export const BOSS_FIRST_AT = 45;
export const BOSS_RESPAWN_DELAY = 60;
export const BOSS_HP_BASE = 60;
export const BOSS_HP_STEP = 30;
export const BOSS_SCORE_PER_HP = 125;
export const BOSS_RADIUS = 48;
export const BOSS_Y_RATIO = 0.3;
export const BOSS_ENTER_SPEED = 100;
export const BOSS_SWAY_SPEED = 80;
export const BOSS_FIRE_INTERVAL = 0.8;
export const BOSS_RADIAL_COUNT = 16;
export const BOSS_FAN_COUNT = 5;
export const BOSS_FAN_STEP = Math.PI / 15;
export const BOSS_CHARGE_INTERVAL = 8;
export const BOSS_CHARGE_WARN = 1;
export const BOSS_CHARGE_SPEED = 380;
export const BOSS_CHARGE_PAUSE = 0.5;
export const BOSS_RETURN_SPEED = 200;
export const BOSS_CONTACT_DAMAGE = 10;
export const BOSS_ANNOUNCE_DURATION = 1.5;
export const BOSS_BAR_WIDTH_RATIO = 0.5;
export const BOSS_BAR_HEIGHT = 16;
export const BOSS_LABEL_SIZE = 22;
/** The announcement fades out over its last BOSS_ANNOUNCE_FADE seconds. */
export const BOSS_ANNOUNCE_FADE = 0.5;
export const BOSS_HIT_FLASH = 0.06;
export const BOSS_HIT_FLASH_WIDTH = 4;
export const BOSS_DEFEAT_RING_DURATION = 0.6;
/** The second defeat ring starts this long after the first. */
export const BOSS_DEFEAT_RING_DELAY = 0.15;
export const BOSS_DEFEAT_RING_MAX_RADIUS = 160;
export const BOSS_SCORE_POPUP_DURATION = 1;
export const BOSS_SCORE_POPUP_RISE = 40;
