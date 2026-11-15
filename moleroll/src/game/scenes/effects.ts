// Effects (docs/spec.md "演出・UI"): floating text and the cat-hit shake.
import { Math as PMath, type Scene } from 'phaser';
import {
    CAT_SHAKE_INTENSITY,
    CAT_SHAKE_SEC,
    FLOAT_TEXT_FONT_PX,
    FLOAT_TEXT_RISE_PX,
    FLOAT_TEXT_SEC,
    HIT_RING_END_RADIUS_PX,
    HIT_RING_SEC,
    HIT_RING_START_RADIUS_PX,
    HIT_RING_STROKE_PX,
} from '../params';
import { DEPTH, UI_FONT } from './ui';

/**
 * A text that rises FLOAT_TEXT_RISE_PX while fading out over FLOAT_TEXT_SEC, then goes. Kept inside the
 * screen (its centre is clamped by half its size).
 */
export function floatText(scene: Scene, x: number, y: number, label: string, color: string): void {
    const { width, height } = scene.scale.gameSize;
    const text = scene.add
        .text(0, 0, label, { fontFamily: UI_FONT, fontSize: `${FLOAT_TEXT_FONT_PX}px`, color, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(DEPTH.float);
    const halfW = text.width / 2;
    const halfH = text.height / 2;
    const startY = PMath.Clamp(y, halfH, height - halfH);
    text.setPosition(PMath.Clamp(x, halfW, width - halfW), startY);
    scene.tweens.add({
        targets: text,
        y: PMath.Clamp(startY - FLOAT_TEXT_RISE_PX, halfH, height - halfH),
        alpha: 0,
        duration: FLOAT_TEXT_SEC * 1000,
        ease: 'Linear',
        onComplete: () => text.destroy(),
    });
}

/** A yellow ring that widens from HIT_RING_START_RADIUS_PX to HIT_RING_END_RADIUS_PX while fading out. */
export function hitRing(scene: Scene, x: number, y: number): void {
    const ring = scene.add
        .circle(x, y, HIT_RING_START_RADIUS_PX)
        .setStrokeStyle(HIT_RING_STROKE_PX, 0xffe066)
        .setDepth(DEPTH.ring);
    scene.tweens.add({
        targets: ring,
        radius: HIT_RING_END_RADIUS_PX,
        alpha: 0,
        duration: HIT_RING_SEC * 1000,
        ease: 'Linear',
        onComplete: () => ring.destroy(),
    });
}

/** The camera shake for hitting a cat (Phaser's camera shake). */
export function shakeForCat(scene: Scene): void {
    scene.cameras.main.shake(CAT_SHAKE_SEC * 1000, CAT_SHAKE_INTENSITY);
}
