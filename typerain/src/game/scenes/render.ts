// Scene glue for the render resolution (docs/spec.md "描画の解像度と文字の下端").
// The canvas has (logical size x k) real pixels; every Scene keeps working in logical coordinates and a camera
// zoom of k maps them onto the canvas. Pure parts live in ../logic/render.ts.
import { GameObjects, Scale, type Scene } from 'phaser';
import { TEXT_PAD_BOTTOM } from '../params';
import { glyphOriginY, shakeIntensityFor } from '../logic/render';
import type { ScreenSize } from '../logic/screen';

/** Registry key holding the current render scale k (set by main.ts before the canvas is resized). */
export const RENDER_SCALE_KEY = 'renderScale';

export const renderScaleOf = (scene: Scene): number => (scene.registry.get(RENDER_SCALE_KEY) as number | undefined) ?? 1;

/** The logical size (what layouts and rules use): the canvas size divided by k. */
export const logicalSize = (scene: Scene): ScreenSize => {
    const k = renderScaleOf(scene);
    const { width, height } = scene.scale.gameSize;
    return { width: width / k, height: height / k };
};

/** The logical height as a number (no object is made: safe to call every frame). */
export const logicalHeight = (scene: Scene): number => scene.scale.gameSize.height / renderScaleOf(scene);

/** A canvas-pixel coordinate (a pointer's x or y) in logical coordinates. */
export const toLogical = (scene: Scene, canvasPx: number): number => canvasPx / renderScaleOf(scene);

/** Puts the text's anchor `oy` of the way down its glyph area (the padding under the text is not counted). */
export function setGlyphOrigin(text: GameObjects.Text, ox: number, oy: number): GameObjects.Text {
    return text.setOrigin(ox, glyphOriginY(oy, text.height, TEXT_PAD_BOTTOM));
}

/** Height of the glyph area of a text (without the padding under it). */
export const glyphHeight = (text: GameObjects.Text): number => text.height - TEXT_PAD_BOTTOM;

/**
 * A text drawn at the current render scale with room under it for descenders. (ox, oy) is the anchor in the
 * glyph area: (0, 0) top-left, (0.5, 0.5) centre, (1, 0) top-right.
 */
export function addText(
    scene: Scene,
    x: number,
    y: number,
    text: string,
    style: GameObjects.TextStyle | Record<string, unknown>,
    ox = 0,
    oy = 0,
): GameObjects.Text {
    // An empty text has no line to measure: build it with a space so the origin comes from a real line height.
    const made = scene.add.text(x, y, text === '' ? ' ' : text, {
        ...style,
        padding: { bottom: TEXT_PAD_BOTTOM },
        resolution: renderScaleOf(scene),
    });
    setGlyphOrigin(made, ox, oy);
    return text === '' ? made.setText('') : made;
}

/** Camera shake of the same strength whatever the render scale (see `shakeIntensityFor`). */
export function shake(scene: Scene, durationMs: number, intensity: number): void {
    scene.cameras.main.shake(durationMs, shakeIntensityFor(intensity, renderScaleOf(scene)));
}

/** Calls `fn` for every Text in `objects`, including the ones inside Containers (a Container's children are not in the scene's list). */
function eachText(objects: readonly GameObjects.GameObject[], fn: (text: GameObjects.Text) => void): void {
    for (const object of objects) {
        if (object instanceof GameObjects.Text) fn(object);
        else if (object instanceof GameObjects.Container) eachText(object.list, fn);
    }
}

/**
 * Keeps one Scene on the render scale: zooms its main camera by k so logical coordinates fill the canvas, and
 * redraws its texts at that resolution. Follows every resize and removes its listener on shutdown.
 */
export class RenderScaleSync {
    constructor(private readonly scene: Scene) {
        scene.scale.on(Scale.Events.RESIZE, this.apply, this);
        scene.events.once('shutdown', () => scene.scale.off(Scale.Events.RESIZE, this.apply, this));
        this.apply();
    }

    apply(): void {
        const k = renderScaleOf(this.scene);
        const logical = logicalSize(this.scene);
        const { width, height } = this.scene.scale.gameSize;
        // Zoom is about the camera's centre: scroll so that the logical (0, 0) is the canvas's top-left.
        this.scene.cameras.main.setZoom(k).setScroll((logical.width - width) / 2, (logical.height - height) / 2);
        eachText(this.scene.children.list, (text) => {
            if (text.style.resolution !== k) text.setResolution(k);
        });
    }
}
