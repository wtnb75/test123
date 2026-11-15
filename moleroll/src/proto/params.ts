// Prototype parameters. Keep in sync with the table in docs/spec.md.
export const PARAMS = {
    width: 540,
    height: 960,
    timeLimitSec: 45,
    norma: 15,
    catPenalty: 2,
    spawnIntervalSec: 0.9,
    maxActive: 4,
    lifeSec: 2.2,
    catRatio: 0.2,
    backSpawnRatio: 0.6,
    cubeScalePx: 120,
    // Perspective camera distance in cube half-edge units (larger = flatter).
    cameraDistance: 6,
    // Extra pointers added for multi-touch (mouse + 1 touch exist by default).
    extraPointers: 3,
    dragRadPerPx: 0.01,
    dragThresholdPx: 10,
    keyRotateRadPerSec: 2,
    holesPerSide: 3,
    holeSpacing: 0.62,
    holeRadius: 0.2,
    moleRadius: 0.17,
    popHeight: 0.3,
    popInSec: 0.18,
    popOutSec: 0.18,
    hitMinRadiusPx: 26,
    // A face with a rotated normal z below this is treated as "hidden" (arrow shown).
    hiddenNormalZ: 0.25,
    arrowRingPx: 255,
} as const;
