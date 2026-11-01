// All tunable numbers of the prototype live here (mirrors the spec-lite table).
export const PARAMS = {
    // Logical screen: fixed width, height follows the visible area's aspect ratio
    // (so the OS keyboard shrinks the height, not the text).
    width: 360,
    heightInitial: 480,
    heightMin: 240,
    heightMax: 640,
    floorMargin: 30, // distance from the bottom edge to the floor line
    refFloorY: 450, // floor position the speeds below are defined for
    margin: 8,

    // Words
    fontPx: 22,
    charWidth: 13,
    minLen: 3,
    maxLenStart: 4,
    maxLenCap: 8,
    maxLenEverySec: 20,
    maxOnScreen: 6,

    // Fall speed (px/s) and spawn interval (s) over elapsed seconds
    speedStart: 36,
    speedPerSec: 0.6,
    speedCap: 120,
    spawnStartSec: 2.4,
    spawnMinSec: 0.8,
    spawnDecayPerSec: 0.02,
    firstSpawnSec: 0.4,

    // Life and score
    lives: 3,
    scorePerChar: 10,
    comboStep: 0.1,
    comboMultCap: 3,
    retryDelayMs: 600,
} as const;
