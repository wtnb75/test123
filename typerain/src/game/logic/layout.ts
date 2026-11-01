// Where things sit on Title and Result for a logical height H (docs/spec.md "Title", "Result").
import {
    BUTTON_FROM_BOTTOM,
    BUTTON_H,
    RESULT_BUTTON_GAP,
    RESULT_BUTTON_W,
    SCREEN_WIDTH,
    TITLE_NAME_MIN_Y,
} from '../params';

const HELP_FROM_NAME = 44;
const HELP_LINE_STEP = 22;
const BEST_FROM_HELP = 26;
/** From the bottom edge up to the top edge of the START button (44 + 26 = 70). */
const START_TOP_FROM_BOTTOM = BUTTON_FROM_BOTTOM + BUTTON_H / 2;
/** From the name's centre to BEST's centre (44 + 22 x 2 + 26 = 114). */
const NAME_TO_BEST = HELP_FROM_NAME + HELP_LINE_STEP * 2 + BEST_FROM_HELP;

export interface TitleLayout {
    nameY: number;
    helpY: number[];
    bestY: number;
    buttonY: number;
}

export function titleLayout(height: number, helpLines: number): TitleLayout {
    // The name-to-BEST block sits midway between the top and the START button's top edge.
    const nameY = Math.max(TITLE_NAME_MIN_Y, Math.round((height - START_TOP_FROM_BOTTOM - NAME_TO_BEST) / 2));
    const helpY = Array.from({ length: helpLines }, (_, i) => nameY + HELP_FROM_NAME + HELP_LINE_STEP * i);
    const bestY = (helpY[helpY.length - 1] ?? nameY) + BEST_FROM_HELP;
    return { nameY, helpY, bestY, buttonY: height - BUTTON_FROM_BOTTOM };
}

export interface ResultLayout {
    titleY: number;
    scoreY: number;
    wordsY: number;
    bestY: number;
    newBestY: number;
    buttonY: number;
    /** Centres of the two buttons: retry (left), back to title (right). */
    retryX: number;
    titleButtonX: number;
}

export function resultLayout(height: number): ResultLayout {
    const half = (RESULT_BUTTON_W + RESULT_BUTTON_GAP) / 2;
    return {
        titleY: 34,
        scoreY: 72,
        wordsY: 104,
        bestY: 128,
        newBestY: 152,
        buttonY: height - BUTTON_FROM_BOTTOM,
        retryX: SCREEN_WIDTH / 2 - half,
        titleButtonX: SCREEN_WIDTH / 2 + half,
    };
}
