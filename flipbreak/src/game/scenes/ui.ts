import { BestStore } from 'best-store';
import { Scale, type GameObjects, type Input, type Scene } from 'phaser';
import { BUTTON_H, BUTTON_W, H, RESULT_FONT_SIZE, SCENE_FADE_DURATION, W } from '../params';
import { GAME_ID } from '../logic/best';
import { PROMPT_WRAP_WIDTH, promptFontSize, promptText, ROTATE_PROMPT_TEXT, rotatePromptScale } from '../logic/screen';

export const UI_FONT = 'sans-serif';
export const BG_COLOR = 0x10162b;

/** Draw order, back to front (docs/spec.md "Game"). */
export const DEPTH = {
    walls: 5,
    blocks: 10,
    breakFlash: 12,
    bumpers: 15,
    hud: 20,
    hint: 25,
    flippers: 30,
    trail: 35,
    ball: 40,
    pop: 45,
    damage: 48,
    center: 50,
    prompt: 100,
} as const;

/** Every Scene fades in from black; input is accepted meanwhile. */
export const fadeInScene = (scene: Scene): void => {
    scene.cameras.main.fadeIn(SCENE_FADE_DURATION * 1000);
};

/** One store for the whole page, so the in-memory fallback survives Scene changes. */
export const bestStore = new BestStore(GAME_ID);

export const addLabel = (scene: Scene, x: number, y: number, text: string, size: number, color = '#ffffff') =>
    scene.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

/**
 * A button that fires when pressed and released on it (sliding off and back before releasing still counts).
 * A finger already down when the Scene started (one that was holding a flipper) never pressed it here, so
 * releasing it does nothing.
 */
export function addButton(
    scene: Scene,
    x: number,
    y: number,
    label: string,
    onPress: () => void,
    width = BUTTON_W,
): GameObjects.Rectangle {
    const box = scene.add
        .rectangle(x, y, width, BUTTON_H, 0x2f6fd6)
        .setStrokeStyle(3, 0xffffff)
        .setInteractive({ useHandCursor: true });
    // The label is kept on the box, so an effect can move both together (the START pulse).
    box.setData('label', addLabel(scene, x, y, label, RESULT_FONT_SIZE));
    // The pointer (finger or mouse) that pressed this button; -1 when none.
    let armedBy = -1;
    box.on('pointerdown', (p: Input.Pointer) => (armedBy = p.id));
    // That same pointer released anywhere else, on the canvas or off it: forget the press.
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
        // A touch the OS cancelled (a gesture, an incoming call) arrives as an up event too: not a release.
        if (!p.wasCanceled) onPress();
    });
    return box;
}

/**
 * Full-screen "rotate to portrait" notice, shown while the viewport is landscape and too small to read.
 * Its listener is removed on Scene shutdown.
 */
export class RotateGuard {
    active = false;
    private readonly layer: GameObjects.Container;
    private readonly text: GameObjects.Text;

    constructor(private readonly scene: Scene) {
        const bg = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.92);
        this.text = addLabel(scene, W / 2, H / 2, ROTATE_PROMPT_TEXT, RESULT_FONT_SIZE).setWordWrapWidth(
            PROMPT_WRAP_WIDTH,
            true, // break anywhere: Japanese has no spaces
        );
        this.layer = scene.add.container(0, 0, [bg, this.text]).setDepth(DEPTH.prompt).setVisible(false);
        bg.setInteractive(); // swallows taps on whatever is underneath
        scene.scale.on(Scale.Events.RESIZE, this.refresh, this);
        scene.events.once('shutdown', () => scene.scale.off(Scale.Events.RESIZE, this.refresh, this));
        this.refresh();
    }

    refresh(): void {
        // The area Scale.FIT fits the canvas into (the parent element), so the scale matches the real one.
        const { width, height } = this.scene.scale.parentSize;
        const scale = rotatePromptScale(width, height);
        const next = scale !== null;
        if (next) {
            const size = promptFontSize(scale);
            this.text.setFontSize(size).setText(promptText(size));
        }
        if (next === this.active) return;
        this.active = next;
        this.layer.setVisible(next);
    }
}

/**
 * Leaves the Scene for another at most once: a second input in the same frame (Enter plus a button release,
 * Enter plus Esc) would otherwise queue two Scene starts and leave both running.
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

/** Runs `handler` on a fresh key press (auto-repeat ignored, so a key held from the previous Scene does nothing). */
export function onKeyPress(scene: Scene, keys: string[], handler: () => void): void {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const listener = (event: KeyboardEvent) => {
        if (!event.repeat) handler();
    };
    for (const k of keys) kb.on(`keydown-${k}`, listener);
    scene.events.once('shutdown', () => {
        for (const k of keys) kb.off(`keydown-${k}`, listener);
    });
}
