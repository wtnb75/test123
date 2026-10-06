// All tunable numbers of the prototype live here (mirrors the spec-lite table).
export const PARAMS = {
    landscape: { width: 1024, height: 768 },
    portrait: { width: 768, height: 1024 },
    panelSize: 400,
    panelGap: 64,
    stageCount: 5,
    // per-stage tables (index = stage - 1)
    shapeCounts: [12, 18, 24, 30, 36],
    shapeSizeMax: [48, 44, 40, 36, 32],
    shapeSizeMin: 20,
    diffCounts: [3, 4, 5, 6, 7],
    timeLimits: [60, 55, 50, 45, 40],
    // how big a change is: hue shift in degrees, move distance px, scale ratio
    hueShift: [120, 80, 55, 40, 30],
    moveDist: [60, 44, 32, 24, 18],
    scaleDelta: [0.6, 0.45, 0.35, 0.28, 0.22],
    // min centre distance = (r1 + r2) * overlapFactor; < 1 lets shapes overlap
    overlapFactor: 0.65,
    bgDots: 14,
    missPenalty: 5,
    hitMargin: 14,
    stageClearPauseMs: 900,
} as const;
