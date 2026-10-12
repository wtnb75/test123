// Where the Title's name, the demo window and the START button sit, in logical px of the 360 x 720
// canvas (docs/spec/title-demo.md "レイアウト"). The canvas itself is scaled to the window by Phaser's FIT.
import { P, WIDTH } from '../params';

export const TITLE_LAYOUT = {
    centerX: WIDTH / 2,
    nameY: 48,
    nameSize: 44,
    buttonY: 672,
    startLabelSize: 28,
} as const;

/** The demo window and the uniform scale that fits the whole 360 x 720 board into it. */
export const DEMO_WINDOW = {
    x: P.DEMO_VIEW_X,
    y: P.DEMO_VIEW_Y,
    width: P.DEMO_VIEW_W,
    height: P.DEMO_VIEW_H,
    scale: P.DEMO_VIEW_W / WIDTH,
} as const;
