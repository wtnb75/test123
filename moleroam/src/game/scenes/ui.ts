import type { GameObjects, Scene } from 'phaser';
import { PARAMS } from '../params';
import { pickLayout, type Layout } from '../logic/layout';

export const UI_FONT = 'sans-serif';

/** Draw order, back to front (see docs/spec.md "描画順"). */
export const DEPTH = { dust: 10, body: 20, fx: 50, text: 60, arrow: 90, overlay: 95, hud: 100 } as const;

/** A new Scene fades in from black; input is never held back by it. */
export const fadeInScene = (scene: Scene): void => {
    scene.cameras.main.fadeIn(PARAMS.sceneFadeMs);
};

export const BACKDROP_COLOR = 0x1f5a27;

/**
 * Picks the layout for the Scene that is starting (portrait when the window is taller than wide) and, if the
 * canvas size differs, switches the logical canvas to it. Called once at the start of every Scene: a Scene is
 * never rebuilt when the device is rotated afterwards (the canvas just rescales to fit).
 */
export const applyLayout = (scene: Scene): Layout => {
    const layout = pickLayout(window.innerWidth, window.innerHeight);
    const size = scene.scale.gameSize;
    if (size.width !== layout.viewW || size.height !== layout.viewH) scene.scale.setGameSize(layout.viewW, layout.viewH);
    return layout;
};

/**
 * How far to move a menu screen's vertical positions so the group stays centered when the portrait canvas is
 * taller than its minimum (the positions are laid out for 1024 px). 0 in landscape and at the minimum height.
 */
export const verticalOffset = (layout: Layout): number =>
    layout.viewH > layout.viewW ? Math.round((layout.viewH - PARAMS.portraitViewHMin) / 2) : 0;

/** Plain green backdrop for the menu screens. */
export const drawBackdrop = (scene: Scene, layout: Layout): void => {
    const g = scene.add.graphics();
    g.fillStyle(BACKDROP_COLOR, 1);
    g.fillRect(0, 0, layout.viewW, layout.viewH);
    g.fillStyle(0x2e7d32, 1);
    g.fillCircle(layout.viewW * 0.1, layout.viewH * 0.15, 200);
    g.fillCircle(layout.viewW * 0.92, layout.viewH * 0.9, 260);
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
