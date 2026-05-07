import { Scene } from 'phaser';
import {
    type Operation,
    type TurnSlot,
    type ProgressState,
    type HistoryEntry,
    ROUND_TIME_MS,
    getDifficulty,
    createTurnSlots,
    evaluateProgress,
    loadLevel,
    saveLevel,
    handleLossLevelChoice,
    findShortestSolutionFromOptions,
} from '../logic';

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

type SceneMode = 'playing' | 'result';

type RowButton = {
    bg: Phaser.GameObjects.Rectangle;
    txt: Phaser.GameObjects.Text;
};

const C = {
    BG: 0x0f172a,
    PANEL: 0x111827,
    PANEL_ALT: 0x0b1220,
    TEXT: '#e2e8f0',
    SUB: '#94a3b8',
    TIMER_OK: '#fde68a',
    TIMER_WARN: '#f87171',
    SELECTED: 0x2563eb,
    UNSELECTED: 0x334155,
    SKIP: 0x475569,
    DISABLED: 0x1f2937,
    SHORTEST: 0x16a34a,
    WIN: '#4ade80',
    LOSE: '#f87171',
    BTN: 0x3b82f6,
} as const;

const FONT = 'Arial, sans-serif';

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
    private tableObjects: Phaser.GameObjects.GameObject[] = [];
    private actionButtons: RowButton[] = [];

    constructor() {
        super('Game');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(C.BG);
        this.level = loadLevel(localStorage);
        this.reachedLevel = this.level;

        this.levelText = this.add.text(12, 18, '', { fontFamily: FONT, fontSize: '22px', color: C.SUB });
        this.headerText = this.add.text(240, 46, '', { fontFamily: FONT, fontSize: '18px', color: C.TEXT, align: 'center' }).setOrigin(0.5, 0);
        this.timerText = this.add.text(468, 18, '', { fontFamily: FONT, fontSize: '22px', color: C.TIMER_OK }).setOrigin(1, 0);
        this.statusText = this.add.text(240, 878, '', {
            fontFamily: FONT,
            fontSize: '22px',
            color: C.TEXT,
            align: 'center',
        }).setOrigin(0.5);

        this.setupClickHandler();
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

        const diff = getDifficulty(this.level);
        let foundPath = false;
        for (let attempt = 0; attempt < 200; attempt += 1) {
            this.initialValue = randomBetween(diff.initialValueMin, diff.initialValueMax);
            this.targetValue = randomBetween(diff.targetMin, diff.targetMax);
            this.slots = createTurnSlots(diff.maxTurns);

            const path = findShortestSolutionFromOptions(
                this.initialValue,
                this.targetValue,
                this.slots.map((slot) => slot.options),
            );
            if (path !== null) {
                this.shortestPath = path;
                foundPath = true;
                break;
            }
        }

        // Safety fallback: always start with a solvable board.
        if (!foundPath) {
            this.initialValue = randomBetween(diff.initialValueMin, diff.initialValueMax);
            this.slots = createTurnSlots(diff.maxTurns);
            const guaranteedOp = this.slots[0].options[0];
            this.targetValue = guaranteedOp.apply(this.initialValue);
            this.shortestPath = [{ operation: guaranteedOp, resultValue: this.targetValue, options: this.slots[0].options }];
        }

        this.progress = evaluateProgress(this.initialValue, this.targetValue, this.slots);
        this.roundDeadline = this.time.now + ROUND_TIME_MS;
        this.timerEvent = this.time.addEvent({
            delay: 50,
            callback: () => this.tickTimer(),
            loop: true,
        });

        this.refreshHeader();
        this.renderTable();
        this.statusText.setText('').setColor(C.TEXT);
    }

    private refreshHeader(): void {
        const shownLevel = this.mode === 'result' ? this.roundLevel : this.level;
        this.levelText.setText(`Lv. ${shownLevel}`);
        this.headerText.setText(`目標: ${this.targetValue}  初期値: ${this.initialValue}\n現在値: ${this.progress.currentValue}`);

        const restMs = Math.max(0, this.roundDeadline - this.time.now);
        const restSec = (restMs / 1000).toFixed(1);
        const color = restMs <= 10000 ? C.TIMER_WARN : C.TIMER_OK;
        this.timerText.setText(`残り ${restSec} 秒`).setColor(color);
    }

    private tickTimer(): void {
        if (this.mode !== 'playing') return;
        this.refreshHeader();

        if (this.time.now > this.roundDeadline) {
            this.finalizeRound(false, false);
        }
    }

    private onSelect(turnIndex: number, selected: Operation | null): void {
        if (this.mode !== 'playing') return;
        if (this.time.now > this.roundDeadline) return;

        this.slots[turnIndex].selected = selected;
        this.progress = evaluateProgress(this.initialValue, this.targetValue, this.slots);
        this.refreshHeader();
        this.renderTable();

        if (this.progress.won) {
            this.finalizeRound(true, true);
        }
    }

    private finalizeRound(wonByImmediateMatch: boolean, triggeredByPointer: boolean): void {
        if (this.mode !== 'playing') return;
        this.stopTimer();
        this.swallowNextResultClick = triggeredByPointer;

        this.progress = evaluateProgress(this.initialValue, this.targetValue, this.slots);
        this.roundWon = wonByImmediateMatch && this.progress.won;
        if (!wonByImmediateMatch) {
            this.roundWon = this.progress.won;
        }

        if (this.roundWon) {
            this.level += 1;
            this.reachedLevel = Math.max(this.reachedLevel, this.level);
            saveLevel(this.level, localStorage);
            this.statusText
                .setText('クリア - クリックで次へ')
                .setColor(C.WIN);
        } else {
            this.statusText
                .setText('ゲームオーバー - 最初から / クリックで続き')
                .setColor(C.LOSE);
        }

        this.mode = 'result';
        this.clearActionButtons();
        this.renderTable();
        if (!this.roundWon) {
            this.actionButtons.push(
                this.createActionButton(240, 928, 200, 44, '最初から', () => {
                    this.level = handleLossLevelChoice(this.level, 'restart', localStorage);
                    this.reachedLevel = 1;
                    this.startRound();
                }),
            );
        }
        this.playResultEffect(this.roundWon);
        this.refreshHeader();
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
        const tableTop = 92;
        const rowH = 50;
        const top = tableTop + rowH / 2;
        const showShortest = this.mode === 'result';
        const btnCenters = [40, 120, 200, 280, 360];
        const btnW = 72;
        const btnH = 28;
        const buttonsRightEdge = btnCenters[btnCenters.length - 1] + (btnW / 2);
        const historyX = buttonsRightEdge + 8;

        const panelH = this.slots.length * rowH;
        this.tableObjects.push(this.add.rectangle(240, tableTop + panelH / 2, 476, panelH, C.PANEL));

        this.slots.forEach((slot, i) => {
            const y = top + i * rowH;
            const bgColor = i % 2 === 0 ? C.PANEL_ALT : C.PANEL;
            this.tableObjects.push(this.add.rectangle(240, y, 472, rowH - 2, bgColor));

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

    private setupClickHandler(): void {
        this.input.on('pointerdown', () => {
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
        });
    }
}
