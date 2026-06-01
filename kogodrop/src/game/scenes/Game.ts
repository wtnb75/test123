import { Input, Scene, type GameObjects } from 'phaser';
import type { GameConfig, KogoEntry } from '../logic/types';
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
const FLASH_DURATION_MS = 2500;
const DROP_ANIM_MS = 140;
const SLOT_COUNT = 4;

interface SlotView {
    background: GameObjects.Rectangle;
    label: GameObjects.Text;
}

export class Game extends Scene {
    private config!: GameConfig;
    private questions: KogoEntry[] = [];
    private currentIndex = 0;
    private slots: KogoEntry[] = [];
    private correctCount = 0;
    private wrongEntries: KogoEntry[] = [];
    private pool: KogoEntry[] = [];

    private tileText!: GameObjects.Text;
    private progressText!: GameObjects.Text;
    private scoreText!: GameObjects.Text;
    private nextText!: GameObjects.Text;
    private flashText!: GameObjects.Text;
    private slotViews: SlotView[] = [];

    private currentX = 0;
    private currentY = TILE_START_Y;
    private dragging = false;
    private isEntering = true;
    private isResolving = false;
    private slotRegionTop = 0;
    private colWidth = 0;

    constructor() {
        super('Game');
    }

    init(data: GameConfig) {
        this.config = data;
        const ignoreVerified = import.meta.env.VITE_DEV_IGNORE_VERIFIED === 'true';
        this.pool = getPool(kogoList, this.config.difficulty, ignoreVerified);
        this.questions = createQuestionSequence(this.pool, this.config.questionCount);
        this.correctCount = 0;
        this.wrongEntries = [];
        this.currentIndex = 0;
        this.isEntering = true;
        this.isResolving = false;
        this.dragging = false;
    }

    create() {
        this.slotViews = [];
        const { width, height } = this.cameras.main;
        this.colWidth = width / SLOT_COUNT;
        this.slotRegionTop = height - SLOT_HEIGHT - 80;
        this.currentX = width / 2;
        this.currentY = TILE_START_Y;

        this.cameras.main.setBackgroundColor('#1b263b');

        this.progressText = this.add.text(16, 20, '', {
            color: '#d7e3fc',
            fontFamily: 'sans-serif',
            fontSize: '20px',
        });

        this.scoreText = this.add.text(width - 16, 20, '', {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '20px',
        }).setOrigin(1, 0);

        this.nextText = this.add.text(16, 56, '', {
            color: '#a8dadc',
            fontFamily: 'sans-serif',
            fontSize: '18px',
        });

        this.tileText = this.add.text(this.currentX, this.currentY, '', {
            color: '#ffd166',
            fontFamily: 'sans-serif',
            fontSize: '36px',
            fontStyle: 'bold',
            backgroundColor: '#1d3557',
            padding: { x: 16, y: 10 },
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const slotTop = height - SLOT_HEIGHT - 72;
        for (let i = 0; i < SLOT_COUNT; i++) {
            const x = i * this.colWidth;
            const fillColor = i % 2 === 0 ? 0x415a77 : 0x33415c;
            const bg = this.add.rectangle(x, slotTop, this.colWidth, SLOT_HEIGHT, fillColor)
                .setOrigin(0)
                .setStrokeStyle(1, 0x778da9);
            const lbl = this.add.text(x + this.colWidth / 2, slotTop + SLOT_HEIGHT / 2, '', {
                align: 'center',
                color: '#f1faee',
                fontFamily: 'sans-serif',
                fontSize: '17px',
                wordWrap: { width: this.colWidth - 8 },
            }).setOrigin(0.5);
            this.slotViews.push({ background: bg, label: lbl });
        }

        this.flashText = this.add.text(width / 2, height * 0.46, '', {
            align: 'center',
            color: '#80ed99',
            fontFamily: 'sans-serif',
            fontSize: '26px',
            fontStyle: 'bold',
            backgroundColor: '#0d1b2a',
            padding: { x: 20, y: 14 },
            wordWrap: { width: width - 64 },
        }).setOrigin(0.5).setDepth(20).setVisible(false);

        this.buildInputHandlers(width);
        this.startNewTile();
    }

    private buildInputHandlers(width: number) {
        this.tileText.on('pointerdown', (pointer: Input.Pointer) => {
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
            // Only commit if released within the screen bounds (always valid here)
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
            this.currentX = this.getSlotCenter(Math.min(SLOT_COUNT - 1, idx + 1));
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
            this.tileText.setPosition(this.currentX, this.currentY);
        }
    }

    private startNewTile() {
        if (this.questions.length === 0) return;

        const entry = this.questions[this.currentIndex];
        this.slots = generateSlots(entry, this.pool, this.config.langMode);

        for (let i = 0; i < SLOT_COUNT; i++) {
            this.slotViews[i].label.setText(getSlotValue(this.slots[i], this.config.langMode));
            this.slotViews[i].background.setFillStyle(i % 2 === 0 ? 0x415a77 : 0x33415c);
        }

        const nextEntry = this.questions[this.currentIndex + 1];
        const nextVal = nextEntry ? getTileValue(nextEntry, this.config.langMode) : '---';
        this.nextText.setText(`NEXT: 【${nextVal}】`);

        this.tileText.setText(getTileValue(entry, this.config.langMode));
        this.currentX = this.cameras.main.width / 2;
        this.currentY = TILE_START_Y;
        this.tileText.setPosition(this.currentX, this.currentY);
        this.tileText.setVisible(true);
        this.isEntering = true;
        this.isResolving = false;

        this.progressText.setText(`${this.currentIndex + 1}問目 / ${this.config.questionCount}問`);
        this.scoreText.setText(`正答: ${this.correctCount} / 出題: ${this.currentIndex}`);
    }

    private confirmDrop() {
        if (this.isResolving || this.isEntering) return;
        this.isResolving = true;

        const slotIndex = this.getNearestSlotIndex(this.currentX);
        const targetX = this.getSlotCenter(slotIndex);
        const targetY = this.slotRegionTop + SLOT_HEIGHT / 2;

        this.tweens.add({
            targets: this.tileText,
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
        } else {
            this.wrongEntries.push(entry);
        }

        const tileVal = getTileValue(entry, this.config.langMode);
        const fullMeaning = getFullMeaning(entry, this.config.langMode);

        this.flashText.setText(`${correct ? '✓' : '✗'} ${tileVal} → ${fullMeaning}`);
        this.flashText.setColor(correct ? '#80ed99' : '#ffadad');

        this.flashText.setVisible(true);
        this.tileText.setVisible(false);
        this.scoreText.setText(`正答: ${this.correctCount} / 出題: ${this.currentIndex + 1}`);

        const overlays: GameObjects.Text[] = [];
        if (correct) {
            overlays.push(...this.showSlotFeedback(-1, slotIndex));
        } else {
            const correctSlotIdx = this.slots.findIndex((s) => isCorrect(entry, s, this.config.langMode));
            overlays.push(...this.showSlotFeedback(slotIndex, correctSlotIdx));
        }

        this.currentIndex++;

        this.time.delayedCall(FLASH_DURATION_MS, () => {
            this.flashText.setVisible(false);
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

    private showSlotFeedback(wrongIdx: number, correctIdx: number): GameObjects.Text[] {
        const { height } = this.cameras.main;
        const slotCenterY = height - SLOT_HEIGHT - 72 + SLOT_HEIGHT / 2;
        const isCorrectOnly = wrongIdx < 0;
        const overlays: GameObjects.Text[] = [];

        if (!isCorrectOnly) {
            this.slotViews[wrongIdx].background.setFillStyle(0x5c0000);
            const xText = this.add.text(
                this.getSlotCenter(wrongIdx), slotCenterY, '✗',
                { color: '#ff5555', fontFamily: 'sans-serif', fontSize: '72px', fontStyle: 'bold' }
            ).setOrigin(0.5).setDepth(25).setAlpha(0.9);
            overlays.push(xText);
        }

        if (correctIdx >= 0) {
            this.slotViews[correctIdx].background.setFillStyle(0x004400);
            const checkY = isCorrectOnly ? slotCenterY : slotCenterY - 28;
            const checkSize = isCorrectOnly ? '64px' : '44px';
            const checkText = this.add.text(
                this.getSlotCenter(correctIdx), checkY, '✓',
                { color: '#55ff55', fontFamily: 'sans-serif', fontSize: checkSize, fontStyle: 'bold' }
            ).setOrigin(0.5).setDepth(25);
            overlays.push(checkText);
        }

        return overlays;
    }

    private getSlotCenter(index: number): number {
        return index * this.colWidth + this.colWidth / 2;
    }

    private getNearestSlotIndex(x: number): number {
        return Math.min(SLOT_COUNT - 1, Math.max(0, Math.floor(x / this.colWidth)));
    }

    private syncPointerX(pointerX: number, width: number) {
        this.currentX = Math.min(width - this.colWidth / 2, Math.max(this.colWidth / 2, pointerX));
        if (!this.isResolving) {
            this.tileText.setPosition(this.currentX, this.currentY);
        }
        this.updateHighlight();
    }

    private updateHighlight() {
        const activeIdx = this.getNearestSlotIndex(this.currentX);
        for (let i = 0; i < SLOT_COUNT; i++) {
            const fill = i === activeIdx ? 0x778da9 : (i % 2 === 0 ? 0x415a77 : 0x33415c);
            this.slotViews[i].background.setFillStyle(fill);
        }
    }
}

