// Shared Scene helpers: labels, buttons, key presses, Scene exit and the logical screen size.
import type { GameObjects, Input, Scene } from 'phaser';
import { BUTTON_HEIGHT_PX, BUTTON_WIDTH_PX, SCENE_FADE_SEC } from '../params';
import { shouldHandleKey } from '../logic/guard';
import { computeScreenSize, type ScreenSize } from '../logic/screen';
import type { Point } from '../logic/math';

export const UI_FONT = 'sans-serif';
export const BG_COLOR = 0x1f2a44;
/** Button label size (apart from the HUD's: the two are tuned for different reasons). */
const BUTTON_FONT_PX = 32;

/** Depth, back to front (docs/spec.md "演出・UI" の描く順). */
export const DEPTH = { cube: 0, hud: 10, ring: 15, float: 20, banner: 30 } as const;

/** The area Scale.FIT fits the canvas into (the parent element), so the size matches the real scale. */
const viewport = (scene: Scene): ScreenSize => ({
    width: scene.scale.parentSize.width,
    height: scene.scale.parentSize.height,
});

const targetScreenSize = (scene: Scene): ScreenSize => {
    const v = viewport(scene);
    return computeScreenSize(v.width, v.height);
};

/** Whether the logical size the viewport asks for differs from the canvas. */
export function screenSizeChanged(scene: Scene): boolean {
    const size = targetScreenSize(scene);
    return size.width !== scene.scale.gameSize.width || size.height !== scene.scale.gameSize.height;
}

/** Switches the canvas to the logical size the viewport asks for (when different). Returns the size in use. */
export function applyScreenSize(scene: Scene): ScreenSize {
    const size = targetScreenSize(scene);
    if (size.width !== scene.scale.gameSize.width || size.height !== scene.scale.gameSize.height) {
        scene.scale.setGameSize(size.width, size.height);
    }
    return size;
}

/** The centre O of the screen (the cube's centre; Title and Result lay out relative to it). */
export const screenCenter = (scene: Scene): Point => ({
    x: scene.scale.gameSize.width / 2,
    y: scene.scale.gameSize.height / 2,
});

export const addLabel = (scene: Scene, x: number, y: number, text: string, size: number, color = '#ffffff') =>
    scene.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

export const fadeInScene = (scene: Scene): void => {
    scene.cameras.main.fadeIn(SCENE_FADE_SEC * 1000);
};

/**
 * A button that fires when pressed and released on it. A pointer that was already down when the Scene started
 * never pressed it here, so releasing it does nothing. `enabled` (when given) is checked on press and release.
 */
export function addButton(
    scene: Scene,
    x: number,
    y: number,
    label: string,
    onPress: () => void,
    enabled: () => boolean = () => true,
): GameObjects.Rectangle {
    const box = scene.add
        .rectangle(x, y, BUTTON_WIDTH_PX, BUTTON_HEIGHT_PX, 0x2f6fd6)
        .setStrokeStyle(3, 0xffffff)
        .setInteractive({ useHandCursor: true });
    addLabel(scene, x, y, label, BUTTON_FONT_PX);
    // The pointer that pressed this button; -1 when none.
    let armedBy = -1;
    box.on('pointerdown', (p: Input.Pointer) => {
        if (enabled()) armedBy = p.id;
    });
    // That pointer released anywhere else (on the canvas or off it): forget the press. Phaser emits the
    // button's own pointerup before the scene-level one.
    const disarm = (p: Input.Pointer) => {
        if (p.id === armedBy) armedBy = -1;
    };
    scene.input.on('pointerup', disarm);
    scene.input.on('pointerupoutside', disarm);
    scene.events.once('shutdown', () => {
        scene.input.off('pointerup', disarm);
        scene.input.off('pointerupoutside', disarm);
    });
    box.on('pointerup', (p: Input.Pointer) => {
        if (p.id !== armedBy) return;
        armedBy = -1;
        // A touch the OS cancelled arrives as an up event too: not a release.
        if (!p.wasCanceled && enabled()) onPress();
    });
    return box;
}

/**
 * Leaves the Scene for another at most once: two inputs in the same frame (Enter plus a button release)
 * would otherwise queue two Scene starts.
 */
export class SceneExit {
    private left = false;

    constructor(private readonly scene: Scene) {}

    to(key: string, data: object = {}): void {
        if (this.left) return;
        this.left = true;
        // Always pass data: Phaser keeps a Scene's previous start data when given none.
        this.scene.scene.start(key, data);
    }
}

/** Runs `handler` on a fresh key press (auto-repeat ignored: a key held from the previous Scene does nothing). */
export function onKeyPress(scene: Scene, keys: string[], handler: () => void): void {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const listener = (event: KeyboardEvent) => {
        if (shouldHandleKey(event.repeat)) handler();
    };
    for (const k of keys) kb.on(`keydown-${k}`, listener);
    scene.events.once('shutdown', () => {
        for (const k of keys) kb.off(`keydown-${k}`, listener);
    });
}
