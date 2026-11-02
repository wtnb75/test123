// Where things sit on the logical screen (docs/spec.md "画面・Scene構成"). Pure arithmetic on the screen height H.
import {
    BUTTON_H,
    CELL,
    COLS,
    GROUP_H,
    HUD_GAP,
    HUD_H,
    HUD_SIDE_MARGIN,
    RESULT_BLOCK_GAP,
    RESULT_BLOCK_H,
    RESULT_BUTTON_FROM_BOTTOM,
    RESULT_BUTTON_GAP,
    RESULT_BUTTON_W,
    ROWS,
    SCREEN_WIDTH,
    TITLE_BLOCK_GAP,
    TITLE_BLOCK_H,
    TITLE_BUTTON_FROM_BOTTOM,
} from '../params';
import type { Pos } from './board';

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Top of the HUD + board group, which sits in the vertical middle of the screen. */
export const groupTop = (height: number): number => Math.max(0, Math.floor((height - GROUP_H) / 2));

export function boardRect(height: number): Rect {
    return {
        x: (SCREEN_WIDTH - COLS * CELL) / 2,
        y: groupTop(height) + HUD_H + HUD_GAP,
        w: COLS * CELL,
        h: ROWS * CELL,
    };
}

/** Centre of cell `p` on the screen. */
export const cellCenter = (rect: Rect, p: Pos): { x: number; y: number } => ({
    x: rect.x + p.c * CELL + CELL / 2,
    y: rect.y + p.r * CELL + CELL / 2,
});

export interface HudLayout {
    leftX: number;
    rightX: number;
    centerX: number;
    labelY: number;
    valueY: number;
    bestY: number;
}

export function hudLayout(height: number): HudLayout {
    const top = groupTop(height);
    return {
        leftX: HUD_SIDE_MARGIN,
        rightX: SCREEN_WIDTH - HUD_SIDE_MARGIN,
        centerX: SCREEN_WIDTH / 2,
        labelY: top + 12,
        valueY: top + 42,
        bestY: top + 76,
    };
}

export interface TitleLayout {
    blockTop: number;
    nameY: number;
    subY: number;
    helpY: number[];
    bestY: number;
    buttonY: number;
}

/** The text block sits midway between the screen top and the START button. */
export function titleLayout(height: number): TitleLayout {
    const buttonY = height - TITLE_BUTTON_FROM_BOTTOM;
    const buttonTop = buttonY - BUTTON_H / 2;
    const blockTop = Math.max(16, Math.floor((buttonTop - TITLE_BLOCK_GAP - TITLE_BLOCK_H) / 2));
    return {
        blockTop,
        nameY: blockTop + 30,
        subY: blockTop + 70,
        helpY: [blockTop + 120, blockTop + 144, blockTop + 168],
        bestY: blockTop + 220,
        buttonY,
    };
}

export interface ResultLayout {
    blockTop: number;
    titleY: number;
    scoreLabelY: number;
    scoreY: number;
    bestY: number;
    buttonY: number;
    leftButtonX: number;
    rightButtonX: number;
}

export function resultLayout(height: number): ResultLayout {
    const buttonY = height - RESULT_BUTTON_FROM_BOTTOM;
    const buttonTop = buttonY - BUTTON_H / 2;
    const blockTop = Math.max(16, Math.floor((buttonTop - RESULT_BLOCK_GAP - RESULT_BLOCK_H) / 2));
    const dx = (RESULT_BUTTON_W + RESULT_BUTTON_GAP) / 2;
    return {
        blockTop,
        titleY: blockTop + 24,
        scoreLabelY: blockTop + 72,
        scoreY: blockTop + 112,
        bestY: blockTop + 170,
        buttonY,
        leftButtonX: SCREEN_WIDTH / 2 - dx,
        rightButtonX: SCREEN_WIDTH / 2 + dx,
    };
}
