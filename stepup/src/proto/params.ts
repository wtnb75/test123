// All tunable numbers of the prototype live here (mirrors docs/spec.md table).
export const P = {
    width: 360,
    height: 640,

    // player
    playerW: 20,
    playerH: 28,
    moveSpeed: 190, // px/s
    gravity: 1500, // px/s^2
    jumpSpeed: 560, // px/s (apex ~ 104px)
    maxFall: 900,

    // platforms
    platW: 80,
    platH: 10,
    platLife: 3.0, // s
    maxPlatforms: 2,

    // auto scroll
    scrollBase: 32, // px/s at height 0
    scrollPerMeter: 0.05, // extra px/s per meter climbed
    scrollMax: 45,
    metersPerPx: 0.1,

    // touch: swipe to move, tap to act (second finger taps while swiping)
    tapMaxMove: 12, // px a finger may travel and still be a tap
    tapMaxMs: 300, // ms a finger may stay down and still be a tap
    swipeDead: 8, // px from the anchor before movement starts
    swipeRadius: 28, // px the anchor trails behind the finger (reversing is quick)

    // jump lock: no platform building for a moment after jumping off the ground
    jumpLock: 0.3, // s

    // stage 1 goal
    goalMeters: 200,
    goalViewMargin: 170, // px between the view top and the goal line when scrolling stops
    goalH: 14,

    // bullets
    bulletR: 7,
    bulletSpeedBase: 200,
    bulletSpeedPerMeter: 0.8,
    bulletSpeedMax: 380,
    warnTime: 0.8, // s the warning mark shows before the bullet appears
    spawnIntervalBase: 1.2, // s
    spawnIntervalMin: 0.45,
    spawnIntervalPerMeter: 0.004, // s shaved per meter
    bulletsAtOnceMeters: 90, // from this height, two bullets per spawn
    // diagonal bullets
    diagonalStartMeters: 8,
    diagonalChanceBase: 0.25,
    diagonalChancePerMeter: 0.003,
    diagonalChanceMax: 0.65,
    bulletVx: 110, // px/s sideways for diagonal bullets

    // start ground
    groundH: 40, // distance from the bottom of the world to the start ground (world coords)
    startScreenRatio: 0.5, // where the start ground sits on the screen (0 = top, 1 = bottom)
} as const;
