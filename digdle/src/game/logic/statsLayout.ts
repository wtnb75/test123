import { BOARD_TOP, type LayoutMetrics } from './gameLayout';

export const STATS_FONT_PX = 14;
export const STATS_LINE_HEIGHT = 20;
export const STATS_CLEAR_FONT_PX = 16;
/** The font of the label while it asks for the second press (it wraps in the button). */
export const STATS_PENDING_FONT_PX = 14;
export const STATS_GAP = 8;
const CLEAR_BUTTON_HEIGHT = 44;
const PORTRAIT_CLEAR_WIDTH = 160;
/** The top of the "choose digits again" button above the bottom edge (the existing result layout). */
export const RESELECT_TOP_FROM_BOTTOM = 70;
const SIDE_MARGIN = 12;
/** Horizontal padding of the pending label inside the button. */
export const STATS_PENDING_PADDING = 12;
const LANDSCAPE_FIRST_LINE_FROM_CENTER = 70;
const LANDSCAPE_BUTTON_OFFSET = 88;

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface StatsLayout {
    /** `one` / `two`: lines of a portrait screen; `rows`: the four lines of the right panel; `empty`: one line. */
    kind: 'one' | 'two' | 'rows' | 'empty';
    centerX: number;
    /** The vertical centre of each stats line, top to bottom. */
    lineCenters: number[];
    button: Rect;
}

export interface StatsLayoutInput {
    layout: LayoutMetrics;
    /** The width of the stats text in one line at `STATS_FONT_PX` (measured by the Scene). */
    oneLineWidth: number;
    empty: boolean;
}

const portrait = ({ layout, oneLineWidth, empty }: StatsLayoutInput): StatsLayout => {
    const centerX = layout.width / 2;
    const buttonY = layout.height - RESELECT_TOP_FROM_BOTTOM - STATS_GAP - CLEAR_BUTTON_HEIGHT;
    const button: Rect = {
        x: centerX - PORTRAIT_CLEAR_WIDTH / 2,
        y: buttonY,
        width: PORTRAIT_CLEAR_WIDTH,
        height: CLEAR_BUTTON_HEIGHT
    };
    const bottom = buttonY - STATS_GAP;

    if (!empty && oneLineWidth > layout.width - SIDE_MARGIN * 2) {
        return {
            kind: 'two',
            centerX,
            lineCenters: [bottom - STATS_LINE_HEIGHT * 1.5, bottom - STATS_LINE_HEIGHT / 2],
            button
        };
    }

    return { kind: empty ? 'empty' : 'one', centerX, lineCenters: [bottom - STATS_LINE_HEIGHT / 2], button };
};

const landscape = ({ layout, empty }: StatsLayoutInput): StatsLayout => {
    const panelWidth = layout.rightPanelWidth;
    const centerX = layout.keyboardStartX + Math.floor(panelWidth / 2);
    const top = Math.max(BOARD_TOP + 8, Math.floor(layout.height / 2) - LANDSCAPE_FIRST_LINE_FROM_CENTER);
    const count = empty ? 1 : 4;

    return {
        kind: empty ? 'empty' : 'rows',
        centerX,
        lineCenters: Array.from({ length: count }, (_, index) => top + index * STATS_LINE_HEIGHT + STATS_LINE_HEIGHT / 2),
        button: { x: layout.keyboardStartX, y: top + LANDSCAPE_BUTTON_OFFSET, width: panelWidth, height: CLEAR_BUTTON_HEIGHT }
    };
};

/** Where the stats lines and the "clear stats" button go on the result screen (spec: stats.md). */
export const computeStatsLayout = (input: StatsLayoutInput): StatsLayout =>
    input.layout.keyboardDock === 'right' ? landscape(input) : portrait(input);
