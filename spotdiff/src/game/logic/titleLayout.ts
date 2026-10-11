import { PARAMS } from '../params';
import { LayoutKind, Point, layoutFor } from './layout';

/** Where the Title puts its texts and the demo's two pictures (docs/spec.md "Title" > "配置"). */
export interface TitleLayout {
    /** Canvas size of the layout kind (the same canvas as the Game's). */
    width: number;
    height: number;
    /** True on the phone-oriented layouts, where texts must stay >= 32px on the canvas. */
    bigText: boolean;
    /** Texts, centred on these points. */
    name: Point;
    tagline: Point;
    date: Point;
    prompt: Point;
    /** Top-left corners of the demo's two pictures and their display scale (smaller than the Game's). */
    panels: [Point, Point];
    panelScale: number;
}

export const titleLayoutFor = (kind: LayoutKind): TitleLayout => {
    const { width, height, bigText } = layoutFor(kind);
    const t = PARAMS.titleLayout[kind];
    const size = PARAMS.panelSize * t.panelScale;
    const cx = width / 2;
    const stackedX = (width - size) / 2;
    const sideX = (width - size * 2 - PARAMS.panelGap) / 2;
    const panels: [Point, Point] =
        kind === 'portrait'
            ? [
                  { x: stackedX, y: t.panelY[0] },
                  { x: stackedX, y: t.panelY[1] },
              ]
            : [
                  { x: sideX, y: t.panelY[0] },
                  { x: sideX + size + PARAMS.panelGap, y: t.panelY[1] },
              ];
    return {
        width,
        height,
        bigText,
        name: { x: cx, y: t.nameY },
        tagline: { x: cx, y: t.taglineY },
        date: { x: cx, y: t.dateY },
        prompt: { x: cx, y: t.promptY },
        panels,
        panelScale: t.panelScale,
    };
};
