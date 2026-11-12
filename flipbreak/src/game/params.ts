// Every gameplay number of docs/spec.md "パラメータ表" lives here, under the name the spec uses.

// Logical screen (portrait table) and table geometry
export const W = 360;
export const H = 640;
export const FIELD_W = 330;
export const LANE_X = 330;
export const LANE_BALL_X = 345;
export const LANE_FLOOR_Y = 630;
export const LANE_WALL_TOP = 120;
export const DEFLECTOR_X = 300;
export const DEFLECTOR_Y = 80;
export const READY_Y_MARGIN = 40;
export const READY_MAX_VY = 40; // px/s

// Physics
export const PHYSICS_DT = 1 / 240; // s
export const FRAME_DT_MAX = 0.05; // s
export const GRAVITY = 700; // px/s^2
export const BALL_R = 7;
export const MAX_SPEED = 1100; // px/s
export const WALL_E = 0.6;
export const FLIPPER_E = 0.35;
export const BLOCK_E = 1;
export const BUMPER_E = 1;
export const BUMPER_MIN_OUT = 480; // px/s
export const BUMPER_R = 16;

// Flippers
export const FLIPPER_LEN = 58;
export const FLIPPER_R = 7;
export const FLIPPER_REST_DEG = 28;
export const FLIPPER_UP_DEG = -28;
export const FLIPPER_SPEED = 18; // rad/s
export const FLIPPER_LEFT_PIVOT = { x: 95, y: 560 } as const;
export const FLIPPER_RIGHT_PIVOT = { x: 235, y: 560 } as const;

// Plunger
export const LAUNCH_MIN = 450; // px/s
export const LAUNCH_MAX = 1100; // px/s
export const CHARGE_TIME = 1.0; // s
export const CHARGE_BAR_MAX = 120;
export const CHARGE_BAR_W = 18; // drawn behind the ball, centred in the lane
export const CHARGE_MID = 0.5; // charge where the bar turns from green to yellow
export const CHARGE_MARK = 0.8; // charge where it turns orange: about the weakest launch that reaches the table

// Blocks
export const BLOCK_COLS = 8;
export const BLOCK_X0 = 21;
export const BLOCK_Y0 = 60;
export const BLOCK_W = 36;
export const BLOCK_H = 18;

// Rules
export const STAGE_COUNT = 5;
export const LIVES = 3;
export const SCORE_BLOCK = 100;
export const BUMPER_SCORE = 10;
export const CLEAR_PAUSE = 1.0; // s
export const RESULT_DELAY = 0.8; // s
// Special blocks and the multiball (docs/spec/multiball.md)
export const MULTI_BALL_MAX = 3; // balls on the table at once
export const MULTI_SIDE_VX = 120; // px/s: sideways speed of an added ball when the breaking ball has no vx
export const SPECIAL_COLOR = 0x4df0ff;
export const SPECIAL_STAR_R = 6; // outer radius of the star mark (px)
export const STALL_SPEED = 15; // px/s
export const STALL_TIME = 5; // s

// Screen / rotate prompt
export const ROTATE_PROMPT_SCALE = 0.7;
export const PROMPT_REAL_FONT_SIZE = 18; // on-screen px of the prompt text
export const PROMPT_MAX_FONT_SIZE = 53; // logical px: 6 characters fit one W - 40 line

// Text and buttons (logical px)
export const HUD_FONT_SIZE = 20;
export const HUD_X = 6;
export const HUD_Y = 4;
export const HUD_ROW_H = 24;
export const HELP_FONT_SIZE = 16;
export const HINT_Y = 610;
export const CLEAR_FONT_SIZE = 36;

// Effects (docs/spec.md "演出・UI"); presentation only, none of these touch the rules
export const SHAKE_DURATION = 0.2; // s
export const SHAKE_INTENSITY = 0.006; // Phaser camera.shake strength (about 2 px at this width)
export const DAMAGE_FLASH_ALPHA = 0.35;
export const DAMAGE_FLASH_DURATION = 0.25; // s
export const BALL_BLINK_INTERVAL = 0.1; // s
export const BALL_BLINK_DURATION = 0.6; // s
export const BREAK_FLASH_DURATION = 0.12; // s
export const BREAK_FLASH_SCALE = 1.4;
export const SCORE_POP_RISE = 30; // px
export const SCORE_POP_DURATION = 0.5; // s
export const SCORE_POP_FONT_SIZE = 20;
export const SCORE_BUMP_DURATION = 0.15; // s
export const SCORE_BUMP_SCALE = 1.25;
export const BUMPER_PULSE_DURATION = 0.15; // s
export const BUMPER_PULSE_SCALE = 1.25;
export const CLEAR_POP_DURATION = 0.25; // s
export const CLEAR_POP_FROM = 1.2;
export const TRAIL_COUNT = 6;
export const TRAIL_ALPHA_MAX = 0.35;
export const TRAIL_MIN_SPEED = 300; // px/s
export const TRAIL_JUMP = 80; // px
export const START_PULSE_SCALE = 1.05;
export const START_PULSE_PERIOD = 1.2; // s
export const SCENE_FADE_DURATION = 0.25; // s
export const TITLE_FONT_SIZE = 40;
export const BEST_FONT_SIZE = 22;
export const RESULT_TITLE_FONT_SIZE = 36;
export const RESULT_FONT_SIZE = 24;
export const BUTTON_W = 200;
export const BUTTON_H = 56;
// The spec's "例: 各 160": each Result button, side by side with a gap.
export const RESULT_BUTTON_W = 160;
export const RESULT_BUTTON_GAP = 16;
