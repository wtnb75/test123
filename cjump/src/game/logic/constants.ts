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
