import { Geom, Input, Scene, type GameObjects } from 'phaser';
import type { GameConfig, KogoEntry, Level } from '../logic/types';
import {
    generateSlots,
    getFullMeaning,
    getPool,
    getSlotValue,
    getTileValue,
    isCorrect,
    createQuestionSequence,
} from '../logic/kogodrop';
import { kogoList } from '../data/kogoList';

const FALL_SPEED = 400;
const TILE_START_Y = -80;
const TILE_READY_Y = 320;
const SLOT_HEIGHT = 160;
const FLASH_DURATION_CORRECT_MS = 1200;
const FLASH_DURATION_WRONG_MS = 2500;
const DROP_ANIM_MS = 140;
const SLOT_COUNT = 4;
const FONT_MINCHO = '"Shippori Mincho", serif';
const FONT_SANS = 'sans-serif';

const ADAPTIVE_EVAL_WINDOW = 5;
const ADAPTIVE_UPGRADE_RATE = 0.8;
const ADAPTIVE_DOWNGRADE_RATE = 0.4;
const ADAPTIVE_SLOT_COUNTS = [4, 5, 6] as const;
const ADAPTIVE_TIER_MAX = ADAPTIVE_SLOT_COUNTS.length - 1;
const SLOT_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥'] as const;

const TILE_STYLES: Record<Level, { fill: number; stroke: number; textColor: string }> = {
    basic:    { fill: 0x1d3557, stroke: 0x778da9, textColor: '#ffd166' },
    standard: { fill: 0x1a3a2a, stroke: 0x52b788, textColor: '#b7e4c7' },
    advanced: { fill: 0x3d1520, stroke: 0xe07070, textColor: '#ffb3b3' },
};

interface SlotView {
    background: GameObjects.Rectangle;
    label: GameObjects.Text;
    deco: GameObjects.Graphics;
    indexLabel: GameObjects.Text;
}

function toVertical(text: string): string {
    return text.split('').join('\n');
}

function tileDisplayText(value: string, mode: string): string {
    if (mode === 'kogo-to-en' || mode === 'en-to-kogo') return value;
    return toVertical(value);
}

function tileFontSize(value: string, mode: string): string {
    if (mode === 'kogo-to-en' || mode === 'en-to-kogo') {
        return value.length > 12 ? '18px' : value.length > 6 ? '22px' : '28px';
    }
    return '28px';
}

function flashWordFontSize(value: string): string {
    if (value.length > 10) return '28px';
    if (value.length > 6) return '36px';
    return '44px';
}

function slotFontSize(text: string): string {
    if (text.length > 20) return '14px';
    if (text.length > 14) return '16px';
    if (text.length > 8) return '19px';
    return '22px';
}

export class Game extends Scene {
    private config!: GameConfig;
    private questions: KogoEntry[] = [];
    private currentIndex = 0;
    private slots: KogoEntry[] = [];
    private correctCount = 0;
    private comboCount = 0;
    private wrongEntries: KogoEntry[] = [];
    private results: boolean[] = [];
    private pool: KogoEntry[] = [];
    private adaptiveTier = 0;
    private adaptiveSlotCount = SLOT_COUNT;
    private adaptivePool: KogoEntry[] = [];

    private tileContainer!: GameObjects.Container;
    private tileCardGfx!: GameObjects.Graphics;
    private tileTxt!: GameObjects.Text;

    private nextContainer!: GameObjects.Container;
    private nextCardGfx!: GameObjects.Graphics;
    private nextTxt!: GameObjects.Text;

    private progressText!: GameObjects.Text;
    private comboText!: GameObjects.Text;
    private tierNotifyText!: GameObjects.Text;
    private questionSegments: GameObjects.Rectangle[] = [];
    private flashBg!: GameObjects.Graphics;
    private flashWordTxt!: GameObjects.Text;
    private flashMeaningTxt!: GameObjects.Text;
    private flashComboTxt!: GameObjects.Text;
    private slotViews: SlotView[] = [];

    private currentX = 0;
    private currentY = TILE_START_Y;
    private dragging = false;
    private isEntering = true;
    private isResolving = false;
    private slotRegionTop = 0;
    private colWidth = 0;
    private tierNotifyTimer?: Phaser.Time.TimerEvent;

    constructor() {
        super('Game');
    }

    init(data: GameConfig) {
        this.config = data;
        const ignoreVerified = import.meta.env.VITE_DEV_IGNORE_VERIFIED === 'true';
        this.pool = getPool(kogoList, this.config.difficulty, ignoreVerified);
        this.adaptiveTier = 0;
        this.adaptiveSlotCount = SLOT_COUNT;
        this.adaptivePool = [...this.pool];
        this.questions = createQuestionSequence(this.pool, this.config.questionCount);
        this.correctCount = 0;
        this.comboCount = 0;
        this.wrongEntries = [];
        this.results = [];
        this.currentIndex = 0;
        this.isEntering = true;
        this.isResolving = false;
        this.dragging = false;
    }

    create() {
        this.slotViews = [];
        const { width, height } = this.cameras.main;
        this.colWidth = width / SLOT_COUNT;
        this.slotRegionTop = height - SLOT_HEIGHT - 72;
        this.currentX = width / 2;
        this.currentY = TILE_START_Y;

        this.cameras.main.setBackgroundColor('#1b263b');

        // Progress text "answered/total" at top-right
        this.progressText = this.add.text(width - 12, 4, '', {
            color: '#d7e3fc',
            fontFamily: FONT_SANS,
            fontSize: '14px',
        }).setOrigin(1, 0);

        // Combo counter — shown below the progress bar when combo >= 2
        this.comboText = this.add.text(12, 22, '', {
            color: '#ffd166',
            fontFamily: FONT_SANS,
            fontSize: '14px',
            fontStyle: 'bold',
        }).setVisible(false);

        // Adaptive difficulty notification
        this.tierNotifyText = this.add.text(width / 2, 76, '', {
            color: '#ffd166',
            fontFamily: FONT_SANS,
            fontSize: '16px',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5).setDepth(30).setVisible(false);

        // Segmented gauge: one rect per question
        this.questionSegments = [];
        const segCount = this.config.questionCount;
        const segH = 10;
        const segY = 6;
        const segStartX = 8;
        const segEndX = width - 56;
        const segW = Math.max(4, Math.floor((segEndX - segStartX) / segCount) - 2);
        for (let i = 0; i < segCount; i++) {
            const seg = this.add.rectangle(
                segStartX + i * (segW + 2) + segW / 2,
                segY + segH / 2,
                segW, segH,
                0x333333,
            );
            this.questionSegments.push(seg);
        }

        // NEXT card container
        this.nextCardGfx = this.add.graphics();
        this.nextTxt = this.add.text(0, 0, '', {
            color: '#a8dadc',
            fontFamily: FONT_SANS,
            fontSize: '14px',
            align: 'center',
        }).setOrigin(0.5);
        this.nextContainer = this.add.container(16 + 64, 60, [this.nextCardGfx, this.nextTxt]);

        // Tile card container
        this.tileCardGfx = this.add.graphics();
        this.tileTxt = this.add.text(0, 0, '', {
            color: '#ffd166',
            fontFamily: FONT_MINCHO,
            fontSize: '28px',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5);
        this.tileContainer = this.add.container(this.currentX, this.currentY, [this.tileCardGfx, this.tileTxt]);
        this.tileContainer.setSize(80, 80);
        this.tileContainer.setInteractive(
            new Geom.Rectangle(-40, -40, 80, 80),
            Geom.Rectangle.Contains,
        );

        const slotTop = height - SLOT_HEIGHT - 72;
        for (let i = 0; i < SLOT_COUNT; i++) {
            const x = i * this.colWidth;
            const fillColor = i % 2 === 0 ? 0x415a77 : 0x33415c;
            const bg = this.add.rectangle(x, slotTop, this.colWidth, SLOT_HEIGHT, fillColor)
                .setOrigin(0)
                .setStrokeStyle(1, 0x778da9);
            const { deco, indexLabel } = this.createSlotDeco(i, x, slotTop);
            const lbl = this.add.text(x + this.colWidth / 2, slotTop + SLOT_HEIGHT / 2, '', {
                align: 'center',
                color: '#f1faee',
                fontFamily: FONT_MINCHO,
                fontSize: '17px',
                wordWrap: { width: this.colWidth - 8, useAdvancedWrap: true },
            }).setOrigin(0.5);
            this.slotViews.push({ background: bg, deco, indexLabel, label: lbl });
        }

        this.flashBg = this.add.graphics().setDepth(19).setVisible(false);
        this.flashWordTxt = this.add.text(width / 2, 0, '', {
            color: '#80ed99',
            fontFamily: FONT_MINCHO,
            fontSize: '44px',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(20).setVisible(false);
        this.flashMeaningTxt = this.add.text(width / 2, 0, '', {
            color: '#d7e3fc',
            fontFamily: FONT_MINCHO,
            fontSize: '20px',
            align: 'center',
            wordWrap: { width: width - 80, useAdvancedWrap: true },
        }).setOrigin(0.5, 0).setDepth(20).setVisible(false);
        this.flashComboTxt = this.add.text(width / 2, 0, '', {
            color: '#ffd166',
            fontFamily: FONT_SANS,
            fontSize: '18px',
            fontStyle: 'bold',
            align: 'center',
        }).setOrigin(0.5, 0).setDepth(20).setVisible(false);

        this.buildInputHandlers(width);
        this.startNewTile();
    }

    private drawTileCard(value: string, level: Level, rank: 1 | 2 | 3) {
        const isJapanese = this.config.langMode !== 'kogo-to-en' && this.config.langMode !== 'en-to-kogo';
        const vertVal = tileDisplayText(value, this.config.langMode);
        const fontSize = tileFontSize(value, this.config.langMode);
        const style = TILE_STYLES[level];

        this.tileTxt.setFontSize(fontSize);
        this.tileTxt.setFontFamily(isJapanese ? FONT_MINCHO : FONT_SANS);
        this.tileTxt.setColor(style.textColor);
        this.tileTxt.setText(vertVal);

        const tw = Math.max(isJapanese ? 56 : this.tileTxt.width + 32, 64);
        const th = Math.max(this.tileTxt.height + 28, 64);

        this.tileCardGfx.clear();
        this.tileCardGfx.fillStyle(style.fill);
        this.tileCardGfx.fillRoundedRect(-tw / 2, -th / 2, tw, th, 12);
        this.tileCardGfx.lineStyle(2, style.stroke);
        this.tileCardGfx.strokeRoundedRect(-tw / 2, -th / 2, tw, th, 12);

        // Inner border
        this.tileCardGfx.lineStyle(1, style.stroke, 0.35);
        this.tileCardGfx.strokeRoundedRect(-tw / 2 + 5, -th / 2 + 5, tw - 10, th - 10, 8);

        // Corner diamonds
        const ds = 4;
        this.tileCardGfx.fillStyle(style.stroke, 0.85);
        for (const [cx, cy] of [
            [-tw / 2, -th / 2], [tw / 2, -th / 2],
            [tw / 2,   th / 2], [-tw / 2, th / 2],
        ] as [number, number][]) {
            this.tileCardGfx.beginPath();
            this.tileCardGfx.moveTo(cx, cy - ds);
            this.tileCardGfx.lineTo(cx + ds, cy);
            this.tileCardGfx.lineTo(cx, cy + ds);
            this.tileCardGfx.lineTo(cx - ds, cy);
            this.tileCardGfx.closePath();
            this.tileCardGfx.fillPath();
        }

        // Rank pips (3 small diamonds at bottom; filled count = rank)
        const pipR = 3;
        const pipY = th / 2 - 8;
        for (let p = 0; p < 3; p++) {
            const pipX = (p - 1) * 10;
            this.tileCardGfx.fillStyle(style.stroke, p < rank ? 0.9 : 0.2);
            this.tileCardGfx.beginPath();
            this.tileCardGfx.moveTo(pipX, pipY - pipR);
            this.tileCardGfx.lineTo(pipX + pipR, pipY);
            this.tileCardGfx.lineTo(pipX, pipY + pipR);
            this.tileCardGfx.lineTo(pipX - pipR, pipY);
            this.tileCardGfx.closePath();
            this.tileCardGfx.fillPath();
        }

        this.tileContainer.setSize(tw, th);
        this.tileContainer.setInteractive(
            new Geom.Rectangle(-tw / 2, -th / 2, tw, th),
            Geom.Rectangle.Contains,
        );
    }

    private drawNextCard(value: string) {
        const label = `NEXT\n【${value}】`;
        this.nextTxt.setText(label);

        const tw = Math.max(this.nextTxt.width + 24, 80);
        const th = this.nextTxt.height + 16;

        this.nextCardGfx.clear();
        this.nextCardGfx.fillStyle(0x162032);
        this.nextCardGfx.fillRoundedRect(-tw / 2, -th / 2, tw, th, 8);
        this.nextCardGfx.lineStyle(1, 0x415a77);
        this.nextCardGfx.strokeRoundedRect(-tw / 2, -th / 2, tw, th, 8);
    }

    private buildInputHandlers(width: number) {
        this.input.on('pointerdown', (pointer: Input.Pointer) => {
            if (this.isEntering || this.isResolving) return;
            this.dragging = true;
            this.syncPointerX(pointer.x, width);
        });

        this.input.on('pointermove', (pointer: Input.Pointer) => {
            if (!this.dragging || this.isResolving) return;
            this.syncPointerX(pointer.x, width);
        });

        this.input.on('pointerup', (pointer: Input.Pointer) => {
            if (!this.dragging || this.isResolving) return;
            this.dragging = false;
            this.syncPointerX(pointer.x, width);
            this.confirmDrop();
        });

        this.input.keyboard?.on('keydown-LEFT', () => {
            if (this.isEntering || this.isResolving) return;
            const idx = this.getNearestSlotIndex(this.currentX);
            this.currentX = this.getSlotCenter(Math.max(0, idx - 1));
            this.updateHighlight();
        });

        this.input.keyboard?.on('keydown-RIGHT', () => {
            if (this.isEntering || this.isResolving) return;
            const idx = this.getNearestSlotIndex(this.currentX);
            this.currentX = this.getSlotCenter(Math.min(this.adaptiveSlotCount - 1, idx + 1));
            this.updateHighlight();
        });

        this.input.keyboard?.on('keydown-SPACE', () => {
            if (this.isEntering || this.isResolving) return;
            this.confirmDrop();
        });

        this.input.keyboard?.on('keydown-ENTER', () => {
            if (this.isEntering || this.isResolving) return;
            this.confirmDrop();
        });
    }

    update(_time: number, delta: number) {
        if (this.isResolving) return;

        if (this.isEntering) {
            this.currentY += FALL_SPEED * (delta / 1000);
            if (this.currentY >= TILE_READY_Y) {
                this.currentY = TILE_READY_Y;
                this.isEntering = false;
            }
            this.tileContainer.setPosition(this.currentX, this.currentY);
        }
    }

    private startNewTile() {
        if (this.questions.length === 0) return;

        if (this.slotViews.length !== this.adaptiveSlotCount) {
            this.rebuildSlotViews(this.adaptiveSlotCount);
        }

        const entry = this.questions[this.currentIndex];
        this.slots = generateSlots(entry, this.adaptivePool, this.config.langMode, Math.random, this.adaptiveSlotCount);

        const correctCount = this.slots.filter((s) => isCorrect(entry, s, this.config.langMode)).length;
        if (correctCount !== 1) {
            // eslint-disable-next-line no-console
            console.warn(
                `[KogoDrop] Q${this.currentIndex + 1}: 正解スロット数=${correctCount}`,
                `tile="${getTileValue(entry, this.config.langMode)}"`,
                this.slots.map((s, i) => ({
                    slot: i,
                    value: getSlotValue(s, this.config.langMode),
                    correct: isCorrect(entry, s, this.config.langMode),
                })),
            );
        } else {
            // eslint-disable-next-line no-console
            console.log(
                `[KogoDrop] Q${this.currentIndex + 1}:`,
                `tile="${getTileValue(entry, this.config.langMode)}"`,
                `slots=[${this.slots.map((s) => `"${getSlotValue(s, this.config.langMode)}"`).join(', ')}]`,
                `correctAt=${this.slots.findIndex((s) => isCorrect(entry, s, this.config.langMode))}`,
            );
        }

        for (let i = 0; i < this.adaptiveSlotCount; i++) {
            const slotVal = getSlotValue(this.slots[i], this.config.langMode);
            this.slotViews[i].label.setText(slotVal);
            this.slotViews[i].label.setFontSize(slotFontSize(slotVal));
            this.slotViews[i].label.setWordWrapWidth(this.colWidth - 8, true);
            this.slotViews[i].background.setFillStyle(i % 2 === 0 ? 0x415a77 : 0x33415c);
        }

        const nextEntry = this.questions[this.currentIndex + 1];
        const nextVal = nextEntry ? getTileValue(nextEntry, this.config.langMode) : '---';
        this.drawNextCard(nextVal);

        const tileVal = getTileValue(entry, this.config.langMode);
        this.drawTileCard(tileVal, entry.level, entry.rank);

        this.currentX = this.cameras.main.width / 2;
        this.currentY = TILE_START_Y;
        this.tileContainer.setPosition(this.currentX, this.currentY);
        this.tileContainer.setVisible(true);
        this.isEntering = true;
        this.isResolving = false;

        this.updateGauge();
    }

    private updateGauge() {
        const answered = this.results.length;
        this.progressText.setText(`${answered} / ${this.config.questionCount}`);
        for (let i = 0; i < this.questionSegments.length; i++) {
            let color: number;
            if (i < answered) {
                color = this.results[i] ? 0x80ed99 : 0xff6b6b;
            } else {
                color = 0x333333;
            }
            this.questionSegments[i].setFillStyle(color);
        }
    }

    private confirmDrop() {
        if (this.isResolving || this.isEntering) return;
        this.isResolving = true;

        const slotIndex = this.getNearestSlotIndex(this.currentX);
        const targetX = this.getSlotCenter(slotIndex);
        const targetY = this.slotRegionTop + SLOT_HEIGHT / 2;

        this.tweens.add({
            targets: this.tileContainer,
            x: targetX,
            y: targetY,
            duration: DROP_ANIM_MS,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.commitResult(slotIndex);
            },
        });
    }

    private commitResult(slotIndex: number) {
        const entry = this.questions[this.currentIndex];
        const selected = this.slots[slotIndex];
        const correct = isCorrect(entry, selected, this.config.langMode);

        if (correct) {
            this.correctCount++;
            this.comboCount++;
        } else {
            this.wrongEntries.push(entry);
            this.comboCount = 0;
        }
        this.results.push(correct);
        this.evaluateAdaptive();
        this.updateComboHud();

        const tileVal = getTileValue(entry, this.config.langMode);
        const fullMeaning = getFullMeaning(entry, this.config.langMode);

        this.showFlash(correct, tileVal, fullMeaning, this.comboCount);
        this.tileContainer.setVisible(false);

        this.currentIndex++;
        this.updateGauge();

        const overlays: GameObjects.Text[] = [];
        if (correct) {
            overlays.push(...this.showSlotFeedback(-1, slotIndex));
        } else {
            const correctSlotIdx = this.slots.findIndex((s) => isCorrect(entry, s, this.config.langMode));
            overlays.push(...this.showSlotFeedback(slotIndex, correctSlotIdx));
        }

        this.time.delayedCall(correct ? FLASH_DURATION_CORRECT_MS : FLASH_DURATION_WRONG_MS, () => {
            this.flashBg.setVisible(false);
            this.flashWordTxt.setVisible(false);
            this.flashMeaningTxt.setVisible(false);
            this.flashComboTxt.setVisible(false);
            overlays.forEach((o) => o.destroy());

            if (this.currentIndex >= this.config.questionCount) {
                this.scene.start('Result', {
                    correctCount: this.correctCount,
                    totalCount: this.config.questionCount,
                    wrongEntries: this.wrongEntries,
                    config: this.config,
                });
            } else {
                this.startNewTile();
            }
        });
    }

    private showFlash(correct: boolean, word: string, meaning: string, combo: number) {
        const { width, height } = this.cameras.main;
        const flashCenterY = height * 0.42;
        const gap = 12;
        const comboGap = 6;
        const padX = 28;
        const padY = 18;

        const bonusLine = correct && combo >= 3
            ? combo >= 10 ? `${combo} 連続正解！！！`
                : combo >= 5  ? `${combo} 連続正解！！`
                :               `${combo} 連続正解！`
            : null;

        this.flashWordTxt
            .setFontSize(flashWordFontSize(word))
            .setColor(correct ? '#80ed99' : '#ffadad')
            .setText(word);
        this.flashMeaningTxt.setText(meaning);

        if (bonusLine) {
            this.flashComboTxt.setText(bonusLine);
        }

        const wordH = this.flashWordTxt.height;
        const meaningH = this.flashMeaningTxt.height;
        const comboH = bonusLine ? comboGap + this.flashComboTxt.height : 0;
        const totalH = wordH + gap + meaningH + comboH;
        const startY = flashCenterY - totalH / 2;

        this.flashWordTxt.setY(startY);
        this.flashMeaningTxt.setY(startY + wordH + gap);
        if (bonusLine) {
            this.flashComboTxt.setY(startY + wordH + gap + meaningH + comboGap);
            this.flashComboTxt.setVisible(true);
        } else {
            this.flashComboTxt.setVisible(false);
        }

        const contentW = Math.max(
            this.flashWordTxt.width,
            this.flashMeaningTxt.width,
            bonusLine ? this.flashComboTxt.width : 0,
        );
        const panelW = Math.min(contentW + padX * 2, width - 24);
        const panelH = totalH + padY * 2;
        const panelX = width / 2 - panelW / 2;
        const panelY = startY - padY;
        const borderColor = !correct ? 0xff6b6b : combo >= 5 ? 0xffd166 : 0x80ed99;

        this.flashBg.clear();
        this.flashBg.fillStyle(0x0d1b2a, 0.95);
        this.flashBg.fillRoundedRect(panelX, panelY, panelW, panelH, 14);
        this.flashBg.lineStyle(2, borderColor, 0.5);
        this.flashBg.strokeRoundedRect(panelX, panelY, panelW, panelH, 14);

        this.flashBg.setVisible(true);
        this.flashWordTxt.setVisible(true);
        this.flashMeaningTxt.setVisible(true);
    }

    private updateComboHud() {
        if (this.comboCount >= 2) {
            this.comboText.setText(`×${this.comboCount} 連続`);
            this.comboText.setVisible(true);
        } else {
            this.comboText.setVisible(false);
        }
    }

    private showSlotFeedback(wrongIdx: number, correctIdx: number): GameObjects.Text[] {
        const { height } = this.cameras.main;
        const slotCenterY = height - SLOT_HEIGHT - 72 + SLOT_HEIGHT / 2;
        const isCorrectOnly = wrongIdx < 0;
        const overlays: GameObjects.Text[] = [];

        if (!isCorrectOnly) {
            this.slotViews[wrongIdx].background.setFillStyle(0x5c0000);
            const xText = this.add.text(
                this.getSlotCenter(wrongIdx), slotCenterY, '✗',
                { color: '#ff5555', fontFamily: FONT_SANS, fontSize: '72px', fontStyle: 'bold' }
            ).setOrigin(0.5).setDepth(25).setAlpha(0.9);
            overlays.push(xText);
        }

        if (correctIdx >= 0) {
            this.slotViews[correctIdx].background.setFillStyle(0x004400);
            const checkY = isCorrectOnly ? slotCenterY : slotCenterY - 28;
            const checkSize = isCorrectOnly ? '64px' : '44px';
            const checkText = this.add.text(
                this.getSlotCenter(correctIdx), checkY, '✓',
                { color: '#55ff55', fontFamily: FONT_SANS, fontSize: checkSize, fontStyle: 'bold' }
            ).setOrigin(0.5).setDepth(25);
            overlays.push(checkText);
        }

        return overlays;
    }

    private getSlotCenter(index: number): number {
        return index * this.colWidth + this.colWidth / 2;
    }

    private getNearestSlotIndex(x: number): number {
        return Math.min(this.adaptiveSlotCount - 1, Math.max(0, Math.floor(x / this.colWidth)));
    }

    private syncPointerX(pointerX: number, width: number) {
        this.currentX = Math.min(width - this.colWidth / 2, Math.max(this.colWidth / 2, pointerX));
        if (!this.isResolving) {
            this.tileContainer.setPosition(this.currentX, this.currentY);
        }
        this.updateHighlight();
    }

    private updateHighlight() {
        const activeIdx = this.getNearestSlotIndex(this.currentX);
        for (let i = 0; i < this.adaptiveSlotCount; i++) {
            const fill = i === activeIdx ? 0x778da9 : (i % 2 === 0 ? 0x415a77 : 0x33415c);
            this.slotViews[i].background.setFillStyle(fill);
        }
    }

    private evaluateAdaptive() {
        if (this.results.length < ADAPTIVE_EVAL_WINDOW) return;
        const recent = this.results.slice(-ADAPTIVE_EVAL_WINDOW);
        const rate = recent.filter(Boolean).length / ADAPTIVE_EVAL_WINDOW;

        if (rate >= ADAPTIVE_UPGRADE_RATE && this.adaptiveTier < ADAPTIVE_TIER_MAX) {
            this.adaptiveTier++;
            this.applyAdaptiveTier(true);
        } else if (rate <= ADAPTIVE_DOWNGRADE_RATE && this.adaptiveTier > 0) {
            this.adaptiveTier--;
            this.applyAdaptiveTier(false);
        }
    }

    private applyAdaptiveTier(upgraded: boolean) {
        this.adaptiveSlotCount = ADAPTIVE_SLOT_COUNTS[this.adaptiveTier];

        const poolDiff = this.config.difficulty === 'easy'
            ? (['easy', 'normal', 'hard'] as const)[this.adaptiveTier]
            : this.config.difficulty === 'normal' && this.adaptiveTier >= 2
                ? 'hard'
                : this.config.difficulty;

        const ignoreVerified = import.meta.env.VITE_DEV_IGNORE_VERIFIED === 'true';
        this.adaptivePool = getPool(kogoList, poolDiff, ignoreVerified);

        const remaining = this.config.questionCount - this.currentIndex - 1;
        if (remaining > 0) {
            const newSeq = createQuestionSequence(this.adaptivePool, remaining);
            this.questions = [...this.questions.slice(0, this.currentIndex + 1), ...newSeq];
        }

        const msg = upgraded
            ? `難易度 UP  スロット ${this.adaptiveSlotCount}個`
            : `難易度 DOWN  スロット ${this.adaptiveSlotCount}個`;
        const color = upgraded ? '#ffd166' : '#a8dadc';
        this.tierNotifyText.setText(msg).setColor(color).setVisible(true);
        this.tierNotifyTimer?.remove();
        this.tierNotifyTimer = this.time.delayedCall(2000, () => { this.tierNotifyText.setVisible(false); });
    }

    private createSlotDeco(i: number, x: number, slotTop: number): { deco: GameObjects.Graphics; indexLabel: GameObjects.Text } {
        const colWidth = this.colWidth;
        const deco = this.add.graphics();

        // Top accent bar
        deco.fillStyle(i % 2 === 0 ? 0x6b7f99 : 0x5a6e88, 0.6);
        deco.fillRect(x + 1, slotTop, colWidth - 2, 3);

        // Corner bracket decorations (L-shapes at all 4 corners)
        const bsz = 10;
        deco.lineStyle(1.5, 0xa8dadc, 0.45);
        // top-left
        deco.beginPath();
        deco.moveTo(x + bsz, slotTop + 1);
        deco.lineTo(x + 1, slotTop + 1);
        deco.lineTo(x + 1, slotTop + bsz);
        deco.strokePath();
        // top-right
        deco.beginPath();
        deco.moveTo(x + colWidth - bsz, slotTop + 1);
        deco.lineTo(x + colWidth - 1, slotTop + 1);
        deco.lineTo(x + colWidth - 1, slotTop + bsz);
        deco.strokePath();
        // bottom-left
        deco.beginPath();
        deco.moveTo(x + bsz, slotTop + SLOT_HEIGHT - 1);
        deco.lineTo(x + 1, slotTop + SLOT_HEIGHT - 1);
        deco.lineTo(x + 1, slotTop + SLOT_HEIGHT - bsz);
        deco.strokePath();
        // bottom-right
        deco.beginPath();
        deco.moveTo(x + colWidth - bsz, slotTop + SLOT_HEIGHT - 1);
        deco.lineTo(x + colWidth - 1, slotTop + SLOT_HEIGHT - 1);
        deco.lineTo(x + colWidth - 1, slotTop + SLOT_HEIGHT - bsz);
        deco.strokePath();

        const indexLabel = this.add.text(
            x + colWidth / 2,
            slotTop + 5,
            SLOT_NUMBERS[i],
            { color: '#778da9', fontFamily: FONT_SANS, fontSize: '11px' },
        ).setOrigin(0.5, 0).setAlpha(0.7);

        return { deco, indexLabel };
    }

    private rebuildSlotViews(count: number) {
        this.slotViews.forEach((sv) => {
            sv.background.destroy();
            sv.label.destroy();
            sv.deco.destroy();
            sv.indexLabel.destroy();
        });
        this.slotViews = [];

        const { width, height } = this.cameras.main;
        this.colWidth = width / count;
        const slotTop = height - SLOT_HEIGHT - 72;

        for (let i = 0; i < count; i++) {
            const x = i * this.colWidth;
            const fillColor = i % 2 === 0 ? 0x415a77 : 0x33415c;
            const bg = this.add.rectangle(x, slotTop, this.colWidth, SLOT_HEIGHT, fillColor)
                .setOrigin(0)
                .setStrokeStyle(1, 0x778da9);
            const { deco, indexLabel } = this.createSlotDeco(i, x, slotTop);
            const lbl = this.add.text(x + this.colWidth / 2, slotTop + SLOT_HEIGHT / 2, '', {
                align: 'center',
                color: '#f1faee',
                fontFamily: FONT_MINCHO,
                fontSize: '17px',
                wordWrap: { width: this.colWidth - 8, useAdvancedWrap: true },
            }).setOrigin(0.5);
            this.slotViews.push({ background: bg, deco, indexLabel, label: lbl });
        }
    }
}
