export const STAGE_COUNT = 10;

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 600;
export const ROUTE_MARGIN = 60;

export const EDGE_LINE_WIDTH = 6;
export const COLLISION_TOLERANCE = EDGE_LINE_WIDTH / 2;

export const JUMP_DURATION_MS = 400;
export const CHARACTER_PIXEL_SPEED_PER_SEC = 130;
export const CIRCLE_WARNING_MS = 500;

export const MEASURE_STEP_MS = 1000 / 60;
export const MEASURE_RUNS = 200;
export const MEASURE_TIMEOUT_MS = 120000;

// Target travel time of the stage routes (seconds): linear from stage 1 to stage STAGE_COUNT, within the tolerance.
export const ROUTE_TIME_START_S = 7;
export const ROUTE_TIME_END_S = 9;
export const ROUTE_TIME_TOLERANCE_S = 0.1;

// Divisions of the spline arc-length table. Equals Phaser's Curve arcLengthDivisions default; keep it so
// measured positions match the Game scene.
export const SPLINE_ARC_DIVISIONS = 100;

// Circle placement (docs/spec.md, "円の位置の決め方").
export const PATTERN_COUNT = 3;
export const PATTERN_SEED_STRIDE = 100;
export const FORWARD_RATIO_START = 0.6;
export const FORWARD_RATIO_END = 0.8;
export const FORWARD_MIN_MS = 1000;
export const FORWARD_MAX_MS = 3000;
export const OFFSET_MIN_PX = 40;
export const OFFSET_MAX_PX = 240;
