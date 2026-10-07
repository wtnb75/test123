import type { GameObjects, Scene } from 'phaser';
import { PARAMS } from '../params';

export const UI_FONT = 'sans-serif';

/** Draw order, back to front (see docs/spec.md "描画順"). */
export const DEPTH = { dust: 10, body: 20, fx: 50, text: 60, arrow: 90, overlay: 95, hud: 100 } as const;

/** A new Scene fades in from black; input is never held back by it. */
export const fadeInScene = (scene: Scene): void => {
    scene.cameras.main.fadeIn(PARAMS.sceneFadeMs);
};

export const BACKDROP_COLOR = 0x1f5a27;

/** Plain green backdrop for the menu screens. */
export const drawBackdrop = (scene: Scene): void => {
    const g = scene.add.graphics();
    g.fillStyle(BACKDROP_COLOR, 1);
    g.fillRect(0, 0, PARAMS.viewW, PARAMS.viewH);
    g.fillStyle(0x2e7d32, 1);
    g.fillCircle(PARAMS.viewW * 0.1, PARAMS.viewH * 0.15, 200);
    g.fillCircle(PARAMS.viewW * 0.92, PARAMS.viewH * 0.9, 260);
};

export const addLabel = (
    scene: Scene,
    x: number,
    y: number,
    text: string,
    size: number,
    color = '#ffffff',
): GameObjects.Text =>
    scene.add
        .text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, color, align: 'center' })
        .setOrigin(0.5);

/** A tappable button (large enough for a finger). `onPress` runs on release. */
export const addButton = (scene: Scene, x: number, y: number, label: string, onPress: () => void): void => {
    const box = scene.add
        .rectangle(x, y, 380, 90, 0xffb300)
        .setStrokeStyle(4, 0xffffff)
        .setInteractive({ useHandCursor: true });
    addLabel(scene, x, y, label, 40, '#3e2723');
    box.on('pointerover', () => box.setFillStyle(0xffca28));
    box.on('pointerout', () => box.setFillStyle(0xffb300));
    box.on('pointerup', onPress);
};
