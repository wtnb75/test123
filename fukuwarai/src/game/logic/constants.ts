export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

// Below this y, the screen is the tray (unplaced parts + score button);
// above it is the placement area where a dropped part gets confirmed.
export const TRAY_TOP_Y = 700;

export const PLACEMENT_CENTER = { x: GAME_WIDTH / 2, y: 380 };

export const TRAY_ROW2_Y = 830;
export const SCORE_BUTTON_Y = 910;

// Drop-target display shown while a part is held (docs/spec.md "ドロップ先の表示").
export const DROP_HINT_LABEL_Y = 24;
export const DROP_HINT_LABEL_FONT_PX = 28;
export const DROP_HINT_LINE_WIDTH_PX = 6;
export const DROP_HINT_DASH_PX = 16;
export const DROP_HINT_GAP_PX = 10;
export const DROP_HINT_CONFIRM_COLOR = 0x2a9d8f;
export const DROP_HINT_TRAY_COLOR = 0xe76f51;
export const DROP_HINT_TINT_ALPHA = 0.1;
// Below every existing object (depth 0) for tint/line; above any part depth
// (depthCounter only grows by 1 per grab) for label and confirm ring.
export const DROP_HINT_TINT_DEPTH = -10;
export const DROP_HINT_DIVIDER_DEPTH = -8;
export const DROP_HINT_LINE_DEPTH = -5;
export const DROP_HINT_TOP_DEPTH = 1000000;
export const CONFIRM_FLASH_MS = 250;
export const CONFIRM_FLASH_LINE_PX = 4;

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

// Result scene: the player's finished face crossfading with the correct face
// in the same place, and the button that stops/restarts it
// (docs/spec.md「Result の見比べ表示」).
export const RESULT_FACE_CENTER_Y = 210;
export const RESULT_FACE_LABEL_Y = 298;
export const RESULT_TOGGLE_Y = 574;
export const RESULT_TOGGLE_HEIGHT_PX = 80;
export const RESULT_RETRY_Y = 650;
export const RESULT_RETRY_HEIGHT_PX = 60;
// Crossfade timing (ms): one fade, and the hold while one face is fully visible.
export const RESULT_FADE_MS = 700;
export const RESULT_HOLD_MS = 1300;
