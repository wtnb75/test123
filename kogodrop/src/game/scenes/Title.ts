import { Scene, type GameObjects } from 'phaser';
import type { Difficulty, GameConfig, Lang, QuestionCount } from '../logic/types';

const LANGS: { key: Lang; label: string }[] = [
    { key: 'kogo', label: '古語' },
    { key: 'jp',   label: '現代語' },
    { key: 'en',   label: '英語' },
];

const DIFFICULTIES: { key: Difficulty; label: string; stars: number }[] = [
    { key: 'easy',   label: 'やさしい',   stars: 1 },
    { key: 'normal', label: 'ふつう',     stars: 2 },
    { key: 'hard',   label: 'むずかしい', stars: 3 },
];

const QUESTION_COUNTS: QuestionCount[] = [10, 20, 30];

const COLOR_SELECTED = 0x415a77;
const COLOR_DEFAULT  = 0x1d3557;
const COLOR_DIMMED   = 0x141d2e;
const COLOR_START    = 0xffd166;
const FONT = 'sans-serif';

export class Title extends Scene {
    private selectedTileLang: Lang = 'kogo';
    private selectedSlotLang: Lang = 'jp';
    private selectedDifficulty: Difficulty = 'normal';
    private selectedCount: QuestionCount = 20;
    private startButton!: GameObjects.Rectangle;
    private startLabel!: GameObjects.Text;
    private updateTileHighlight!: (key: string) => void;
    private updateSlotHighlight!: (key: string) => void;
    private arrowGfx!: GameObjects.Graphics;
    private tileBtnYMap = {} as Record<Lang, number>;
    private slotBtnYMap = {} as Record<Lang, number>;
    private arrowFromX = 0;
    private arrowToX = 0;
    private warningText!: GameObjects.Text;

    constructor() { super('Title'); }

    create() {
        const { width, height } = this.cameras.main;
        this.cameras.main.setBackgroundColor('#101820');

        this.add.text(width / 2, height * 0.09, '古語ドロップ', {
            color: '#ffd166', fontFamily: FONT, fontSize: '44px', fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(width / 2, height * 0.15, 'KogoDrop — 落として覚える古語', {
            color: '#d7e3fc', fontFamily: FONT, fontSize: '18px',
        }).setOrigin(0.5);

        const langPanelTopY = height * 0.21;
        const langPanelH = 46 + LANGS.length * 42 + (LANGS.length - 1) * 8 + 14;
        this.buildLangPanel(width, langPanelTopY);

        this.warningText = this.add.text(
            width / 2, langPanelTopY + langPanelH + 10,
            '※ 現代語と英語は直接対応していないため\nニュアンスが合わない問題が出る場合があります',
            {
                color: '#ffaa44', fontFamily: FONT, fontSize: '12px',
                align: 'center', wordWrap: { width: width - 48 },
            },
        ).setOrigin(0.5, 0).setVisible(false);

        this.buildDifficultyRow(width, height * 0.47);
        this.buildCountStepper(width, height * 0.62);

        const startY = height * 0.79;
        this.startButton = this.add.rectangle(width / 2, startY, width * 0.68, 68, COLOR_START)
            .setInteractive({ useHandCursor: true });
        this.startLabel = this.add.text(width / 2, startY, 'はじめる', {
            color: '#222222', fontFamily: FONT, fontSize: '26px', fontStyle: 'bold',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const startGame = () => {
            const config: GameConfig = {
                langMode: { tile: this.selectedTileLang, slot: this.selectedSlotLang },
                difficulty: this.selectedDifficulty,
                questionCount: this.selectedCount,
            };
            this.scene.start('Game', config);
        };

        this.startButton.on('pointerdown', startGame);
        this.startLabel.on('pointerdown', startGame);
        this.input.keyboard?.on('keydown-ENTER', startGame);
    }

    private buildLangPanel(width: number, topY: number) {
        const PAD = 16;
        const ARROW_ZONE = 84;
        const colW = (width - PAD * 2 - ARROW_ZONE) / 2;
        const tileColX = PAD;
        const slotColX = PAD + colW + ARROW_ZONE;
        const btnH = 42;
        const gap = 8;
        const topPad = 46;
        const botPad = 14;
        const panelH = topPad + LANGS.length * btnH + (LANGS.length - 1) * gap + botPad;
        const firstBtnY = topY + topPad + btnH / 2;

        // Panel background
        const gfx = this.add.graphics();
        gfx.fillStyle(0x0d1b2a, 1);
        gfx.fillRoundedRect(PAD, topY, width - PAD * 2, panelH, 10);
        gfx.lineStyle(1, 0x415a77, 0.7);
        gfx.strokeRoundedRect(PAD, topY, width - PAD * 2, panelH, 10);

        // Column labels
        this.add.text(tileColX + colW / 2, topY + 12, 'タイル（出題）', {
            color: '#a8dadc', fontFamily: FONT, fontSize: '13px',
        }).setOrigin(0.5, 0);

        this.add.text(slotColX + colW / 2, topY + 12, 'スロット（答え）', {
            color: '#a8dadc', fontFamily: FONT, fontSize: '13px',
        }).setOrigin(0.5, 0);

        // Tile language buttons (left column, vertical)
        this.updateTileHighlight = this.buildVerticalLangButtons(
            tileColX, colW, firstBtnY, btnH, gap,
            this.tileBtnYMap,
            (key) => {
                this.selectedTileLang = key as Lang;
                if (this.selectedTileLang === this.selectedSlotLang) {
                    const auto = LANGS.find((l) => l.key !== key)!.key;
                    this.selectedSlotLang = auto;
                    this.updateSlotHighlight(auto);
                }
                this.redrawArrow();
                this.updateWarning();
            },
            this.selectedTileLang,
        );

        // Slot language buttons (right column, vertical)
        this.updateSlotHighlight = this.buildVerticalLangButtons(
            slotColX, colW, firstBtnY, btnH, gap,
            this.slotBtnYMap,
            (key) => {
                this.selectedSlotLang = key as Lang;
                if (this.selectedSlotLang === this.selectedTileLang) {
                    const auto = LANGS.find((l) => l.key !== key)!.key;
                    this.selectedTileLang = auto;
                    this.updateTileHighlight(auto);
                }
                this.redrawArrow();
                this.updateWarning();
            },
            this.selectedSlotLang,
        );

        // Arrow graphics drawn on top of buttons
        this.arrowFromX = tileColX + colW - 6;
        this.arrowToX   = slotColX + 6;
        this.arrowGfx   = this.add.graphics();
        this.redrawArrow();
    }

    private buildVerticalLangButtons(
        colX: number,
        colW: number,
        firstBtnY: number,
        btnH: number,
        gap: number,
        btnYMap: Record<Lang, number>,
        onSelect: (key: string) => void,
        defaultKey: string,
    ): (key: string) => void {
        const btnW = colW - 16;
        const btnCenterX = colX + colW / 2;
        const backgrounds: GameObjects.Rectangle[] = [];

        const updateHighlight = (selectedKey: string) => {
            LANGS.forEach((l, i) => {
                backgrounds[i].setFillStyle(l.key === selectedKey ? COLOR_SELECTED : COLOR_DEFAULT);
            });
        };

        LANGS.forEach((lang, i) => {
            const btnY = firstBtnY + i * (btnH + gap);
            btnYMap[lang.key] = btnY;

            const bg = this.add.rectangle(btnCenterX, btnY, btnW, btnH, COLOR_DEFAULT)
                .setStrokeStyle(1, 0x778da9)
                .setInteractive({ useHandCursor: true });
            backgrounds.push(bg);

            const txt = this.add.text(btnCenterX, btnY, lang.label, {
                color: '#f1faee', fontFamily: FONT, fontSize: '15px', align: 'center',
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            const select = () => { onSelect(lang.key); updateHighlight(lang.key); };
            bg.on('pointerdown', select);
            txt.on('pointerdown', select);
        });

        updateHighlight(defaultKey);
        return updateHighlight;
    }

    private redrawArrow() {
        this.arrowGfx.clear();

        const fromX = this.arrowFromX;
        const toX   = this.arrowToX;
        const fromY = this.tileBtnYMap[this.selectedTileLang];
        const toY   = this.slotBtnYMap[this.selectedSlotLang];
        const color = 0xffd166;

        this.arrowGfx.lineStyle(2, color, 0.85);
        this.arrowGfx.beginPath();
        this.arrowGfx.moveTo(fromX, fromY);
        this.arrowGfx.lineTo(toX, toY);
        this.arrowGfx.strokePath();

        // Dot at start
        this.arrowGfx.fillStyle(color, 0.85);
        this.arrowGfx.fillCircle(fromX, fromY, 4);

        // Arrowhead at end
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const sz = 10;
        this.arrowGfx.fillTriangle(
            toX, toY,
            toX - sz * Math.cos(angle - 0.4), toY - sz * Math.sin(angle - 0.4),
            toX - sz * Math.cos(angle + 0.4), toY - sz * Math.sin(angle + 0.4),
        );
    }

    private updateWarning() {
        const indirect =
            (this.selectedTileLang === 'jp' && this.selectedSlotLang === 'en') ||
            (this.selectedTileLang === 'en' && this.selectedSlotLang === 'jp');
        this.warningText.setVisible(indirect);
    }

    private buildDifficultyRow(width: number, topY: number) {
        this.add.text(width / 2, topY, '難易度', {
            color: '#a8dadc', fontFamily: FONT, fontSize: '16px',
        }).setOrigin(0.5);

        const btnW = (width - 32) / DIFFICULTIES.length;
        const btnH = 68;
        const btnY = topY + 48;
        const backgrounds: GameObjects.Rectangle[] = [];

        const updateHighlight = (selectedKey: string) => {
            DIFFICULTIES.forEach((d, i) => {
                backgrounds[i].setFillStyle(d.key === selectedKey ? COLOR_SELECTED : COLOR_DEFAULT);
            });
        };

        DIFFICULTIES.forEach((diff, i) => {
            const x = 16 + btnW / 2 + i * btnW;
            const bg = this.add.rectangle(x, btnY, btnW - 4, btnH, COLOR_DEFAULT)
                .setStrokeStyle(1, 0x778da9)
                .setInteractive({ useHandCursor: true });
            backgrounds.push(bg);

            const stars = '★'.repeat(diff.stars) + '☆'.repeat(3 - diff.stars);
            const starsText = this.add.text(x, btnY - 12, stars, {
                color: '#ffd166', fontFamily: FONT, fontSize: '17px',
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            const labelText = this.add.text(x, btnY + 14, diff.label, {
                color: '#f1faee', fontFamily: FONT, fontSize: '13px', align: 'center',
                wordWrap: { width: btnW - 8 },
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            const select = () => { this.selectedDifficulty = diff.key; updateHighlight(diff.key); };
            bg.on('pointerdown', select);
            starsText.on('pointerdown', select);
            labelText.on('pointerdown', select);
        });

        updateHighlight(this.selectedDifficulty);
    }

    private buildCountStepper(width: number, topY: number) {
        this.add.text(width / 2, topY, '出題数', {
            color: '#a8dadc', fontFamily: FONT, fontSize: '16px',
        }).setOrigin(0.5);

        const stepperY = topY + 50;
        const displayW = 130;
        const arrowBtnW = 64;
        const stepperH = 52;
        const gap = 6;

        this.add.rectangle(width / 2, stepperY, displayW, stepperH, 0x0d1b2a)
            .setStrokeStyle(1, 0x415a77);
        const countDisplay = this.add.text(width / 2, stepperY, `${this.selectedCount}問`, {
            color: '#ffd166', fontFamily: FONT, fontSize: '24px', fontStyle: 'bold',
        }).setOrigin(0.5);

        const leftX = width / 2 - displayW / 2 - gap - arrowBtnW / 2;
        const leftBg = this.add.rectangle(leftX, stepperY, arrowBtnW, stepperH, COLOR_DEFAULT)
            .setStrokeStyle(1, 0x778da9)
            .setInteractive({ useHandCursor: true });
        const leftTxt = this.add.text(leftX, stepperY, '◀', {
            color: '#a8dadc', fontFamily: FONT, fontSize: '20px',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const rightX = width / 2 + displayW / 2 + gap + arrowBtnW / 2;
        const rightBg = this.add.rectangle(rightX, stepperY, arrowBtnW, stepperH, COLOR_DEFAULT)
            .setStrokeStyle(1, 0x778da9)
            .setInteractive({ useHandCursor: true });
        const rightTxt = this.add.text(rightX, stepperY, '▶', {
            color: '#a8dadc', fontFamily: FONT, fontSize: '20px',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const refresh = () => {
            countDisplay.setText(`${this.selectedCount}問`);
            const atMin = this.selectedCount === QUESTION_COUNTS[0];
            const atMax = this.selectedCount === QUESTION_COUNTS[QUESTION_COUNTS.length - 1];
            leftBg.setFillStyle(atMin ? COLOR_DIMMED : COLOR_DEFAULT);
            leftTxt.setColor(atMin ? '#444444' : '#a8dadc');
            rightBg.setFillStyle(atMax ? COLOR_DIMMED : COLOR_DEFAULT);
            rightTxt.setColor(atMax ? '#444444' : '#a8dadc');
        };

        const prev = () => {
            const idx = QUESTION_COUNTS.indexOf(this.selectedCount);
            if (idx > 0) { this.selectedCount = QUESTION_COUNTS[idx - 1]; refresh(); }
        };
        const next = () => {
            const idx = QUESTION_COUNTS.indexOf(this.selectedCount);
            if (idx < QUESTION_COUNTS.length - 1) { this.selectedCount = QUESTION_COUNTS[idx + 1]; refresh(); }
        };

        leftBg.on('pointerdown', prev);
        leftTxt.on('pointerdown', prev);
        rightBg.on('pointerdown', next);
        rightTxt.on('pointerdown', next);

        refresh();
    }
}
