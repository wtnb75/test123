// Every number with gameplay weight, one place (docs/spec.md "パラメータ表").

// Run
export const TIME_LIMIT_SEC = 45;
export const NORMA = 15;
export const CAT_PENALTY = 2;
export const ENDING_SEC = 1.2;

// Spawning
export const FIRST_SPAWN_SEC = 0.3;
export const SPAWN_INTERVAL_SEC = 0.9;
export const MAX_ACTIVE = 4;
export const LIFE_SEC = 2.2;
export const CAT_RATIO = 0.2;
/** Share of cats that are decoys: they get the same direction arrow as a mole. */
export const DECOY_RATIO = 0.5;
export const BACK_SPAWN_RATIO = 0.6;

// Cube and holes (lengths in cube units: the half edge is 1)
export const HOLES_PER_SIDE = 3;
export const HOLE_SPACING = 0.62;
export const HOLE_RADIUS = 0.2;
export const MOLE_RADIUS = 0.17;
export const POP_HEIGHT = 0.3;
export const POP_IN_SEC = 0.18;
export const POP_OUT_SEC = 0.18;
export const HIT_MIN_POP_RATIO = 0.3;
export const HIT_RADIUS_PX = 32;

// View
export const CUBE_SCALE_PX = 120;
export const CAMERA_DISTANCE = 6;
export const INITIAL_TILT_X = 0.55;
export const INITIAL_TURN_Y = 0.7;
export const HIDDEN_NORMAL_Z = 0.25;

// Input
export const DRAG_RAD_PER_PX = 0.01;
export const DRAG_THRESHOLD_PX = 10;
export const KEY_ROTATE_RAD_PER_SEC = 2;
export const MAX_TOUCH_POINTERS = 4;
export const RESULT_INPUT_GUARD_SEC = 0.3;

// Direction arrows
export const ARROW_RING_PX = 242;
export const ARROW_TIP_PX = 22;
export const ARROW_BACK_PX = 12;
export const ARROW_HALF_WIDTH_PX = 16;
export const ARROW_BLINK_SEC = 0.6;
export const ARROW_BLINK_RATE = 8;
/** Below this length of the (x, y) part of a hidden hole, its direction is taken as "straight behind". */
export const ARROW_POLE_EPSILON = 0.05;

// Logical screen size (the short side is fixed; the long side follows the viewport)
export const SCREEN_SHORT_SIDE_PX = 540;
export const SCREEN_LONG_SIDE_MIN_PX = 540;
export const SCREEN_LONG_SIDE_MAX_PX = 1170;

// UI
export const HUD_MARGIN_PX = 16;
export const HUD_FONT_PX = 32;
export const FLOAT_TEXT_SEC = 0.5;
export const FLOAT_TEXT_RISE_PX = 60;
export const FLOAT_TEXT_FONT_PX = 40;
export const HIT_RING_SEC = 0.25;
export const HIT_RING_START_RADIUS_PX = 20;
export const HIT_RING_END_RADIUS_PX = 60;
export const HIT_RING_STROKE_PX = 4;
export const LOW_TIME_SECONDS = 10;
export const LOW_TIME_SCALE = 1.25;
export const LOW_TIME_PULSE_SEC = 0.3;
export const ARROW_PULSE_SCALE = 1.15;
export const ARROW_PULSE_SEC = 1.0;
export const CAT_SHAKE_SEC = 0.15;
export const CAT_SHAKE_INTENSITY = 0.01;
export const BANNER_FONT_PX = 44;
export const BUTTON_WIDTH_PX = 260;
export const BUTTON_HEIGHT_PX = 80;
/** Scene fade-in (docs/spec.md "Scene の始まり": 0.3 s or less). */
export const SCENE_FADE_SEC = 0.25;
