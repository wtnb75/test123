import { Scale, type GameObjects, type Input, type Scene } from 'phaser';
import { BUTTON_H, BUTTON_W, FONT_BUTTON } from '../params';
import { BestStore } from '../logic/best';
import { ButtonPress, buttonLook } from '../logic/buttons';
import { promptFontSize, ROTATE_PROMPT_TEXT, rotatePromptScale } from '../logic/screen';

export const UI_FONT = 'sans-serif';
export const MONO_FONT = 'monospace';

export const BG_COLOR = '#101830';
export const COLOR = {
    text: '#ffffff',
    sub: '#ccd6e0',
    accent: '#ffd166',
    word: '#9fb4ff',
    locked: '#ffffff',
    typed: '#ffd84d',
    floor: 0xff5555,
    warn: '#ff6b6b',
    lockBand: 0xffffff,
    /** The floor line while it glows after a landing (it fades back to `floor`). */
    floorGlow: 0xffffff,
    button: 0x2f6fd6,
    buttonPressed: 0x2557ab,
    buttonHover: 0x4a86e8,
} as const;

/** Draw order, back to front; the rotate notice is above all of it. */
export const DEPTH = { base: 0, band: 1, pop: 2, word: 3, typed: 4, fx: 5, hud: 6 } as const;

const BUTTON_LOOK_COLOR = { normal: COLOR.button, pressed: COLOR.buttonPressed, hover: COLOR.buttonHover } as const;

/** One store for the whole page, so the in-memory fallback survives Scene changes. */
export const bestStore = new BestStore(() => {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
});

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
    /** Move the button (the logical height changed). */
    moveTo(x: number, y: number): void;
    /** Forget every press and redraw (the rotate notice appeared or went away); hover is re-read from the mouse. */
    reset(): void;
    /** Redraw the look from the current state (input just became accepted: a mouse resting on it shows hover). */
    refresh(): void;
}

/**
 * A tappable button: it acts when a pointer that went down on it while `accepting()` is released over it.
 * It shows pressed / hover looks; the look scales, the tap area doesn't.
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
    };
    zone.on('pointerdown', (p: Input.Pointer) => {
        // Only the left mouse button (or a touch) presses a button: a right click is not a tap.
        if (!p.wasTouch && !p.leftButtonDown()) return;
        press.down(p.id, accepting());
        refresh();
    });
    zone.on('pointerup', (p: Input.Pointer) => {
        if (!p.wasTouch && p.button !== 0) return;
        // A touch the OS cancelled arrives as an up event too: not a release.
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
        moveTo(nx, ny) {
            visual.setPosition(nx, ny);
            zone.setPosition(nx, ny);
        },
        reset() {
            press.clear();
            hover = mouseIsOver();
            refresh();
        },
        refresh() {
            hover = mouseIsOver();
            refresh();
        },
    };
}

/** The area Scale.FIT fits the canvas into (the parent element). */
const viewport = (scene: Scene) => ({ width: scene.scale.parentSize.width, height: scene.scale.parentSize.height });

/** Depth of the rotate notice: above everything else. */
const PROMPT_DEPTH = 1000;

/**
 * Full-screen "rotate to portrait" notice, shown while the viewport is landscape and too small to read (for
 * instance a phone turned sideways with its keyboard open). While `active`, the Scene must ignore input and hold
 * its clock. It follows the screen size on its own and removes its listener on shutdown.
 */
export class RotateGuard {
    active = false;
    private readonly bg: GameObjects.Rectangle;
    private readonly layer: GameObjects.Container;
    private readonly text: GameObjects.Text;
    private reported = false;

    /** `onChange` runs whenever the notice appears or disappears (and once at construction). */
    constructor(
        private readonly scene: Scene,
        private readonly onChange?: (active: boolean) => void,
    ) {
        // Runs past every edge so a camera shake still running when it appears never uncovers one.
        this.bg = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0.92);
        this.text = addLabel(scene, 0, 0, ROTATE_PROMPT_TEXT, 24);
        this.layer = scene.add.container(0, 0, [this.bg, this.text]).setDepth(PROMPT_DEPTH).setVisible(false);
        this.bg.setInteractive(); // swallows taps on whatever is underneath
        scene.scale.on(Scale.Events.RESIZE, this.refresh, this);
        scene.events.once('shutdown', () => scene.scale.off(Scale.Events.RESIZE, this.refresh, this));
        this.refresh();
    }

    refresh(): void {
        const { width, height } = this.scene.scale.gameSize;
        const bleed = 40;
        this.bg.setPosition(width / 2, height / 2).setSize(width + 2 * bleed, height + 2 * bleed);
        this.bg.input?.hitArea.setSize(width + 2 * bleed, height + 2 * bleed);
        this.text.setPosition(width / 2, height / 2);
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

/** Runs `handler` on an Enter key press (auto-repeat ignored). */
export function onEnter(scene: Scene, handler: () => void): void {
    const kb = scene.input.keyboard;
    if (!kb) return;
    const listener = (event: KeyboardEvent) => {
        if (!event.repeat) handler();
    };
    kb.on('keydown-ENTER', listener);
    scene.events.once('shutdown', () => kb.off('keydown-ENTER', listener));
}
