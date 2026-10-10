// Every number with gameplay weight lives here (docs/spec.md "パラメータ表").
export const PARAMS = {
    // board
    cols: 5,
    rows: 6,
    cellSize: 80,
    cellInset: 4,
    playerStartX: 2,
    playerStartY: 5,

    // moves
    startMoves: 30,
    maxMoves: 40,
    movesPerLine: 12,

    // fixed blocks
    initialFixed: 3,
    fixedGrowEvery: 2,
    maxFixed: 7,

    // difficulty / board generation
    solveBase: 6,
    solveGrowEvery: 2,
    solveMax: 10,
    scrambleExtraSteps: 8,
    scrambleMinPulls: 4,
    scrambleRetryFactor: 6,
    scramblePullProb: 0.85,
    spawnAttempts: 300,
    spawnTimeLimitMs: 100,
    solveNodeCap: 60000,
    decoys: 2,
    keepLeftover: 2,

    // input
    swipeMinPx: 24,
    walkStepMs: 70,
    maxUndo: 200,

    // flow
    endingMs: 500,
    resultGuardMs: 400,

    // effects
    playerRadiusRatio: 0.3,
    crossInset: 14,
    crossWidth: 4,
    clearMs: 220,
    clearShrinkScale: 0.2,
    popMs: 220,
    popDelayMs: 110,
    pruneBlinkMs: 120,
    pruneBlinkAlpha: 0.25,
    pruneFadeMs: 500,
    shakeMs: 80,
    shakeIntensity: 0.004,

    // low-moves tension (docs/spec.md "手数の警告" / "手数の危険")
    lowMovesWarn: 10,
    lowMovesCritical: 5,
    warnPeriodMs: 600,
    criticalPeriodMs: 300,
    warnScale: 1.15,
    criticalEdgeAlpha: 0.55,
    edgeWidth: 32,

    // polish (docs/spec.md "演出・UI")
    quitConfirmMs: 2000,
    recoveredMs: 600,
    recoveredRisePx: 40,
    tapMarkMs: 300,
    disabledAlpha: 0.4,
    startPulseMs: 1200,
    startPulseScale: 1.05,
    sceneFadeMs: 150,
    resultCaptionGap: 70,
    recoveredGap: 16,
    recoveredEdgeMargin: 4,
    tapRingRatio: 0.2,
    tapRingWidth: 4,
    tapFrameWidth: 6,
} as const;
