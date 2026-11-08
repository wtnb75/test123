// Prototype parameters (throwaway). Every gameplay number lives here.
export const P = {
    // Logical screen (portrait). The playfield is x 0..FIELD_W, the plunger lane is FIELD_W..W.
    W: 360,
    H: 640,
    FIELD_W: 330,

    // Physics
    PHYSICS_DT: 1 / 240,
    GRAVITY: 700,
    BALL_R: 7,
    MAX_SPEED: 1100,
    WALL_E: 0.6,
    FLIPPER_E: 0.35,
    BLOCK_E: 1,
    BUMPER_E: 1,
    BUMPER_MIN_OUT: 480,

    // Flippers
    FLIPPER_LEN: 58,
    FLIPPER_R: 7,
    FLIPPER_REST_DEG: 28,
    FLIPPER_UP_DEG: -28,
    FLIPPER_SPEED: 18, // rad/s
    FLIPPER_LEFT_PIVOT: { x: 95, y: 560 },
    FLIPPER_RIGHT_PIVOT: { x: 235, y: 560 },

    // Plunger
    LAUNCH_MIN: 450,
    LAUNCH_MAX: 1100,
    CHARGE_TIME: 1.0, // s to full charge
    LANE_X: 330,
    LANE_BALL_X: 345,
    LANE_FLOOR_Y: 630,

    // Blocks (8 columns)
    BLOCK_COLS: 8,
    BLOCK_X0: 21,
    BLOCK_Y0: 60,
    BLOCK_W: 36,
    BLOCK_H: 18,

    // Bumpers
    BUMPER_R: 16,

    // Rules
    LIVES: 3,
    SCORE_BLOCK: 100,
    BUMPER_SCORE: 10,
    CLEAR_PAUSE: 1.0, // s
} as const;
