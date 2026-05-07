import { Input, Scene, type GameObjects } from 'phaser';

import {
    BOX_ORDER,
    advanceQueue,
    createDistributionState,
    createEmptyBoxes,
    createQueue,
    getBoxOrder,
    resolvePlacement,
    type BoxKey,
    type DistributionState,
    type Difficulty,
    type QueueState
} from '../logic/primtris';

const DEFAULT_DIFFICULTY: Difficulty = {
    digitCount: 2,
    boxCapacity: 12
};

const ENTRY_FALL_SPEED = 720;
const ENTRY_START_Y = -120;
const READY_Y = 220;
const BOX_REGION_HEIGHT = 180;
const LOG_LIMIT = 4;
const BOX_DIGITS_PER_LINE = 5;
const BOX_MAX_LINES = 3;
const FACTOR_POPUP_DURATION_MS = 1400;
const NORMAL_DROP_COMMIT_MS = 140;
const GAME_OVER_DROP_COMMIT_MS = 520;
const GAME_OVER_SLOW_MOTION_SCALE = 0.35;
const GAME_OVER_SLOW_MOTION_DELAY_MS = 360;

interface BoxView {
    background: GameObjects.Rectangle;
    capacityText: GameObjects.Text;
    digitsText: GameObjects.Text;
    labelText: GameObjects.Text;
}

interface GameInitData {
    digitCount?: number;
}

export class Game extends Scene
{
    private boxes = createEmptyBoxes();
    private boxViews!: Record<BoxKey, BoxView>;
    private collateralClears = 0;
    private currentValueText!: GameObjects.Text;
    private currentX = 0;
    private currentY = 0;
    private currentValueTopText!: GameObjects.Text;
    private dropZoneTop = 0;
    private dragging = false;
    private difficulty: Difficulty = { ...DEFAULT_DIFFICULTY };
    private distributionState: DistributionState = createDistributionState();
    private highlightedBox: BoxKey | null = null;
    private isEntering = true;
    private isGameOver = false;
    private isResolving = false;
    private keyboardStep = 0;
    private logLines: string[] = [];
    private logText!: GameObjects.Text;
    private nextText!: GameObjects.Text;
    private queue!: QueueState;
    private score = 0;
    private scoreText!: GameObjects.Text;
    private activeBoxes: BoxKey[] = [...BOX_ORDER];

    constructor ()
    {
        super('Game');
    }

    init (data?: GameInitData)
    {
        const nextDigitCount = data?.digitCount ?? DEFAULT_DIFFICULTY.digitCount;
        this.difficulty = {
            ...DEFAULT_DIFFICULTY,
            digitCount: nextDigitCount
        };
        this.activeBoxes = getBoxOrder(nextDigitCount);
    }

    create ()
    {
        const { width, height } = this.cameras.main;

        this.cameras.main.setBackgroundColor('#1b263b');
        this.resetRuntimeState(width, height);
        this.queue = createQueue(this.difficulty, Math.random, this.distributionState);

        this.buildStaticUi(width, height);
        this.buildInputHandlers(width);
        this.syncCurrentValueDisplay();
        this.refreshUi();
    }

    private resetRuntimeState (width: number, height: number)
    {
        this.boxes = createEmptyBoxes();
        this.collateralClears = 0;
        this.keyboardStep = width / this.activeBoxes.length;
        this.dropZoneTop = height - BOX_REGION_HEIGHT - 72;
        this.currentX = this.getColumnCenter(this.getDefaultColumnIndex());
        this.currentY = ENTRY_START_Y;
        this.dragging = false;
        this.highlightedBox = null;
        this.isEntering = true;
        this.isGameOver = false;
        this.isResolving = false;
        this.logLines = [];
        this.score = 0;
        this.distributionState = createDistributionState();
    }

    update (_time: number, delta: number)
    {
        if (this.isGameOver) {
            return;
        }

        if (this.isEntering) {
            this.currentY += ENTRY_FALL_SPEED * (delta / 1000);

            if (this.currentY >= READY_Y) {
                this.currentY = READY_Y;
                this.isEntering = false;
            }
        }

        if (!this.isResolving) {
            this.currentValueText.setPosition(this.currentX, this.currentY);
        }

        this.updateHighlightedBox();
    }

    private buildStaticUi (width: number, height: number)
    {
        this.scoreText = this.add.text(24, 24, 'SCORE 0', {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold'
        });

        this.currentValueTopText = this.add.text(24, 72, 'CURRENT: 00', {
            color: '#ffd166',
            fontFamily: 'sans-serif',
            fontSize: '26px',
            fontStyle: 'bold'
        });

        this.nextText = this.add.text(24, 116, 'NEXT: -- --', {
            color: '#d7e3fc',
            fontFamily: 'sans-serif',
            fontSize: '24px'
        });

        this.currentValueText = this.add.text(width / 2, this.currentY, '', {
            align: 'center',
            color: '#f8f4e3',
            fontFamily: 'sans-serif',
            fontSize: '54px',
            fontStyle: 'bold',
            lineSpacing: 8
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });

        this.logText = this.add.text(24, height - 260, '', {
            color: '#d7e3fc',
            fontFamily: 'monospace',
            fontSize: '18px',
            lineSpacing: 8,
            wordWrap: { width: width - 48 }
        });

        const boxWidth = width / this.activeBoxes.length;
        const boxTop = height - BOX_REGION_HEIGHT;

        this.boxViews = Object.fromEntries(BOX_ORDER.map((boxKey) => {
            const hidden = !this.activeBoxes.includes(boxKey);
            const index = this.activeBoxes.indexOf(boxKey);
            const x = hidden ? 0 : index * boxWidth;
            const fillColor = hidden ? 0x000000 : (index % 2 === 0 ? 0x415a77 : 0x33415c);
            const alpha = hidden ? 0 : 1;
            const background = this.add.rectangle(x, boxTop, boxWidth, BOX_REGION_HEIGHT, fillColor).setOrigin(0).setAlpha(alpha);
            const labelText = this.add.text(x + boxWidth / 2, boxTop + 18, boxKey.toUpperCase(), {
                color: '#f8f4e3',
                fontFamily: 'sans-serif',
                fontSize: '22px',
                fontStyle: 'bold'
            }).setOrigin(0.5, 0).setAlpha(alpha);
            const digitsText = this.add.text(x + boxWidth / 2, boxTop + 62, '--', {
                align: 'center',
                color: '#f8f4e3',
                fontFamily: 'monospace',
                fontSize: '20px',
                fontStyle: 'bold',
                lineSpacing: 2
            }).setOrigin(0.5, 0).setAlpha(alpha);
            const capacityText = this.add.text(x + boxWidth / 2, boxTop + BOX_REGION_HEIGHT - 34, `0/${this.difficulty.boxCapacity}`, {
                color: '#ffd166',
                fontFamily: 'sans-serif',
                fontSize: '18px'
            }).setOrigin(0.5, 0).setAlpha(alpha);

            return [boxKey, { background, labelText, digitsText, capacityText }];
        })) as Record<BoxKey, BoxView>;
    }

    private buildInputHandlers (width: number)
    {
        this.currentValueText.on('pointerdown', (pointer: Input.Pointer) => {
            if (this.isGameOver || this.isEntering || this.isResolving) {
                return;
            }

            this.dragging = true;
            this.syncPointerX(pointer.x, width);
        });

        this.input.on('pointermove', (pointer: Input.Pointer) => {
            if (!this.dragging || this.isResolving) {
                return;
            }

            this.syncPointerX(pointer.x, width);
        });

        this.input.on('pointerup', (pointer: Input.Pointer) => {
            if (!this.dragging || this.isResolving) {
                return;
            }

            this.dragging = false;
            this.syncPointerX(pointer.x, width);
            this.confirmDrop();
        });

        this.input.keyboard?.on('keydown-LEFT', () => {
            const currentIndex = this.getNearestColumnIndex(this.currentX);
            const nextIndex = Math.max(0, currentIndex - 1);
            this.currentX = this.getColumnCenter(nextIndex);
        });

        this.input.keyboard?.on('keydown-RIGHT', () => {
            const currentIndex = this.getNearestColumnIndex(this.currentX);
            const nextIndex = Math.min(this.activeBoxes.length - 1, currentIndex + 1);
            this.currentX = this.getColumnCenter(nextIndex);
        });

        this.input.keyboard?.on('keydown-ENTER', () => {
            if (this.isGameOver || this.isEntering || this.isResolving) {
                return;
            }

            this.confirmDrop();
        });

        this.input.keyboard?.on('keydown-DOWN', () => {
            if (this.isGameOver || this.isEntering || this.isResolving) {
                return;
            }

            this.confirmDrop();
        });
    }

    private confirmDrop ()
    {
        if (this.isResolving) {
            return;
        }

        const selectedBox = this.getBoxForX(this.currentX);
        const previewResult = resolvePlacement(this.queue.current, selectedBox, this.boxes, this.difficulty.boxCapacity);
        const dropDuration = previewResult.gameOver ? GAME_OVER_DROP_COMMIT_MS : NORMAL_DROP_COMMIT_MS;

        this.isResolving = true;
        this.pushLog(`DROP -> ${selectedBox}`);

        this.tweens.add({
            targets: this.currentValueText,
            y: this.dropZoneTop - 24,
            duration: dropDuration,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.commitDrop(selectedBox, previewResult);
            }
        });
    }

    private commitDrop (box: BoxKey, preparedResult?: ReturnType<typeof resolvePlacement>)
    {
        const value = this.queue.current;
        const result = preparedResult ?? resolvePlacement(value, box, this.boxes, this.difficulty.boxCapacity);

        this.playFactorizationEffect(value, box, result.isCorrect);

        this.boxes = result.boxes;
        this.score += result.scoreDelta;
        this.collateralClears += result.clearedDigits.length;

        const eventLabel = result.isCorrect ? 'HIT' : 'MISS';
        const collateral = result.clearedDigits.length > 0 ? ` collateral: [${result.clearedDigits.join(',')}]` : '';
        this.pushLog(`${value} -> ${box} ${eventLabel}${collateral}`);

        if (result.gameOver) {
            this.isGameOver = true;
            this.refreshUi();
            const finalExpression = this.createFactorExpression(value);

            this.playGameOverSlowMotion(() => {
                this.scene.start('Result', {
                    score: this.score,
                    collateralClears: this.collateralClears,
                    digitCount: this.difficulty.digitCount,
                    finalExpression
                });
            });

            return;
        }

        this.queue = advanceQueue(this.queue, this.difficulty, Math.random, this.distributionState);
        this.currentX = this.getColumnCenter(this.getDefaultColumnIndex());
        this.currentY = ENTRY_START_Y;
        this.isEntering = true;
        this.isResolving = false;
        this.refreshUi();
    }

    private playGameOverSlowMotion (onComplete: () => void)
    {
        const previousTweenScale = this.tweens.timeScale;
        const previousTimeScale = this.time.timeScale;

        this.tweens.timeScale = GAME_OVER_SLOW_MOTION_SCALE;
        this.time.timeScale = GAME_OVER_SLOW_MOTION_SCALE;

        this.cameras.main.flash(220, 255, 110, 110, false);

        this.tweens.add({
            targets: this.currentValueText,
            scale: 1.15,
            yoyo: true,
            duration: 260,
            ease: 'Sine.easeInOut'
        });

        this.time.delayedCall(GAME_OVER_SLOW_MOTION_DELAY_MS, () => {
            this.tweens.timeScale = previousTweenScale;
            this.time.timeScale = previousTimeScale;
            onComplete();
        });
    }

    private playFactorizationEffect (value: number, box: BoxKey, isCorrect: boolean)
    {
        const centerX = this.getColumnCenter(this.activeBoxes.indexOf(box));
        const startY = this.dropZoneTop - 36;
        const expression = this.createFactorExpression(value);
        const color = isCorrect ? '#80ed99' : '#ffadad';

        const popup = this.add.text(centerX, startY, expression, {
            align: 'center',
            color,
            fontFamily: 'monospace',
            fontSize: '18px',
            fontStyle: 'bold',
            stroke: '#14213d',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(20);

        this.tweens.add({
            targets: popup,
            y: startY - 36,
            alpha: 0,
            duration: FACTOR_POPUP_DURATION_MS,
            ease: 'Sine.easeOut',
            onComplete: () => {
                popup.destroy();
            }
        });
    }

    private createFactorExpression (value: number): string
    {
        if (value < 2) {
            return `${value} = ${value}`;
        }

        const factors: number[] = [];
        let target = value;
        let divisor = 2;

        while (divisor * divisor <= target) {
            while (target % divisor === 0) {
                factors.push(divisor);
                target /= divisor;
            }
            divisor += divisor === 2 ? 1 : 2;
        }

        if (target > 1) {
            factors.push(target);
        }

        if (factors.length === 1) {
            return `${value} = prime`;
        }

        return `${value} = ${factors.join('×')}`;
    }

    private getColumnCenter (index: number): number
    {
        return (index * this.keyboardStep) + (this.keyboardStep / 2);
    }

    private getDefaultColumnIndex (): number
    {
        return Math.floor((this.activeBoxes.length - 1) / 2);
    }

    private getNearestColumnIndex (x: number): number
    {
        const rawIndex = Math.round((x - (this.keyboardStep / 2)) / this.keyboardStep);

        return Math.min(this.activeBoxes.length - 1, Math.max(0, rawIndex));
    }

    private getBoxForX (x: number): BoxKey
    {
        const boxWidth = this.cameras.main.width / this.activeBoxes.length;
        const index = Math.min(this.activeBoxes.length - 1, Math.max(0, Math.floor(x / boxWidth)));

        return this.activeBoxes[index];
    }

    private pushLog (line: string)
    {
        this.logLines.unshift(line);
        this.logLines = this.logLines.slice(0, LOG_LIMIT);
        this.logText.setText(this.logLines.join('\n'));
    }

    private refreshUi ()
    {
        this.scoreText.setText(`SCORE ${this.score}`);
        this.currentValueTopText.setText(`CURRENT: ${this.queue.current}`);
        this.nextText.setText(`NEXT: [ ${this.queue.next[0]} ] [ ${this.queue.next[1]} ]`);
        this.syncCurrentValueDisplay();

        for (const boxKey of this.activeBoxes) {
            const digits = this.boxes[boxKey];
            const view = this.boxViews[boxKey];

            view.digitsText.setText(this.formatBoxDigits(digits));
            view.capacityText.setText(`${digits.length}/${this.difficulty.boxCapacity}`);
        }
    }

    private formatBoxDigits (digits: number[]): string
    {
        if (digits.length === 0) {
            return '--';
        }

        const rows: string[] = [];

        for (let index = 0; index < digits.length; index += BOX_DIGITS_PER_LINE) {
            rows.push(digits.slice(index, index + BOX_DIGITS_PER_LINE).join(''));
        }

        return rows.slice(-BOX_MAX_LINES).join('\n');
    }

    private syncCurrentValueDisplay ()
    {
        this.currentValueText.setText(String(this.queue.current).split('').join('\n'));
        this.currentValueText.setPosition(this.currentX, this.currentY);
    }

    private syncPointerX (pointerX: number, width: number)
    {
        this.currentX = Math.min(width - this.keyboardStep / 2, Math.max(this.keyboardStep / 2, pointerX));
        this.currentValueText.setPosition(this.currentX, this.currentY);
        this.updateHighlightedBox();
    }

    private updateHighlightedBox ()
    {
        const activeBox = this.getBoxForX(this.currentX);

        if (this.highlightedBox === activeBox) {
            return;
        }

        this.highlightedBox = activeBox;

        for (const boxKey of this.activeBoxes) {
            const view = this.boxViews[boxKey];
            view.background.setFillStyle(boxKey === activeBox ? 0x778da9 : (this.activeBoxes.indexOf(boxKey) % 2 === 0 ? 0x415a77 : 0x33415c));
        }
    }
}
