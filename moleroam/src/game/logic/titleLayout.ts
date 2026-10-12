import type { Layout } from './layout';
import { verticalOffset } from './layout';

/** Vertical anchors of the Title in canvas coordinates (docs/spec/title-demo.md "Title のレイアウト"); x is the centre. */
export interface TitleLayout {
    portrait: boolean;
    nameY: number;
    taglineY: number;
    infoY: number;
    infoSize: number;
    buttonY: number;
}

const POSITIONS = {
    landscape: { name: 150, tagline: 255, info: 470, infoSize: 28, button: 620 },
    portrait: { name: 230, tagline: 360, info: 720, infoSize: 26, button: 900 },
} as const;

export const computeTitleLayout = (layout: Layout): TitleLayout => {
    const portrait = layout.viewH > layout.viewW;
    const pos = portrait ? POSITIONS.portrait : POSITIONS.landscape;
    const dy = verticalOffset(layout);
    return {
        portrait,
        nameY: pos.name + dy,
        taglineY: pos.tagline + dy,
        infoY: pos.info + dy,
        infoSize: pos.infoSize,
        buttonY: pos.button + dy,
    };
};
