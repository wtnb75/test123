import { TITLE_START_HEIGHT, TITLE_START_WIDTH } from './constants';
import type { ScreenSize } from './screen';

/** Vertical anchors of the title's texts and button in game pixels; everything is centred horizontally. */
export interface TitleLayout {
    centerX: number;
    nameY: number;
    taglineY: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    hint1Y: number;
    hint2Y: number;
}

const NAME_Y_RATIO = 0.2;
const START_Y_RATIO = 0.6;
const TAGLINE_OFFSET = 70;
const HINT1_OFFSET = 110;
const HINT2_OFFSET = 38;

/** Places the title by ratios of the screen height (short side 768), see docs/spec/title-demo.md. */
export function computeTitleLayout(screen: ScreenSize): TitleLayout {
    const nameY = Math.round(NAME_Y_RATIO * screen.height);
    const startY = Math.round(START_Y_RATIO * screen.height);
    const hint1Y = startY + HINT1_OFFSET;
    return {
        centerX: Math.round(screen.width / 2),
        nameY,
        taglineY: nameY + TAGLINE_OFFSET,
        startY,
        startWidth: TITLE_START_WIDTH,
        startHeight: TITLE_START_HEIGHT,
        hint1Y,
        hint2Y: hint1Y + HINT2_OFFSET
    };
}
