import { BestStore } from 'best-store';
import { Scale, type GameObjects, type Input, type Scene } from 'phaser';
import { BUTTON_H, BUTTON_PRESS_SCALE, BUTTON_W, FONT_BUTTON, GAME_ID } from '../params';
import { ButtonPress, buttonLook } from '../logic/buttons';
import { firstTimeOnly, isImeCommitKey, keyName } from '../logic/keys';
import {
    computeScreenSize,
    promptFontSize,
    ROTATE_PROMPT_TEXT,
    rotatePromptScale,
    type ScreenSize,
} from '../logic/screen';

export const UI_FONT = 'sans-serif';

export const BG_COLOR = 0x1b2230;
export const COLOR = {
    text: '#ffffff',
    sub: '#ccd6e0',
    muted: '#9fb3c8',
    accent: '#ffd166',
    warn: '#ff6b6b',
    /** The board's plate, a little lighter than the background. */
    panel: 0x27344a,
    /** The 6 stone colours, indexed by the colour number on the board. */
    gems: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xe67e22],
    button: 0x2f6fd6,
    buttonPressed: 0x2557ab,
    buttonHover: 0x4a86e8,
    selection: 0xffffff,
    cursor: 0xffd166,
    noticeBg: 0x000000,
    popStroke: '#101a2e',
    /** The mark of a special stone (white) and its dark outline, so the mark reads on every stone colour. */
    mark: 0xffffff,
    markOutline: 0x101a2e,
} as const;

/** Looks of the board's frames, the notice and the pop-up outline (docs/spec.md "演出・UI（Game）"). */
export const STYLE = {
    selectionWidth: 4,
    cursorWidth: 2,
    /** The cursor frame is this much smaller than a cell, so a selected cursor cell shows both frames. */
    cursorInset: 4,
    noticeBgAlpha: 0.8,
    noticePadX: 24,
    noticePadY: 14,
    popStrokeWidth: 4,
    /** Stone texture: radius inset from the cell edge, highlight radius and offset, highlight opacity. */
    gemInset: 4,
    gemShineRadius: 6,
    gemShineOffset: 6,
    gemShineAlpha: 0.35,
    /** Special stone marks (docs/spec/special-gems.md): bar length and thickness, ring radius, dark outline width. */
    markLength: 26,
    markThickness: 5,
    markRingRadius: 9,
    markOutline: 2,
    /** The colour stone: the width of the white rim of its wheel of six colours (the wheel is as big as a stone). */
    wheelRim: 2,
} as const;

/** Draw order, back to front (docs/spec.md "描画の順"). The HUD text sits above the cover that hides refills. */
export const DEPTH = {
    panel: 0,
    gems: 1,
    cursor: 2,
    selection: 3,
    cover: 4,
    notice: 5,
    pop: 6,
    hud: 7,
} as const;

const BUTTON_LOOK_COLOR = { normal: COLOR.button, pressed: COLOR.buttonPressed, hover: COLOR.buttonHover } as const;

/** One store for the whole page, so the in-memory fallback survives Scene changes. */
export const bestStore = new BestStore(GAME_ID);

/** The area Scale.FIT fits the canvas into (the parent element), so checks match the real scale. */
const viewport = (scene: Scene): ScreenSize => ({
    width: scene.scale.parentSize.width,
    height: scene.scale.parentSize.height,
});

const targetScreenSize = (scene: Scene): ScreenSize => {
    const v = viewport(scene);
    return computeScreenSize(v.width, v.height);
};

const differsFromCanvas = (scene: Scene, size: ScreenSize): boolean =>
    size.width !== scene.scale.gameSize.width || size.height !== scene.scale.gameSize.height;

/** Whether the logical size the viewport asks for differs from the canvas. */
export function screenSizeChanged(scene: Scene): boolean {
    return differsFromCanvas(scene, targetScreenSize(scene));
}

/** Logical size for the current viewport; switches the canvas to it when different. Returns the size in use. */
export function applyScreenSize(scene: Scene): ScreenSize {
    const size = targetScreenSize(scene);
    if (differsFromCanvas(scene, size)) scene.scale.setGameSize(size.width, size.height);
    return size;
}

export const addLabel = (
    scene: Scene,
    x: number,
    y: number,
    text: string,
    size: number,
    color: string = COLOR.text,
): GameObjects.Text =>
    scene.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

export interface ButtonHandle {
    /** Forget every press and redraw (the rotate notice appeared or went away); hover is re-read from the mouse. */
    reset(): void;
    /** Redraw the look from the current state (input just became accepted: a mouse resting on it shows hover). */
    refresh(): void;
}

/**
 * A tappable button (docs/spec.md "ボタン（Title・Result）"): it acts when a pointer that went down on it while
 * `accepting()` is released over it. It shows pressed / hover looks; the look scales, the tap area doesn't.
 */
export function addButton(
    scene: Scene,
    x: number,
    y: number,
    label: string,
    onPress: () => void,
    width: number = BUTTON_W,
    accepting: () => boolean = () => true,
): ButtonHandle {
    const box = scene.add.rectangle(0, 0, width, BUTTON_H, COLOR.button).setStrokeStyle(3, 0xffffff);
    const text = addLabel(scene, 0, 0, label, FONT_BUTTON);
    const visual = scene.add.container(x, y, [box, text]);
    // The tap area is a separate zone so scaling the look doesn't change it.
    const zone = scene.add.zone(x, y, width, BUTTON_H).setInteractive({ useHandCursor: true });
    const press = new ButtonPress();
    // Hover belongs to the mouse only: a finger's events never change it.
    let hover = false;
    const mouseIsOver = () => {
        const mouse = scene.input.mousePointer;
        return !mouse.isDown && zone.getBounds().contains(mouse.x, mouse.y);
    };
    const refresh = () => {
        const look = buttonLook(press.isPressed, hover, accepting());
        box.setFillStyle(BUTTON_LOOK_COLOR[look]);
        visual.setScale(look === 'pressed' ? BUTTON_PRESS_SCALE : 1);
    };
    zone.on('pointerdown', (p: Input.Pointer) => {
        // Only the left mouse button (or a touch) presses a button: a right click is not a tap.
        if (!p.wasTouch && !p.leftButtonDown()) return;
        press.down(p.id, accepting());
        refresh();
    });
    zone.on('pointerup', (p: Input.Pointer) => {
        if (!p.wasTouch && p.button !== 0) return; // letting go of a right/middle button isn't a release of the press
        // A touch the OS cancelled (a gesture, an incoming call) arrives as an up event too: not a release.
        if (p.wasCanceled) press.drop(p.id);
        else if (press.release(p.id)) onPress();
        if (!p.wasTouch) hover = true; // a mouse is still over the button after the click
        refresh();
    });
    zone.on('pointerover', (p: Input.Pointer) => {
        if (!p.wasTouch) hover = !p.isDown;
        refresh();
    });
    zone.on('pointerout', (p: Input.Pointer) => {
        if (!p.wasTouch) hover = false;
        press.drop(p.id); // sliding off cancels the press; coming back doesn't register it again
        refresh();
    });
    const dropOutside = (p: Input.Pointer) => {
        press.drop(p.id);
        refresh();
    };
    scene.input.on('pointerupoutside', dropOutside);
    scene.events.once('shutdown', () => {
        scene.input.off('pointerupoutside', dropOutside);
        press.clear();
    });
    refresh();
    return {
        reset() {
            press.clear();
            hover = mouseIsOver(); // a mouse resting on the button still shows hover once the notice is gone
            refresh();
        },
        refresh() {
            hover = mouseIsOver(); // input may just have become accepted: a resting mouse shows hover
            refresh();
        },
    };
}

/** Depth of the rotate notice: above everything else. */
const PROMPT_DEPTH = 1000;

/**
 * Full-screen "rotate to portrait" notice, shown while the viewport is landscape and too small to read.
 * While `active`, the Scene must ignore input and hold its clock. Its listener is removed on shutdown.
 */
export class RotateGuard {
    active = false;
    private readonly layer: GameObjects.Container;
    private readonly text: GameObjects.Text;
    /** Whether `onChange` has been called at least once (the construction call). */
    private reported = false;

    /** `onChange` runs whenever the notice appears or disappears (and once at construction). */
    constructor(
        private readonly scene: Scene,
        private readonly onChange?: (active: boolean) => void,
    ) {
        const { width, height } = scene.scale.gameSize;
        const bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.92);
        this.text = addLabel(scene, width / 2, height / 2, ROTATE_PROMPT_TEXT, 24);
        this.layer = scene.add.container(0, 0, [bg, this.text]).setDepth(PROMPT_DEPTH).setVisible(false);
        bg.setInteractive(); // swallows taps on whatever is underneath
        scene.scale.on(Scale.Events.RESIZE, this.refresh, this);
        scene.events.once('shutdown', () => scene.scale.off(Scale.Events.RESIZE, this.refresh, this));
        this.refresh();
    }

    refresh(): void {
        const v = viewport(this.scene);
        const scale = rotatePromptScale(v.width, v.height, this.scene.scale.gameSize);
        const next = scale !== null;
        if (next) this.text.setFontSize(promptFontSize(scale));
        const changed = next !== this.active || !this.reported;
        this.active = next;
        this.layer.setVisible(next);
        // Only a real change (or the first report) reaches the Scene: a resize with no notice must not, say,
        // drop a button press that is in progress.
        if (changed) {
            this.reported = true;
            this.onChange?.(next);
        }
    }
}

/**
 * Leaves the Scene for another at most once: a second input in the same frame would otherwise queue two
 * Scene starts and leave both running.
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

/**
 * Runs `handler` with the key's name (see `keyName`: IME-safe) on a keydown, ignoring auto-repeat
 * and Ctrl / Alt / Meta combinations; removed on Scene shutdown.
 */
export function onKeyDown(scene: Scene, handler: (key: string) => void): void {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const isNew = firstTimeOnly<KeyboardEvent>();
    const listener = (event: KeyboardEvent) => {
        if (!isNew(event)) return; // Phaser re-delivers earlier events when keys arrive within one frame
        if (event.ctrlKey || event.metaKey || event.altKey) return; // browser shortcuts, not play
        if (event.repeat) return;
        const key = keyName(event);
        if (isImeCommitKey(key, event.isComposing)) return; // confirming IME text, not a game key
        handler(key);
    };
    kb.on('keydown', listener);
    scene.events.once('shutdown', () => kb.off('keydown', listener));
}

/** Pauses or resumes the Scene's tweens and timers (the rotate notice freezes the game's clock). */
export function setClockPaused(scene: Scene, paused: boolean): void {
    scene.tweens.paused = paused;
    scene.time.paused = paused;
}
