// Every number with gameplay weight lives here (docs/spec.md "パラメータ表").
export const PARAMS = {
    // board
    cols: 5,
    rows: 6,
    cellSize: 80,
    // growing board (docs/spec.md "盤面の広がり"): once, when the line count reaches growLines
    growLines: 10,
    grownCols: 6,
    grownCellSize: 66,
    cellInset: 4,
    playerStartX: 2,
    playerStartY: 5,

    // moves
    startMoves: 30,
    maxMoves: 40,
    movesPerLine: 11,
    shortestBonus: 4,

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
    spawnAttempts: 3000,
    spawnTimeLimitMs: 100,
    solveNodeCap: 60000,
    decoys: 2,
    keepLeftover: 2,
    // easy-board floor and relocation of fixed blocks (docs/spec/board-generation.md)
    floorMin: 5,
    floorGap: 2,
    relocateCount: 2,
    relocateMax: 2,

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
    glowMs: 150,
    glowAlpha: 0.8,
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
    resultShortestGap: 60,
    // distance from the "最短 M 回" row down to the best row
    resultBestGap: 45,
    bestKey: 'pushlineBest',
    recoveredGap: 16,
    recoveredEdgeMargin: 4,
    tapRingRatio: 0.2,
    tapRingWidth: 4,
    tapFrameWidth: 6,

    // title demo (docs/spec.md "Title" > "デモ")
    demoStepMs: 220,
    demoWaitMs: 500,
    demoLines: 4,
    demoFadeMs: 300,
} as const;
