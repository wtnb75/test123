export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

// Below this y, the screen is the tray (unplaced parts + score button);
// above it is the placement area where a dropped part gets confirmed.
export const TRAY_TOP_Y = 700;

export const PLACEMENT_CENTER = { x: GAME_WIDTH / 2, y: 380 };

export const TRAY_ROW2_Y = 830;
export const SCORE_BUTTON_Y = 910;

// Offscreen canvas used only to compute the similarity score (see score.ts).
export const SCORE_CANVAS_SIZE = 400;

// Both score canvases are filled with this before drawing parts, so a pixel
// matching it on both sides means "nothing drawn here" and is excluded from
// the score (see score.ts) instead of diluting the average.
export const BACKGROUND_COLOR: [number, number, number] = [255, 255, 255];
export const BACKGROUND_CSS = '#ffffff';

// Gaussian blur radius applied to both score offscreen canvases before
// diffing (see drawing.ts drawFaceOnCanvas / docs/spec.md ルール「位置ズレ
// への許容度」) — softens the score-vs-position-error curve, which was a
// steep cliff (91 -> 64 points for just 3px of offset) without it, since
// small parts lose nearly all overlap with their answer counterpart after
// only a few pixels of misplacement.
export const SCORE_BLUR_RADIUS_PX = 6;
