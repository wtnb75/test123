import { Input, Scene, type GameObjects } from 'phaser';

import {
    BOX_ORDER,
    DEFAULT_BOX_CAPACITY,
    advanceQueue,
    createDistributionState,
    createEmptyBoxes,
    createQueue,
    getBoxOrder,
    resolvePlacement,
    resolveTimeout,
    stackDigits,
    type BoxKey,
    type PlacementResult,
    type DistributionState,
    type Difficulty,
    type QueueState
} from '../logic/primtris';
import { remainingSeconds, stepWait, waitMs } from '../logic/timer';
import { BoxesView, type BoxesViewStyle } from './boxesView';

const DEFAULT_DIFFICULTY: Difficulty = {
    digitCount: 2,
    boxCapacity: DEFAULT_BOX_CAPACITY
};

const ENTRY_FALL_SPEED = 720;
const ENTRY_START_Y = -120;
const READY_Y = 220;
const BOX_REGION_HEIGHT = 180;
const GAME_BOX_STYLE: Omit<BoxesViewStyle, 'top'> = {
    height: BOX_REGION_HEIGHT,
    labelOffset: 18,
    labelFont: 22,
    digitsOffset: 62,
    digitsFont: 20,
    digitsLineSpacing: 2,
    capacityOffset: BOX_REGION_HEIGHT - 34,
    capacityFont: 18
};
const LOG_LIMIT = 4;
const FACTOR_POPUP_DURATION_MS = 2000;
const NORMAL_DROP_COMMIT_MS = 140;
const GAME_OVER_DROP_COMMIT_MS = 520;
const GAME_OVER_SLOW_MOTION_SCALE = 0.35;
const GAME_OVER_SLOW_MOTION_DELAY_MS = 560;

interface GameInitData {
    digitCount?: number;
}

export class Game extends Scene
{
    private boxes = createEmptyBoxes();
    private boxesView!: BoxesView;
    private collateralClears = 0;
    private currentValueText!: GameObjects.Text;
    private currentX = 0;
    private currentY = 0;
    private currentValueTopText!: GameObjects.Text;
    private dropZoneTop = 0;
    private dragging = false;
    private difficulty: Difficulty = { ...DEFAULT_DIFFICULTY };
    private distributionState: DistributionState = createDistributionState();
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
    /** Numbers dropped so far (manual, time-out and game-over drops alike); sets the next wait. */
    private placed = 0;
    /** Milliseconds left before the READY number falls on its own. */
    private waitLeftMs = 0;
    private waitText!: GameObjects.Text;
    /** The tenth of a second the WAIT text was last built for (-1: none shown). */
    private lastWaitTenths = -1;

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

        if (import.meta.env.DEV) {
            // QA only: which Scene is running and with how many digits.
            (window as unknown as { __qa?: unknown }).__qa = { scene: 'Game', digitCount: this.difficulty.digitCount };
        }

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
        this.isEntering = true;
        this.isGameOver = false;
        this.isResolving = false;
        this.logLines = [];
        this.score = 0;
        this.placed = 0;
        this.waitLeftMs = 0;
        this.lastWaitTenths = -1;
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
                this.waitLeftMs = waitMs(this.placed);
            }
        } else if (!this.isResolving && this.waitLeftMs > 0) {
            // the wait runs only while the number is at READY; a held number is frozen. The frame it arrives in does not count.
            this.waitLeftMs = stepWait(this.waitLeftMs, delta, this.dragging);

            if (this.waitLeftMs === 0) {
                this.confirmDrop(true);
            }
        }

        if (!this.isResolving) {
            this.currentValueText.setPosition(this.currentX, this.currentY);
        }

        this.refreshWaitText();
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

        this.waitText = this.add.text(width - 24, 72, '', {
            color: '#ffd166',
            fontFamily: 'sans-serif',
            fontSize: '26px',
            fontStyle: 'bold'
        }).setOrigin(1, 0);

        this.logText = this.add.text(24, height - 260, '', {
            color: '#d7e3fc',
            fontFamily: 'monospace',
            fontSize: '18px',
            lineSpacing: 8,
            wordWrap: { width: width - 48 }
        });

        this.boxesView = new BoxesView(
            this,
            this.activeBoxes,
            width,
            { ...GAME_BOX_STYLE, top: height - BOX_REGION_HEIGHT },
            this.difficulty.boxCapacity
        );
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
            if (!this.dragging) {
                return;
            }

            // release the grab even while a drop is resolving, so that the next number is not left held
            this.dragging = false;

            if (this.isResolving) {
                return;
            }

            this.syncPointerX(pointer.x, width);
            this.confirmDrop();
        });

        this.input.keyboard?.on('keydown-LEFT', () => {
            if (this.isGameOver || this.isEntering || this.isResolving) {
                return;
            }

            const currentIndex = this.getNearestColumnIndex(this.currentX);
            const nextIndex = Math.max(0, currentIndex - 1);
            this.currentX = this.getColumnCenter(nextIndex);
        });

        this.input.keyboard?.on('keydown-RIGHT', () => {
            if (this.isGameOver || this.isEntering || this.isResolving) {
                return;
            }

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

    /** A manual drop, or (`timedOut`) the drop the timer makes at the lane the number is in: always a miss. */
    private confirmDrop (timedOut = false)
    {
        if (this.isResolving) {
            return;
        }

        const selectedBox = this.getBoxForX(this.currentX);
        const cap = this.difficulty.boxCapacity;
        const previewResult = timedOut
            ? resolveTimeout(this.queue.current, selectedBox, this.boxes, cap)
            : resolvePlacement(this.queue.current, selectedBox, this.boxes, cap);
        const dropDuration = previewResult.gameOver
            ? GAME_OVER_DROP_COMMIT_MS
            : NORMAL_DROP_COMMIT_MS;

        this.isResolving = true;
        this.pushLog(`${timedOut ? 'TIMEOUT' : 'DROP'} -> ${selectedBox}`);

        this.tweens.add({
            targets: this.currentValueText,
            y: this.dropZoneTop - 24,
            duration: dropDuration,
            ease: 'Quad.easeIn',
            onComplete: () => {
                this.commitDrop(selectedBox, previewResult, timedOut);
            }
        });
    }

    /** Applies the drop that `confirmDrop` previewed (`result`); `timedOut` only changes the log label. */
    private commitDrop (box: BoxKey, result: PlacementResult, timedOut: boolean)
    {
        const value = this.queue.current;
        const factorExpression = this.createFactorExpression(value);

        this.playFactorizationEffect(box, result.isCorrect, factorExpression);

        this.boxes = result.boxes;
        this.score += result.scoreDelta;
        this.placed += 1;
        this.collateralClears += result.clearedDigits.length;

        const eventLabel = timedOut ? 'TIMEOUT' : (result.isCorrect ? 'HIT' : 'MISS');
        const collateral = result.clearedDigits.length > 0 ? ` collateral: [${result.clearedDigits.join(',')}]` : '';
        this.pushLog(`${value} -> ${box} ${eventLabel} (${factorExpression})${collateral}`);

        if (result.gameOver) {
            this.isGameOver = true;
            this.refreshUi();
            const finalExpression = factorExpression;

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

        this.cameras.main.flash(320, 255, 110, 110, false);

        this.tweens.add({
            targets: this.currentValueText,
            scale: 1.15,
            yoyo: true,
            duration: 420,
            ease: 'Sine.easeInOut'
        });

        this.time.delayedCall(GAME_OVER_SLOW_MOTION_DELAY_MS, () => {
            this.tweens.timeScale = previousTweenScale;
            this.time.timeScale = previousTimeScale;
            onComplete();
        });
    }

    private playFactorizationEffect (box: BoxKey, isCorrect: boolean, expression: string)
    {
        const centerX = this.getColumnCenter(this.activeBoxes.indexOf(box));
        const startY = this.dropZoneTop - 36;
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
        this.refreshWaitText();

        this.boxesView.update(this.boxes);
    }

    /** The wait's remaining seconds, shown while a number is at READY (frozen while held); empty otherwise. */
    private refreshWaitText ()
    {
        const waiting = !this.isEntering && !this.isResolving && !this.isGameOver;
        // the text changes ten times a second: rebuild it only when the tenth changes
        const tenths = waiting ? Math.floor(this.waitLeftMs / 100) : -1;

        if (tenths !== this.lastWaitTenths) {
            this.lastWaitTenths = tenths;
            this.waitText.setText(waiting ? `WAIT ${remainingSeconds(this.waitLeftMs).toFixed(1)}` : '');
        }
    }

    private syncCurrentValueDisplay ()
    {
        this.currentValueText.setText(stackDigits(this.queue.current));
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

        this.boxesView.setHighlight(activeBox);
    }
}
