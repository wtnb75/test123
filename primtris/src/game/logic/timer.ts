// The wait before a number falls on its own (docs/spec.md "パラメータ表" and "待ち時間"). Pure, no Phaser.

export const WAIT_START_MS = 8000;
export const WAIT_STEP_MS = 250;
export const WAIT_MIN_MS = 2500;

/** The wait for the number that becomes READY after `placed` numbers have been dropped. */
export const waitMs = (placed: number): number => Math.max(WAIT_MIN_MS, WAIT_START_MS - WAIT_STEP_MS * placed);

/** One frame of the wait: counts `deltaMs` down, unless the number is held (then it stays frozen). */
export const stepWait = (leftMs: number, deltaMs: number, held: boolean): number =>
    held ? leftMs : Math.max(0, leftMs - deltaMs);

/** The seconds shown in the HUD: rounded down to one decimal, and never below 0.0. */
export const remainingSeconds = (ms: number): number => Math.max(0, Math.floor(ms / 100) / 10);
