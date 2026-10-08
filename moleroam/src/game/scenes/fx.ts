import type { GameObjects, Scene } from 'phaser';
import { PARAMS } from '../params';
import { placeFloatText } from '../logic/float';
import type { Layout } from '../logic/layout';
import type { PopView } from './PopView';
import { DEPTH, UI_FONT } from './ui';

/**
 * A text that rises and fades. (x, y) is where it would start, in board coordinates; the start is moved
 * so that it, and where it rises to, stay inside the screen.
 */
const floatText = (scene: Scene, layout: Layout, x: number, y: number, text: string, color: string, size: number): void => {
    const cam = scene.cameras.main;
    const t = scene.add
        .text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(DEPTH.text);
    const at = placeFloatText({ x: x - cam.scrollX, y: y - cam.scrollY }, t.width, t.height, layout);
    const startY = at.y + cam.scrollY;
    t.setPosition(at.x + cam.scrollX, startY);
    scene.tweens.add({
        targets: t,
        y: startY - PARAMS.floatTextRisePx,
        alpha: 0,
        duration: PARAMS.floatTextMs,
        onComplete: () => t.destroy(),
    });
};

/** The red veil of a cat hit: fixed to the screen, invisible until used, below the HUD. */
export const createCatVeil = (scene: Scene, layout: Layout): GameObjects.Rectangle => {
    const { r, g, b } = PARAMS.catFlashColor;
    // a little larger than the screen so a camera shake never shows its edge
    return scene.add
        .rectangle(layout.viewW / 2, layout.viewH / 2, layout.viewW + 40, layout.viewH + 40, (r << 16) | (g << 8) | b)
        .setScrollFactor(0)
        .setDepth(DEPTH.overlay)
        .setAlpha(0);
};

/** A mole was whacked: squash, star burst, "+N", a light shake (ignored while a cat shake runs). */
export const playMoleHit = (scene: Scene, view: PopView, label: string, layout: Layout): void => {
    const { x, y } = view.center;
    scene.cameras.main.shake(PARAMS.hitShakeMs, PARAMS.hitShakeIntensity, false);
    floatText(scene, layout, x, y - 90, label, '#ffee58', 40);
    for (let i = 0; i < PARAMS.starCount; i++) {
        const a = (i / PARAMS.starCount) * Math.PI * 2;
        const star = scene.add.circle(x, y - 10, 7, 0xffee58).setDepth(DEPTH.fx);
        scene.tweens.add({
            targets: star,
            x: x + Math.cos(a) * PARAMS.starSpread,
            y: y - 10 + Math.sin(a) * PARAMS.starSpread,
            alpha: 0,
            duration: PARAMS.starMs,
            onComplete: () => star.destroy(),
        });
    }
    squash(scene, view);
};

const squash = (scene: Scene, view: PopView): void => {
    if (!view.body) {
        view.destroy();
        return;
    }
    scene.tweens.killTweensOf(view.body);
    scene.tweens.add({
        targets: view.body,
        scaleY: 0.2,
        scaleX: 1.4,
        alpha: 0,
        duration: PARAMS.squashMs,
        onComplete: () => view.destroy(),
    });
};

/** A cat was hit: red veil, hard shake (overrides a mole shake), "-N", the cat flies off. */
export const playCatHit = (
    scene: Scene,
    view: PopView,
    label: string,
    veil: GameObjects.Rectangle,
    layout: Layout,
): void => {
    const { x, y } = view.center;
    scene.tweens.killTweensOf(veil);
    veil.setAlpha(PARAMS.catFlashAlpha);
    scene.tweens.add({ targets: veil, alpha: 0, duration: PARAMS.catFlashMs });
    scene.cameras.main.shake(PARAMS.catShakeMs, PARAMS.catShakeIntensity, true);
    floatText(scene, layout, x, y - 90, label, '#ff5252', 40);
    if (!view.body) {
        view.destroy();
        return;
    }
    view.body.setFillStyle(0xff1744);
    scene.tweens.killTweensOf(view.body);
    scene.tweens.add({
        targets: view.body,
        y: view.body.y - PARAMS.catFlyHeight,
        alpha: 0,
        angle: 180,
        duration: PARAMS.catFlyMs,
        onComplete: () => view.destroy(),
    });
};

/** A whiff (also a tap on a telegraphing hole): a white ring and a small "miss" where the player tapped. */
export const playMiss = (scene: Scene, x: number, y: number, layout: Layout): void => {
    const ring = scene.add.circle(x, y, 20).setStrokeStyle(4, 0xffffff).setDepth(DEPTH.fx);
    scene.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: PARAMS.ringMs, onComplete: () => ring.destroy() });
    floatText(scene, layout, x, y - 30, 'miss', '#cfd8dc', 22);
};
