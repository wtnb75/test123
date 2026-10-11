// Layout and hit test of the game-over buttons (docs/spec.md "ボタン（RETRY / NEW GAME）", "ボタン（TITLE）").

export type ButtonBox = {
  /** Centre (canvas px). */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RestartButtonLayout = {
  retry: ButtonBox;
  newGame: ButtonBox;
  title: ButtonBox;
};

/** What a restart / leave request chooses: the same stage again, a new game, or the title screen. */
export type RestartChoice = 'retry' | 'new' | 'title';

export const RESTART_BUTTON_WIDTH = 140;
export const RESTART_BUTTON_HEIGHT = 44;
export const RESTART_BUTTON_GAP = 16;
/** The row of RETRY / NEW GAME is centred at this fraction of the canvas height. */
export const RESTART_ROW_Y_RATIO = 0.72;

/** RETRY and NEW GAME side by side, TITLE one row (height + gap) below, centred. */
export const restartButtonLayout = (width: number, height: number): RestartButtonLayout => {
  const rowY = height * RESTART_ROW_Y_RATIO;
  const offsetX = RESTART_BUTTON_WIDTH / 2 + RESTART_BUTTON_GAP / 2;
  const box = (x: number, y: number): ButtonBox => ({
    x,
    y,
    width: RESTART_BUTTON_WIDTH,
    height: RESTART_BUTTON_HEIGHT
  });
  return {
    retry: box(width / 2 - offsetX, rowY),
    newGame: box(width / 2 + offsetX, rowY),
    title: box(width / 2, rowY + RESTART_BUTTON_HEIGHT + RESTART_BUTTON_GAP)
  };
};

const inside = (b: ButtonBox, x: number, y: number): boolean =>
  Math.abs(x - b.x) <= b.width / 2 && Math.abs(y - b.y) <= b.height / 2;

/** What a release at (x, y) on the game-over screen chooses: TITLE, RETRY, or (anywhere else) a new game. */
export const restartButtonAt = (layout: RestartButtonLayout, x: number, y: number): RestartChoice => {
  if (inside(layout.title, x, y)) {
    return 'title';
  }
  if (inside(layout.retry, x, y)) {
    return 'retry';
  }
  return 'new';
};
