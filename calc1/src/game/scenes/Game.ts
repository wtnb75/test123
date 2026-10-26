import { Scene } from 'phaser';
import {
    type Operation,
    type TurnSlot,
    type ProgressState,
    type HistoryEntry,
    ROUND_TIME_MS,
    generateProblem,
    evaluateProgress,
    loadLevel,
    saveLevel,
    handleLossLevelChoice,
    nextReachedLevel,
    levelAfterClear,
    isRoundOpen,
    countUsedMoves,
    loadBest,
    saveBest,
    clearResult,
    type Best,
} from '../logic';
import { C, FONT } from '../palette';
import {
    BUTTON_CENTERS_X, BUTTON_HEIGHT, BUTTON_WIDTH, HEADER_TEXT_X, HEADER_TEXT_Y, LEVEL_TEXT_X, RESULT_BUTTON_HEIGHT,
    RESULT_BUTTON_WIDTH, RESULT_BUTTON_X, RESULT_BUTTON_Y, ROW_HEIGHT, rowCenterY, scoreY, statusY, TABLE_TOP,
    TIMER_TEXT_RIGHT_X, TOP_TEXT_SIZE, TOP_TEXT_Y,
} from '../layout';

/** 'leaving' is set once the player has chosen to go back to `Title`, so no later input reaches this Scene. */
type SceneMode = 'playing' | 'result' | 'leaving';

type RowButton = {
    bg: Phaser.GameObjects.Rectangle;
    txt: Phaser.GameObjects.Text;
};

export class Game extends Scene {
    private level = 1;
    private roundLevel = 1;
    private reachedLevel = 1;
    private initialValue = 0;
    private targetValue = 0;
    private slots: TurnSlot[] = [];
    private progress: ProgressState = { currentValue: 0, won: false, wonAtTurn: null, rows: [] };
    private shortestPath: HistoryEntry[] = [];

    private mode: SceneMode = 'playing';
    private roundWon = false;
    private roundDeadline = 0;
    private timerEvent?: Phaser.Time.TimerEvent;
    private swallowNextResultClick = false;

    private levelText!: Phaser.GameObjects.Text;
    private headerText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private scoreText!: Phaser.GameObjects.Text;
    private tableObjects: Phaser.GameObjects.GameObject[] = [];
    private actionButtons: RowButton[] = [];

    constructor() {
        super('Game');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(C.BG);
        this.level = loadLevel(localStorage);
        this.reachedLevel = this.level;

        const height = this.scale.height;
        const topFont = `${TOP_TEXT_SIZE}px`;
        this.levelText = this.add.text(LEVEL_TEXT_X, TOP_TEXT_Y, '', { fontFamily: FONT, fontSize: topFont, color: C.SUB });
        this.headerText = this.add.text(HEADER_TEXT_X, HEADER_TEXT_Y, '', {
            fontFamily: FONT,
            fontSize: topFont,
            color: C.TEXT,
            align: 'center',
        }).setOrigin(0.5, 0);
        this.timerText = this.add.text(TIMER_TEXT_RIGHT_X, TOP_TEXT_Y, '', { fontFamily: FONT, fontSize: topFont, color: C.TIMER_OK })
            .setOrigin(1, 0);
        this.statusText = this.add.text(240, statusY(height), '', {
            fontFamily: FONT,
            fontSize: '22px',
            color: C.TEXT,
            align: 'center',
        }).setOrigin(0.5);
        // The score and best line on a clear result, under the status text (shown only after a clear).
        this.scoreText = this.add.text(240, scoreY(height), '', {
            fontFamily: FONT,
            fontSize: '25px',
            color: C.TEXT,
            align: 'center',
        }).setOrigin(0.5);

        this.setupInputHandlers();
        this.startRound();
    }

    private startRound(): void {
        this.stopTimer();
        this.clearTable();
        this.clearActionButtons();

        this.mode = 'playing';
        this.roundWon = false;
        this.swallowNextResultClick = false;
        this.shortestPath = [];
        this.roundLevel = this.level;

        const problem = generateProblem(this.level);
        this.initialValue = problem.initialValue;
        this.targetValue = problem.targetValue;
        this.slots = problem.slots;
        this.shortestPath = problem.shortestPath;

        this.progress = evaluateProgress(this.initialValue, this.targetValue, this.slots);
        this.roundDeadline = this.game.loop.time + ROUND_TIME_MS;
        this.timerEvent = this.time.addEvent({
            delay: 50,
            callback: () => this.tickTimer(),
            loop: true,
        });

        this.refreshHeader();
        this.renderTable();
        this.statusText.setText('').setColor(C.TEXT);
        this.scoreText.setText('');
    }

    private refreshHeader(): void {
        const shownLevel = this.mode === 'result' ? this.roundLevel : this.level;
        this.levelText.setText(`Lv. ${shownLevel}`);
        this.headerText.setText(`目標: ${this.targetValue}  初期値: ${this.initialValue}  現在値: ${this.progress.currentValue}`);

        const restMs = Math.max(0, this.roundDeadline - this.game.loop.time);

        if (import.meta.env.DEV) {
            // QA only: the time left in the round (never part of the production bundle).
            (window as unknown as { __qa?: unknown }).__qa = { scene: 'Game', mode: this.mode, level: this.level, restMs };
        }
        const restSec = (restMs / 1000).toFixed(1);
        const color = restMs <= 10000 ? C.TIMER_WARN : C.TIMER_OK;
        this.timerText.setText(`残り ${restSec} 秒`).setColor(color);
    }

    private tickTimer(): void {
        if (this.mode !== 'playing') return;
        this.refreshHeader();

        if (!isRoundOpen(this.game.loop.time, this.roundDeadline)) {
            this.finalizeRound(false);
        }
    }

    private onSelect(turnIndex: number, selected: Operation | null): void {
        if (this.mode !== 'playing') return;
        if (!isRoundOpen(this.game.loop.time, this.roundDeadline)) return;

        this.slots[turnIndex].selected = selected;
        this.progress = evaluateProgress(this.initialValue, this.targetValue, this.slots);
        this.refreshHeader();
        this.renderTable();

        if (this.progress.won) {
            this.finalizeRound(true);
        }
    }

    private finalizeRound(triggeredByPointer: boolean): void {
        if (this.mode !== 'playing') return;
        this.stopTimer();
        this.swallowNextResultClick = triggeredByPointer;

        this.progress = evaluateProgress(this.initialValue, this.targetValue, this.slots);
        this.roundWon = this.progress.won;

        if (this.roundWon) {
            this.level = levelAfterClear(this.level);
            this.reachedLevel = nextReachedLevel(this.reachedLevel, this.level);
            saveLevel(this.level, localStorage);
            this.statusText
                .setText('クリア - クリックで次へ')
                .setColor(C.WIN);
            this.scoreText.setText(this.scoreLine());
        } else {
            this.statusText
                .setText('ゲームオーバー - 最初から / クリックで続き')
                .setColor(C.LOSE);
        }

        this.mode = 'result';
        this.clearActionButtons();
        this.renderTable();
        this.actionButtons.push(
            this.createActionButton(
                RESULT_BUTTON_X,
                RESULT_BUTTON_Y,
                RESULT_BUTTON_WIDTH,
                RESULT_BUTTON_HEIGHT,
                this.roundWon ? 'TITLE' : '最初から',
                () => this.goToTitleFromResult(),
            ),
        );
        this.playResultEffect(this.roundWon);
        this.refreshHeader();
    }

    /** Score of this clear and the best, computed at the moment of the win (docs/spec.md: スコア条件). */
    private scoreLine(): string {
        const usedMoves = countUsedMoves(this.slots, this.progress.wonAtTurn ?? this.slots.length);
        const { score, shownBest } = clearResult({
            remainingMs: this.roundDeadline - this.game.loop.time,
            maxMoves: this.slots.length,
            usedMoves,
            clearedLevel: this.roundLevel,
            stored: loadBest(localStorage),
            save: (best) => saveBest(best, localStorage),
        });
        const bestText = shownBest ? this.formatBest(shownBest) : 'ベスト —';
        return `スコア ${score} / ${bestText}`;
    }

    private formatBest(best: Best): string {
        return `ベスト Lv.${best.level} / ${best.score}`;
    }

    private playResultEffect(won: boolean): void {
        const rgb = won ? { r: 34, g: 197, b: 94 } : { r: 239, g: 68, b: 68 };
        this.cameras.main.flash(220, rgb.r, rgb.g, rgb.b, false);
        this.cameras.main.shake(won ? 140 : 220, won ? 0.0025 : 0.0055, false);

        this.tweens.add({
            targets: this.statusText,
            scaleX: { from: 1, to: 1.08 },
            scaleY: { from: 1, to: 1.08 },
            duration: 140,
            yoyo: true,
            repeat: 2,
        });
    }

    private createActionButton(
        x: number,
        y: number,
        w: number,
        h: number,
        label: string,
        onClick: () => void,
    ): RowButton {
        const bg = this.add.rectangle(x, y, w, h, C.BTN)
            .setDepth(5000)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, e: Phaser.Types.Input.EventData) => {
                e.stopPropagation();
                onClick();
            });
        const txt = this.add.text(x, y, label, {
            fontFamily: FONT,
            fontSize: '22px',
            color: '#f8fafc',
        }).setOrigin(0.5).setDepth(5001);
        return { bg, txt };
    }

    private renderTable(): void {
        this.clearTable();
        // Portrait layout: keep each row single-line for readability.
        const showShortest = this.mode === 'result';
        const btnCenters = BUTTON_CENTERS_X;
        const btnW = BUTTON_WIDTH;
        const btnH = BUTTON_HEIGHT;
        const buttonsRightEdge = btnCenters[btnCenters.length - 1] + (btnW / 2);
        const historyX = buttonsRightEdge + 8;

        const panelH = this.slots.length * ROW_HEIGHT;
        this.tableObjects.push(this.add.rectangle(240, TABLE_TOP + panelH / 2, 476, panelH, C.PANEL));

        this.slots.forEach((slot, i) => {
            const y = rowCenterY(i);
            const bgColor = i % 2 === 0 ? C.PANEL_ALT : C.PANEL;
            this.tableObjects.push(this.add.rectangle(240, y, 472, ROW_HEIGHT - 2, bgColor));

            const rowProgress = this.progress.rows[i];
            const interactive = this.mode === 'playing' && !rowProgress.isAutoSkip;
            const optionsWithSkip: Array<Operation | null> = [...slot.options, null];
            const shortestEntry = showShortest ? (this.shortestPath[i] ?? null) : null;
            const shortestValue = shortestEntry ? String(shortestEntry.resultValue) : '—';

            optionsWithSkip.forEach((op, idx) => {
                const x = btnCenters[idx];
                const selected = slot.selected?.label === op?.label || (slot.selected === null && op === null);
                const isShortestPick = showShortest && shortestEntry !== null
                    && ((shortestEntry.operation === null && op === null)
                        || shortestEntry.operation?.label === op?.label);
                const baseColor = op === null ? C.SKIP : C.UNSELECTED;
                let fill = selected ? C.SELECTED : baseColor;
                if (isShortestPick) {
                    fill = C.SHORTEST;
                }
                if (rowProgress.isAutoSkip && this.mode === 'playing') {
                    fill = C.DISABLED;
                }

                const bg = this.add.rectangle(x, y, btnW, btnH, fill);
                this.tableObjects.push(bg);

                const txt = this.add.text(x, y, op?.label ?? '-', {
                    fontFamily: FONT,
                    fontSize: '25px',
                    color: (rowProgress.isAutoSkip && this.mode === 'playing') ? '#64748b' : '#f8fafc',
                }).setOrigin(0.5);
                this.tableObjects.push(txt);

                if (interactive) {
                    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onSelect(i, op));
                }
            });

            const historyText = this.add.text(historyX, y, `${rowProgress.value}`, {
                fontFamily: FONT,
                fontSize: '28px',
                color: C.TEXT,
            }).setOrigin(0, 0.5);
            this.tableObjects.push(historyText);
            if (showShortest) {
                this.tableObjects.push(
                    this.add.text(historyX + historyText.width + 6, y, `${shortestValue}`, {
                        fontFamily: FONT,
                        fontSize: '30px',
                        color: '#16a34a',
                    }).setOrigin(0, 0.5),
                );
            }
        });
    }

    private clearTable(): void {
        this.tableObjects.forEach((obj) => obj.destroy());
        this.tableObjects = [];
    }

    private clearActionButtons(): void {
        this.actionButtons.forEach((btn) => {
            btn.bg.destroy();
            btn.txt.destroy();
        });
        this.actionButtons = [];
    }

    private stopTimer(): void {
        this.timerEvent?.remove();
        this.timerEvent = undefined;
    }

    /** Back to `Title` from a result screen. A loss restarts from Lv.1 (saved), a clear keeps the saved level. */
    private goToTitleFromResult(): void {
        if (this.mode !== 'result') return;
        if (!this.roundWon) {
            this.level = handleLossLevelChoice(this.level, 'restart', localStorage);
        }
        this.mode = 'leaving';
        this.stopTimer();
        this.scene.start('Title');
    }

    /** Input listeners are registered once here and released on shutdown (AGENTS.md 4.2). */
    private setupInputHandlers(): void {
        const keyboard = this.input.keyboard;
        this.input.on('pointerdown', this.onResultPointerDown);
        keyboard?.on('keydown-T', this.onResultKeyT);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onResultPointerDown);
            keyboard?.off('keydown-T', this.onResultKeyT);
            // The shapes were destroyed with the Scene; forget them so the next start does not touch them.
            this.tableObjects = [];
            this.actionButtons = [];
            this.timerEvent = undefined;
        });
    }

    private readonly onResultPointerDown = (): void => {
        if (this.mode !== 'result') return;
        if (this.swallowNextResultClick) {
            this.swallowNextResultClick = false;
            return;
        }

        if (this.roundWon) {
            this.startRound();
            return;
        }

        this.level = handleLossLevelChoice(this.reachedLevel, 'continue', localStorage);
        this.startRound();
    };

    /** `T` returns to `Title` from a result screen only; during play it does nothing. */
    private readonly onResultKeyT = (): void => this.goToTitleFromResult();
}
