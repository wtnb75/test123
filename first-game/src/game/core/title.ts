// Pure logic of the Title screen (docs/spec/title.md): which keys start the game and where things go.

export type TitleLayout = {
  /** Horizontal centre of the name and the button (rounded px). */
  centerX: number;
  /** Vertical centres (rounded px). */
  nameY: number;
  buttonY: number;
  /** Font size of the game name (px). */
  fontSize: number;
  buttonWidth: number;
  buttonHeight: number;
};

export const TITLE_NAME_Y_RATIO = 0.38;
export const TITLE_BUTTON_Y_RATIO = 0.62;
export const TITLE_FONT_MIN = 24;
export const TITLE_FONT_MAX = 48;
export const TITLE_BUTTON_MAX_WIDTH = 200;
/** Space kept on the left and on the right of a narrow button. */
export const TITLE_BUTTON_SIDE_MARGIN = 16;
export const TITLE_BUTTON_HEIGHT = 64;

/** Layout for a canvas of `width` x `height` px. The name's font size follows the width (15 letters must fit). */
export const titleLayout = (width: number, height: number): TitleLayout => ({
  centerX: Math.round(width / 2),
  nameY: Math.round(height * TITLE_NAME_Y_RATIO),
  buttonY: Math.round(height * TITLE_BUTTON_Y_RATIO),
  fontSize: Math.min(TITLE_FONT_MAX, Math.max(TITLE_FONT_MIN, Math.floor(width / 10))),
  buttonWidth: Math.max(0, Math.min(TITLE_BUTTON_MAX_WIDTH, width - TITLE_BUTTON_SIDE_MARGIN * 2)),
  buttonHeight: TITLE_BUTTON_HEIGHT
});

/** Enter and Space start the game (by `KeyboardEvent.code`); a held key (auto-repeat) does not. */
export const isStartKey = (code: string, repeat: boolean): boolean =>
  !repeat && (code === 'Enter' || code === 'Space');
