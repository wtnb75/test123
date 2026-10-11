import { Scene, type GameObjects } from 'phaser';
import { computeSelectLayout, digitFromKey, modeFromData } from '../logic/selectLayout';
import type { DigitOption, GameMode, GameStartData, TitleData } from '../types';
import {
    BACKGROUND_COLOR, BUTTON_STROKE, createButton, createHomeIcon, createText, detectLocale, translate, type Locale
} from './ui';

const MODE_STROKE: Record<GameMode, number> = { normal: 0x38bdf8, hard: 0xf59e0b };
const NAME_FONT_SIZE = 54;
const NAME_COLOR = '#f9fafb';
const SUBTITLE_FONT_SIZE = 26;
const SUBTITLE_COLOR = '#cbd5e1';
const HINT_FONT_SIZE = 22;
const HINT_COLOR = '#94a3b8';

export class Title extends Scene {
    private mode: GameMode = 'normal';
    private locale: Locale = 'ja';
    private uiObjects: GameObjects.GameObject[] = [];
    private modeBoxes: Partial<Record<GameMode, GameObjects.Rectangle>> = {};
    private starting = false;
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        const digit = digitFromKey(event.key);

        if (digit !== null) {
            this.startGame(digit);
        }
    };
    private readonly onResize = (): void => {
        this.build();
    };

    constructor() {
        super('Title');
    }

    init(data?: TitleData): void {
        this.mode = modeFromData(data);
        this.starting = false;
        this.uiObjects = [];
    }

    create(): void {
        this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);
        this.locale = detectLocale();

        this.input.keyboard?.on('keydown', this.onKeyDown);
        this.scale.on('resize', this.onResize);

        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown);
            this.scale.off('resize', this.onResize);
        });

        this.build();
    }

    private build(): void {
        for (const obj of this.uiObjects) {
            obj.destroy();
        }
        this.uiObjects = [];

        createHomeIcon(this, this.uiObjects);

        const { width, height } = this.scale.gameSize;
        const layout = computeSelectLayout(width, height);

        createText(this, width / 2, layout.nameY, 'digdle', NAME_FONT_SIZE, NAME_COLOR, 0.5, this.uiObjects);
        createText(this, width / 2, layout.subtitleY, translate(this.locale, 'subtitle'), SUBTITLE_FONT_SIZE, SUBTITLE_COLOR, 0.5, this.uiObjects);
        createText(this, width / 2, layout.hintY, translate(this.locale, 'selectHint'), HINT_FONT_SIZE, HINT_COLOR, 0.5, this.uiObjects);

        const { normal, hard } = layout.modeButtons;
        const normalButton = createButton(
            this, normal.x, normal.y, normal.width, normal.height, translate(this.locale, 'normalMode'),
            () => this.setMode('normal'), this.uiObjects
        );
        const hardButton = createButton(
            this, hard.x, hard.y, hard.width, hard.height, translate(this.locale, 'hardMode'),
            () => this.setMode('hard'), this.uiObjects
        );
        this.modeBoxes = { normal: normalButton.box, hard: hardButton.box };
        this.highlightMode();

        for (const { digit, rect } of layout.digitButtons) {
            createButton(
                this, rect.x, rect.y, rect.width, rect.height, String(digit),
                () => this.startGame(digit), this.uiObjects
            );
        }
    }

    private setMode(mode: GameMode): void {
        this.mode = mode;
        this.highlightMode();
    }

    private highlightMode(): void {
        if (import.meta.env.DEV) {
            // QA only: a read-only view of the Title (never part of the production bundle).
            (window as unknown as { __qa?: unknown }).__qa = { scene: 'Title', mode: this.mode };
        }

        for (const mode of ['normal', 'hard'] as const) {
            const selected = this.mode === mode;

            this.modeBoxes[mode]?.setStrokeStyle(selected ? 3 : 2, selected ? MODE_STROKE[mode] : BUTTON_STROKE);
        }
    }

    private startGame(digits: DigitOption): void {
        if (this.starting) {
            return;
        }

        this.starting = true;
        const data: GameStartData = { digits, mode: this.mode };
        this.scene.start('Game', data);
    }
}
