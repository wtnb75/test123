import { Scale, type GameObjects, type Input, type Scene } from 'phaser';
import {
    BALL_RADIUS,
    BUTTON_HEIGHT,
    BUTTON_WIDTH,
    COMBO_MAX_TIER,
    ENEMY_HEIGHT,
    ENEMY_WIDTH,
    FIELD_TOP,
    FRAME_WIDTH,
    HUD_FONT_SIZE,
    PADDLE_HEIGHT,
    PADDLE_WIDTH,
    SCREEN_HEIGHT_MAX,
    SHAKE_INTENSITY,
} from '../params';
import {
    computeScreenSize,
    promptFontSize,
    promptText,
    ROTATE_PROMPT_TEXT,
    rotatePromptScale,
    type ScreenSize,
} from '../logic/screen';
import { BestStore } from 'best-store';
import { GAME_ID } from '../logic/best';
import { tierColor } from '../logic/combo';

export const UI_FONT = 'sans-serif';
/** Left and right margin of the HUD row. */
export const HUD_MARGIN = 16;
export const BG_COLOR = 0x101828;
/** The enemy red: enemy shots and the danger line (the Title text calls both 「赤い」). */
export const ENEMY_RED = 0xff4a4a;
/** The playfield frame: light grey, clearly apart from the background, balls and enemies. */
export const FRAME_COLOR = 0xc0c8d6;
/**
 * How far edge-to-edge drawings (walls, the red overlay) run past the canvas: more than a camera shake can
 * move them (SHAKE_INTENSITY of the tallest logical screen), plus a margin.
 */
export const SHAKE_BLEED = Math.ceil(SHAKE_INTENSITY * SCREEN_HEIGHT_MAX) + 8;
/** The HUD row sits centred in the strip above the top frame line. */
export const HUD_Y = Math.round((FIELD_TOP - FRAME_WIDTH) / 2); // centre line of the strip, rounded

/** Draw order, back to front (docs/spec.md "描画の順"). */
export const DEPTH = {
    frame: 5,
    danger: 7,
    formation: 10,
    paddle: 20,
    enemyBall: 30,
    myBall: 40,
    effect: 45,
    pop: 50,
    damage: 55,
    hud: 60,
    center: 70,
    prompt: 100,
} as const;

export const TEX = { paddle: 'paddle', enemy: 'enemy', enemyBall: 'eball', myBall: 'mball' } as const;

/** Texture key of an own ball at `tier` (tier 1 keeps the base key). */
export const myBallTexture = (tier: number): string => (tier <= 1 ? TEX.myBall : `${TEX.myBall}${tier}`);

/** One store for the whole page, so the in-memory fallback survives Scene changes. */
export const bestStore = new BestStore(GAME_ID);

/** The area Scale.FIT fits the canvas into (the parent element), so checks match the real scale. */
const viewport = (scene: Scene): ScreenSize => ({
    width: scene.scale.parentSize.width,
    height: scene.scale.parentSize.height,
});

/** Logical size the current viewport asks for. */
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

/** Pixel-art invader, 11 x 8 cells, filling the enemy's hit rectangle. */
const INVADER = [
    '..X.....X..',
    '...X...X...',
    '..XXXXXXX..',
    '.XX.XXX.XX.',
    'XXXXXXXXXXX',
    'X.XXXXXXX.X',
    'X.X.....X.X',
    '...XX.XX...',
];

function drawInvader(g: GameObjects.Graphics): void {
    const cw = ENEMY_WIDTH / INVADER[0].length;
    const ch = ENEMY_HEIGHT / INVADER.length;
    g.fillStyle(0x7cd35a);
    INVADER.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
            if (row[c] === 'X') g.fillRect(c * cw, r * ch, Math.ceil(cw), Math.ceil(ch));
        }
    });
}

export function makeTextures(scene: Scene): void {
    if (scene.textures.exists(TEX.paddle)) return;
    const g = scene.add.graphics();
    const r = BALL_RADIUS;
    g.fillStyle(0xffffff).fillRect(0, 0, PADDLE_WIDTH, PADDLE_HEIGHT);
    g.generateTexture(TEX.paddle, PADDLE_WIDTH, PADDLE_HEIGHT);
    g.clear();
    drawInvader(g);
    g.generateTexture(TEX.enemy, ENEMY_WIDTH, ENEMY_HEIGHT);
    g.clear();
    // Enemy shot: red diamond. Own ball: light-blue circle.
    g.fillStyle(ENEMY_RED);
    g.fillTriangle(r, 0, 2 * r, r, 0, r);
    g.fillTriangle(0, r, 2 * r, r, r, 2 * r);
    g.generateTexture(TEX.enemyBall, 2 * r, 2 * r);
    g.clear();
    for (let tier = 1; tier <= COMBO_MAX_TIER; tier++) {
        g.fillStyle(tierColor(tier)).fillCircle(r, r, r);
        g.generateTexture(myBallTexture(tier), 2 * r, 2 * r);
        g.clear();
    }
    g.destroy();
}

export const addLabel = (scene: Scene, x: number, y: number, text: string, size: number, color = '#ffffff') =>
    scene.add.text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, color, align: 'center' }).setOrigin(0.5);

/**
 * A button that fires when pressed and released on it (sliding off and back before releasing still counts).
 * A finger already down when the Scene started (one that was steering the paddle) never pressed it here, so
 * releasing it does nothing.
 */
export function addButton(scene: Scene, x: number, y: number, label: string, onPress: () => void): GameObjects.Rectangle {
    const box = scene.add
        .rectangle(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, 0x2f6fd6)
        .setStrokeStyle(3, 0xffffff)
        .setInteractive({ useHandCursor: true });
    addLabel(scene, x, y, label, HUD_FONT_SIZE);
    // The pointer (finger or mouse) that pressed this button; -1 when none.
    let armedBy = -1;
    box.on('pointerdown', (p: Input.Pointer) => (armedBy = p.id));
    // That same pointer released anywhere else, on the canvas or off it: forget the press. Other fingers
    // lifting don't count. Phaser emits the button's own pointerup before the scene-level one.
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
        const { width, height } = scene.scale.gameSize;
        // Runs SHAKE_BLEED past every edge so a camera shake still running when it appears never uncovers an edge.
        const bg = scene.add.rectangle(width / 2, height / 2, width + 2 * SHAKE_BLEED, height + 2 * SHAKE_BLEED, 0x000000, 0.92);
        this.text = addLabel(scene, width / 2, height / 2, ROTATE_PROMPT_TEXT, HUD_FONT_SIZE).setWordWrapWidth(
            width - 40,
            true, // break anywhere: Japanese has no spaces
        );
        this.layer = scene.add.container(0, 0, [bg, this.text]).setDepth(DEPTH.prompt).setVisible(false);
        bg.setInteractive(); // swallows taps on whatever is underneath
        scene.scale.on(Scale.Events.RESIZE, this.refresh, this);
        scene.events.once('shutdown', () => scene.scale.off(Scale.Events.RESIZE, this.refresh, this));
        this.refresh();
    }

    refresh(): void {
        const v = viewport(this.scene);
        const scale = rotatePromptScale(v.width, v.height, this.scene.scale.gameSize);
        const next = scale !== null;
        // Sized from the current scale whenever shown (about 18 on-screen px, capped to fit the canvas), and
        // broken at a natural point when one line won't fit.
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
        // Always pass data: Phaser keeps a Scene's previous start data when given none (Title's relayout flag).
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
