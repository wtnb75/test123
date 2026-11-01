import { Scale, type GameObjects, type Input, type Scene } from 'phaser';
import { BUTTON_H, BUTTON_PRESS_SCALE, BUTTON_W, FONT_BUTTON } from '../params';
import { BestStore } from '../logic/best';
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
export const MONO_FONT = 'monospace';

export const BG_COLOR = 0x101a2e;
export const COLOR = {
    text: '#ffffff',
    sub: '#ccd6e0',
    muted: '#8899aa',
    accent: '#ffd166',
    good: '#06d6a0',
    tile: 0xffd166,
    tileText: '#101a2e',
    slot: 0x1a2540,
    slotFilled: 0x3a5a8a,
    floor: 0x445577,
    button: 0x2f6fd6,
    buttonPressed: 0x2557ab,
    buttonHover: 0x4a86e8,
    warn: '#ff6b6b',
    warnFill: 0xff6b6b,
    /** The dark outline of the pop-up text (same as the background, so it reads over falling letters). */
    popStroke: '#101a2e',
} as const;

export const POP_STROKE_WIDTH = 3;

/** Tray slot borders: the usual thin grey, and the thick red of the "tray is full" hint. */
export const SLOT_STROKE = {
    normal: { width: 1, color: COLOR.floor },
    full: { width: 3, color: COLOR.warnFill },
} as const;

const BUTTON_LOOK_COLOR = { normal: COLOR.button, pressed: COLOR.buttonPressed, hover: COLOR.buttonHover } as const;

/** Draw order, back to front (docs/spec.md "描画の順"); the rotate notice is above all of it. */
export const DEPTH = { base: 0, targets: 1, tray: 2, letters: 3, fly: 4, ghost: 5, pop: 6, hud: 7 } as const;

/** One store for the whole page, so the in-memory fallback survives Scene changes. */
export const bestStore = new BestStore(() => {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
});

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
    font: string = UI_FONT,
): GameObjects.Text =>
    scene.add.text(x, y, text, { fontFamily: font, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

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
        // Runs past every edge so a camera shake still running when it appears never uncovers one.
        const bleed = 40;
        const bg = scene.add.rectangle(width / 2, height / 2, width + 2 * bleed, height + 2 * bleed, 0x000000, 0.92);
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
 * Runs `handler` with the key's name (see `keyName`: IME-safe) on a keydown, ignoring auto-repeat unless
 * `allowRepeat` and Ctrl / Alt / Meta combinations; removed on Scene shutdown.
 */
export function onKeyDown(scene: Scene, handler: (key: string) => void, allowRepeat = false): void {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const isNew = firstTimeOnly<KeyboardEvent>();
    const listener = (event: KeyboardEvent) => {
        if (!isNew(event)) return; // Phaser re-delivers earlier events when keys arrive within one frame
        if (event.ctrlKey || event.metaKey || event.altKey) return; // browser shortcuts, not play
        if (!allowRepeat && event.repeat) return;
        const key = keyName(event);
        if (isImeCommitKey(key, event.isComposing)) return; // confirming IME text, not a game key
        handler(key);
    };
    kb.on('keydown', listener);
    scene.events.once('shutdown', () => kb.off('keydown', listener));
}
