import { PARAMS } from '../params';
import type { Shape } from './generate';
import type { LayoutKind, Point } from './layout';
import { layoutFor } from './layout';

/** The texts of the Help screen (docs/spec/how-to-play.md "表示するもの"). */
export const HELP_HEADING = 'HOW TO PLAY';
export const HELP_PROMPT = 'TAP TO CLOSE';
export const HELP_BUTTON_LABEL = 'HOW TO PLAY';
export const HELP_LINES: readonly string[] = [
    'Tap where the two pictures differ.',
    `A wrong tap costs ${PARAMS.missPenalty} seconds.`,
    'Find every difference to clear a stage.',
    `${PARAMS.stageCount} stages make 1 set.`,
    'Time runs out: the set restarts.',
    'Leave the screen: the game pauses.',
];

/** The six kinds of difference shown as figures, in the order of the grid (row by row). */
export const HELP_DIFFS = ['COLOR', 'MOVE', 'SIZE', 'GONE', 'EXTRA', 'SHAPE'] as const;
export type HelpDiff = (typeof HELP_DIFFS)[number];

/** The "HOW TO PLAY" button on the Title: top-left corner, size and text size, in canvas px. */
export interface HelpButtonRect {
    x: number;
    y: number;
    w: number;
    h: number;
    size: number;
    /** Centre, where the label goes. */
    cx: number;
    cy: number;
}

export const helpButtonRect = (kind: LayoutKind): HelpButtonRect => {
    const b = PARAMS.helpButton[kind];
    return { x: b.x - b.w / 2, y: b.y - b.h / 2, w: b.w, h: b.h, size: b.size, cx: b.x, cy: b.y };
};

/** True when a canvas point is inside the button (its edge counts as inside). */
export const inHelpButton = (kind: LayoutKind, px: number, py: number): boolean => {
    const b = helpButtonRect(kind);
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
};

/** What a tap on the Title does: the button opens the Help, anywhere else starts the Game. */
export const titleTapTarget = (kind: LayoutKind, px: number, py: number): 'help' | 'game' =>
    inHelpButton(kind, px, py) ? 'help' : 'game';

/** The Help screen ignores input until this much time has passed since it opened. */
export const helpInputOpen = (elapsedMs: number): boolean => elapsedMs >= PARAMS.helpInputLockMs;

export interface HelpCell {
    name: HelpDiff;
    /** Top-left corners of the left and the right swatch (canvas px). */
    left: Point;
    right: Point;
    /** Centre of the kind's name. */
    label: Point;
}

export interface HelpLayout {
    width: number;
    height: number;
    heading: Point;
    headingSize: number;
    /** Top-left of each of the six lines; they are left-aligned and wrap at `bodyWrap`. */
    body: Point[];
    bodySize: number;
    bodyWrap: number;
    cells: HelpCell[];
    swatch: number;
    labelSize: number;
    prompt: Point;
}

/** Where the Help screen puts everything (docs/spec/how-to-play.md "配置"). */
export const helpLayoutFor = (kind: LayoutKind): HelpLayout => {
    const { width, height } = layoutFor(kind);
    const t = PARAMS.helpLayout[kind];
    const cells = HELP_DIFFS.map((name, i): HelpCell => {
        const cx = t.cols[i % t.cols.length];
        const top = t.rowTops[Math.floor(i / t.cols.length)];
        return {
            name,
            left: { x: cx - t.swatchGap / 2 - t.swatch, y: top },
            right: { x: cx + t.swatchGap / 2, y: top },
            label: { x: cx, y: top + t.labelDy },
        };
    });
    return {
        width,
        height,
        heading: { x: width / 2, y: t.headingY },
        headingSize: t.headingSize,
        body: HELP_LINES.map((_, i) => ({ x: t.bodyX, y: t.bodyTop + t.bodyPitch * i })),
        bodySize: t.bodySize,
        bodyWrap: t.bodyWrap,
        cells,
        swatch: t.swatch,
        labelSize: t.labelSize,
        prompt: { x: width / 2, y: t.promptY },
    };
};

/** Swatch background (a pale square) and the colours of the sample shapes. */
export const SWATCH_BG = { hue: 215, sat: 0.3, light: 0.9 } as const;

const MAIN_HUE = 205;
const CHANGED_HUE = 330;

/** A circle or a triangle, etc.: position and radius are fractions of the swatch side `s`. */
const shape = (s: number, kind: Shape['kind'], x: number, y: number, r: number, hue: number): Shape => ({
    kind,
    x: x * s,
    y: y * s,
    size: r * s,
    hue,
    sat: 0.7,
    light: 0.5,
});

/**
 * The left and right picture of one figure in a swatch of side `s` (coordinates relative to the swatch's top-left).
 * Both pictures hold the same small square; the main shape differs in the way the name says.
 */
export const helpSample = (name: HelpDiff, s: number): { left: Shape[]; right: Shape[] } => {
    const square = shape(s, 'rect', 0.84, 0.84, 0.08, 40);
    const circle = shape(s, 'circle', 0.5, 0.5, 0.2, MAIN_HUE);
    switch (name) {
        case 'COLOR':
            return { left: [square, circle], right: [square, shape(s, 'circle', 0.5, 0.5, 0.2, CHANGED_HUE)] };
        case 'MOVE':
            return {
                left: [square, shape(s, 'circle', 0.38, 0.5, 0.2, MAIN_HUE)],
                right: [square, shape(s, 'circle', 0.62, 0.5, 0.2, MAIN_HUE)],
            };
        case 'SIZE':
            return { left: [square, circle], right: [square, shape(s, 'circle', 0.5, 0.5, 0.32, MAIN_HUE)] };
        case 'GONE':
            return { left: [square, circle], right: [square] };
        case 'EXTRA':
            return { left: [square], right: [square, circle] };
        case 'SHAPE':
            return { left: [square, circle], right: [square, shape(s, 'triangle', 0.5, 0.5, 0.2, MAIN_HUE)] };
    }
};
