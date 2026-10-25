// What the HUD says (docs/spec.md "HUD のメッセージとステータス"): wording, status line, text sizing. No Phaser.

export type InputKind = 'keys' | 'touch';

/** Largest and smallest status-line font size in px (the main information never goes below 14 px). */
export const STATUS_FONT_MAX = 18;
export const STATUS_FONT_MIN = 14;

/** HUD layout numbers (docs/spec.md パラメータ表): left margin, rows' top and gap, font sizes in px. */
export const HUD_LEFT = 20;
export const HUD_MESSAGE_Y = 8;
export const HUD_GAP = 2;
export const HUD_MESSAGE_FONT = 14;
export const HUD_LEGEND_FONT = 12;
/** Right margin of the STAGE button and the gap kept between it and the text rows. */
export const HUD_BUTTON_MARGIN = 20;
export const HUD_BUTTON_GAP = 8;
/** STAGE button width used until the button is laid out. */
export const DEFAULT_STAGE_BUTTON_WIDTH = 90;
/** The band behind the HUD rows (docs/spec.md パラメータ表): padding in px, colour, opacity. */
export const HUD_BAND_PADDING = 6;
export const HUD_BAND_COLOR = 0x0a1f2f;
export const HUD_BAND_ALPHA = 0.7;
/** Draw order: the board's player highlight (5) and "@" (6) < band < HUD texts < GOAL arrow (10). */
export const HUD_BAND_DEPTH = 7;
export const HUD_TEXT_DEPTH = 8;

export const KEY_HINT = 'Move: arrows/QWEA-XZDC/hjklyubn  Run: Shift+dir  Flag: f+dir  Chord: S';
/** Shown after `f`: the next move key sets the flag of that neighbour (docs/spec.md "フラグ操作の詳細"). */
export const FLAG_WAIT_MESSAGE = 'Flag: pick a direction (Esc cancels)';
export const LEGEND_TEXT = 'Orange=mine Green=safe Purple=bad flag';

/** First input kind of a page: touch when the device reports touch points, keys otherwise. */
export const initialInputKind = (maxTouchPoints: number | undefined): InputKind =>
    (maxTouchPoints ?? 0) > 0 ? 'touch' : 'keys';

/** Input kind after a key press / a pointer press (`wasTouch`: the pointer is a finger, not a mouse). */
export const inputKindOfKey = (): InputKind => 'keys';
export const inputKindOfPointer = (wasTouch: boolean): InputKind => (wasTouch ? 'touch' : 'keys');

const cells = (k: number): string => `${k} ${k === 1 ? 'cell' : 'cells'}`;
const mines = (k: number): string => `${k} ${k === 1 ? 'mine' : 'mines'}`;

export const stageStartMessage = (input: InputKind, stageNo: number): string =>
    input === 'keys' ? KEY_HINT : `You enter stage ${stageNo}.`;

export const jumpMessage = (stageNo: number): string => `You jump to stage ${stageNo}.`;

export const invalidStageMessage = (stageMax: number): string => `Stage must be 1-${stageMax}.`;

export const diedMessage = (input: InputKind): string =>
    input === 'keys' ? 'You died. [R]etry [T]itle' : 'You died.';

export const GOAL_MESSAGE = 'You descend the stairs.';

export const flagModeMessage = (on: boolean): string => `Flag mode ${on ? 'on' : 'off'}.`;

/** Message of a flag operation: `after` is the target cell's flag after the toggle, null when nothing changed. */
export const flagMessage = (after: boolean | null): string => {
    if (after === null) {
        return "You can't flag there.";
    }
    return after ? 'You flag the cell.' : 'You unflag the cell.';
};

export type ResultStatus = 'alive' | 'dead' | 'goal' | 'door';


/** The corridor starts (a door was reached) / the walk is over (a room is entered). */
export const DOOR_MESSAGE = 'You walk down the corridor.';
export const ENTER_ROOM_MESSAGE = 'You enter a room.';

/**
 * Message of a move or a chord result. `ruleMessage` is the rule's own tag (undefined for a plain move),
 * `opened` the number of cells the action newly opened (or flagged, for `auto-flagged`).
 */
export const resultMessage = (
    status: ResultStatus,
    ruleMessage: string | undefined,
    opened: number,
    input: InputKind
): string => {
    if (status === 'dead') {
        return diedMessage(input);
    }
    if (status === 'goal') {
        return GOAL_MESSAGE;
    }
    if (status === 'door') {
        return DOOR_MESSAGE;
    }
    switch (ruleMessage) {
        case 'out-of-bounds':
            return 'There is a wall there.';
        case 'auto-opened':
            return opened >= 1 ? `You open ${cells(opened)}.` : 'Nothing to chord here.';
        case 'auto-flagged':
            return `You flag ${mines(opened)}.`;
        case 'not-enough-info':
            return "You can't tell yet.";
        case 'chord-not-available':
            return 'Nothing to chord here.';
        case 'flag-overflow':
            return 'Too many flags around you.';
        default:
            return opened >= 1 ? `You open ${cells(opened)}.` : 'You move.';
    }
};

/** The status line: `Stage:<n>  Score:<n - 1>  High:<h>`. */
export const statusLine = (stageNo: number, highScore: number): string =>
    `Stage:${stageNo}  Score:${stageNo - 1}  High:${highScore}`;

/**
 * Largest integer font size in [min, max] whose text still fits `availableWidth`. `widthAt(size)` is the
 * text's width at that size; when even `min` does not fit, `min` is returned with `wrap: true`.
 */
export const fitFontSize = (
    widthAt: (size: number) => number,
    availableWidth: number,
    max: number = STATUS_FONT_MAX,
    min: number = STATUS_FONT_MIN
): { size: number; wrap: boolean } => {
    for (let size = max; size >= min; size -= 1) {
        if (widthAt(size) <= availableWidth) {
            return { size, wrap: false };
        }
    }
    return { size: min, wrap: true };
};

/** Height of the HUD band: the lowest row bottom plus `padding`; 0 (no band) when there is no row. */
export const hudBandHeight = (rowBottoms: number[], padding: number = HUD_BAND_PADDING): number =>
    rowBottoms.length === 0 ? 0 : Math.max(...rowBottoms) + padding;

/** Top of the legend row: below the status row, and below the STAGE button when there is one (dev). */
export const hudLegendTop = (statusBottom: number, stageButtonBottom: number | null, gap: number = HUD_GAP): number =>
    Math.max(statusBottom + gap, stageButtonBottom === null ? 0 : stageButtonBottom + gap);

/**
 * Width the message and status rows may use: left of the STAGE button (its width + right margin + gap), or
 * the whole width minus both side margins when there is no STAGE button (the production build).
 */
export const hudRowWidth = (screenWidth: number, stageButtonWidth: number | null): number =>
    stageButtonWidth === null
        ? screenWidth - 2 * HUD_LEFT
        : screenWidth - HUD_LEFT - (stageButtonWidth + HUD_BUTTON_MARGIN + HUD_BUTTON_GAP);
