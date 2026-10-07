import type { Scene } from 'phaser';
import { PARAMS } from '../params';
import type { PopView } from './PopView';
import { DEPTH, UI_FONT } from './ui';

const floatText = (scene: Scene, x: number, y: number, text: string, color: string, size: number): void => {
    const t = scene.add
        .text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, color, stroke: '#000000', strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(DEPTH.text);
    scene.tweens.add({
        targets: t,
        y: y - PARAMS.floatTextRise,
        alpha: 0,
        duration: PARAMS.floatTextMs,
        onComplete: () => t.destroy(),
    });
};

/** A mole was whacked: squash, star burst, "+N", a light shake (ignored while a cat shake runs). */
export const playMoleHit = (scene: Scene, view: PopView, label: string): void => {
    const { x, y } = view.center;
    scene.cameras.main.shake(PARAMS.hitShakeMs, PARAMS.hitShakeIntensity, false);
    floatText(scene, x, y - 90, label, '#ffee58', 40);
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

/** A cat was hit: red flash, hard shake (overrides a mole shake), "-N", the cat flies off. */
export const playCatHit = (scene: Scene, view: PopView, label: string): void => {
    const { x, y } = view.center;
    const { r, g, b } = PARAMS.catFlashColor;
    scene.cameras.main.flash(PARAMS.catFlashMs, r, g, b, true);
    scene.cameras.main.shake(PARAMS.catShakeMs, PARAMS.catShakeIntensity, true);
    floatText(scene, x, y - 90, label, '#ff5252', 40);
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
export const playMiss = (scene: Scene, x: number, y: number): void => {
    const ring = scene.add.circle(x, y, 20).setStrokeStyle(4, 0xffffff).setDepth(DEPTH.fx);
    scene.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: PARAMS.ringMs, onComplete: () => ring.destroy() });
    floatText(scene, x, y - 30, 'miss', '#cfd8dc', 22);
};
