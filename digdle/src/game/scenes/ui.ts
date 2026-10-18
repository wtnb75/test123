import type { GameObjects, Scene } from 'phaser';

export { detectLocale, translate } from '../logic/locale';
export type { Locale, TextKey } from '../logic/locale';

/** The background colour of every Scene. */
export const BACKGROUND_COLOR = 0x111827;
const BUTTON_FILL = 0x334155;
export const BUTTON_STROKE = 0x94a3b8;
const BUTTON_LABEL_SIZE = 20;
const LIGHT_TEXT = '#f8fafc';

export const createText = (
    scene: Scene,
    x: number,
    y: number,
    text: string,
    fontSize: number,
    color: string,
    origin: number,
    store: GameObjects.GameObject[]
): GameObjects.Text => {
    const obj = scene.add.text(x, y, text, {
        fontFamily: 'sans-serif',
        fontSize,
        color
    }).setOrigin(origin, 0.5);
    store.push(obj);
    return obj;
};

export const createButton = (
    scene: Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    store: GameObjects.GameObject[],
    fontSize = BUTTON_LABEL_SIZE
): { box: GameObjects.Rectangle; text: GameObjects.Text } => {
    const box = scene.add.rectangle(x, y, width, height, BUTTON_FILL)
        .setOrigin(0, 0)
        .setStrokeStyle(2, BUTTON_STROKE);
    const text = scene.add.text(x + width / 2, y + height / 2, label, {
        fontFamily: 'sans-serif',
        fontSize,
        color: LIGHT_TEXT
    }).setOrigin(0.5);

    box.setInteractive({ useHandCursor: true }).on('pointerdown', () => onClick());
    text.setInteractive({ useHandCursor: true }).on('pointerdown', () => onClick());

    store.push(box, text);
    return { box, text };
};

const ICON_SIZE = 28;
const ICON_MARGIN = 20;

/** The top-left link back to the game list (`../`), shared by Title and Game. */
export const createHomeIcon = (scene: Scene, store: GameObjects.GameObject[]): void => {
    const home = scene.add.text(ICON_MARGIN, ICON_MARGIN, '🏠', {
        fontFamily: 'sans-serif',
        fontSize: ICON_SIZE,
        color: LIGHT_TEXT
    }).setOrigin(0, 0);
    home.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        window.location.assign('../');
    });
    store.push(home);
};

/** The top-right "◀️" icon that returns to the Title (Game only). */
export const createReselectIcon = (
    scene: Scene,
    width: number,
    onClick: () => void,
    store: GameObjects.GameObject[]
): void => {
    const reselect = scene.add.text(width - ICON_MARGIN, ICON_MARGIN, '◀️', {
        fontFamily: 'sans-serif',
        fontSize: ICON_SIZE,
        color: LIGHT_TEXT
    }).setOrigin(1, 0);
    reselect.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    store.push(reselect);
};
