import { Scene, type GameObjects } from 'phaser';
import type { Difficulty, GameConfig, LangMode, QuestionCount } from '../logic/types';

const LANG_MODES: { key: LangMode; label: string }[] = [
    { key: 'kogo-to-jp', label: '古語→現代語' },
    { key: 'kogo-to-en', label: '古語→英語' },
    { key: 'en-to-kogo', label: '英語→古語' },
];

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
    { key: 'easy', label: 'やさしい' },
    { key: 'normal', label: 'ふつう' },
    { key: 'hard', label: 'むずかしい' },
];

const QUESTION_COUNTS: { key: QuestionCount; label: string }[] = [
    { key: 10, label: '10問' },
    { key: 20, label: '20問' },
    { key: 30, label: '30問' },
];

const COLOR_SELECTED = 0x415a77;
const COLOR_DEFAULT = 0x1d3557;
const COLOR_START = 0xffd166;

export class Title extends Scene {
    private selectedLangMode: LangMode = 'kogo-to-jp';
    private selectedDifficulty: Difficulty = 'normal';
    private selectedCount: QuestionCount = 20;
    private startButton!: GameObjects.Rectangle;
    private startLabel!: GameObjects.Text;

    constructor() {
        super('Title');
    }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#101820');

        this.add.text(width / 2, height * 0.1, '古語ドロップ', {
            color: '#ffd166',
            fontFamily: 'sans-serif',
            fontSize: '44px',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.17, 'KogoDrop — 落として覚える古語', {
            color: '#d7e3fc',
            fontFamily: 'sans-serif',
            fontSize: '18px',
        }).setOrigin(0.5);

        this.buildButtonGroup(
            width,
            height * 0.27,
            '言語モードを選んでください',
            LANG_MODES,
            (key: string) => {
                this.selectedLangMode = key as LangMode;
                this.updateStartButton();
            },
            this.selectedLangMode
        );

        this.buildButtonGroup(
            width,
            height * 0.47,
            '難易度を選んでください',
            DIFFICULTIES,
            (key: string) => {
                this.selectedDifficulty = key as Difficulty;
                this.updateStartButton();
            },
            this.selectedDifficulty
        );

        this.buildButtonGroup(
            width,
            height * 0.67,
            '出題数を選んでください',
            QUESTION_COUNTS,
            (key: string) => {
                this.selectedCount = Number(key) as QuestionCount;
                this.updateStartButton();
            },
            String(this.selectedCount)
        );

        this.startButton = this.add.rectangle(width / 2, height * 0.86, width * 0.68, 68, COLOR_START)
            .setInteractive({ useHandCursor: true });
        this.startLabel = this.add.text(width / 2, height * 0.86, 'はじめる', {
            color: '#222222',
            fontFamily: 'sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const startGame = () => {
            const config: GameConfig = {
                langMode: this.selectedLangMode,
                difficulty: this.selectedDifficulty,
                questionCount: this.selectedCount,
            };
            this.scene.start('Game', config);
        };

        this.startButton.on('pointerdown', startGame);
        this.startLabel.on('pointerdown', startGame);
        this.input.keyboard?.on('keydown-ENTER', startGame);
    }

    private buildButtonGroup(
        width: number,
        topY: number,
        label: string,
        options: { key: string; label: string }[],
        onSelect: (key: string) => void,
        defaultKey: string
    ) {
        this.add.text(width / 2, topY, label, {
            color: '#a8dadc',
            fontFamily: 'sans-serif',
            fontSize: '16px',
        }).setOrigin(0.5);

        const btnWidth = (width - 32) / options.length;
        const btnHeight = 56;
        const btnY = topY + 40;
        const startX = 16 + btnWidth / 2;

        const backgrounds: GameObjects.Rectangle[] = [];
        const labels: GameObjects.Text[] = [];

        const updateHighlight = (selectedKey: string) => {
            options.forEach((opt, i) => {
                backgrounds[i].setFillStyle(String(opt.key) === selectedKey ? COLOR_SELECTED : COLOR_DEFAULT);
            });
        };

        options.forEach((opt, i) => {
            const x = startX + i * btnWidth;
            const bg = this.add.rectangle(x, btnY, btnWidth - 4, btnHeight, COLOR_DEFAULT)
                .setStrokeStyle(1, 0x778da9)
                .setInteractive({ useHandCursor: true });
            backgrounds.push(bg);

            const txt = this.add.text(x, btnY, opt.label, {
                color: '#f1faee',
                fontFamily: 'sans-serif',
                fontSize: '15px',
                align: 'center',
                wordWrap: { width: btnWidth - 8 },
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });
            labels.push(txt);

            const select = () => {
                const keyStr = String(opt.key);
                onSelect(keyStr);
                updateHighlight(keyStr);
            };
            bg.on('pointerdown', select);
            txt.on('pointerdown', select);
        });

        updateHighlight(defaultKey);
    }

    private updateStartButton() {
        this.startButton.setFillStyle(COLOR_START);
        this.startLabel.setColor('#222222');
    }
}
