// Every tunable number of the prototype. Keep in sync with docs/spec.md (パラメータ表).
export const PARAMS = {
    width: 540,
    height: 960,

    paddleWidth: 110,
    paddleHeight: 16,
    paddleY: 860,
    paddleKeySpeed: 720, // px/s
    paddleMaxAngleDeg: 60, // deflection from vertical at the paddle edge

    ballRadius: 9,
    enemyBallSpeed: 240, // px/s
    enemyBallSpreadDeg: 20, // random deviation from straight down
    myBallSpeed: 460, // px/s

    enemyCols: 6,
    enemyRowsBase: 3,
    enemyRowsEveryWaves: 2, // +1 row every N waves
    enemyRowsMax: 6,
    enemyWidth: 56,
    enemyHeight: 30,
    enemyGap: 14,
    formationTop: 130,
    formationSpeed: 50, // px/s, sideways

    fireIntervalBase: 1.6, // s, wave 1
    fireIntervalDecay: 0.88, // multiplier per wave
    fireIntervalMin: 0.45, // s

    lives: 3,
    scorePerEnemy: 10, // multiplied by the wave number
    waveDelay: 1.0, // s between clearing a wave and the next formation
} as const;
