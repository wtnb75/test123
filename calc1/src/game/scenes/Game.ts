import { Scene } from 'phaser';
import {
    type Operation,
    type HistoryEntry,
    OPERATION_POOL,
    TURN_TIME_MS,
    OPTION_COUNT,
    getDifficulty,
    pickOperations,
    applyOperation,
    checkWin,
    loadLevel,
    saveLevel,
    findSolutionFromOptions,
    canReachTarget,
} from '../logic';

// ────────────────────────────────────────────────────────────
// Utility functions
// ────────────────────────────────────────────────────────────
function hexToInt(hex: string): number {
    return parseInt(hex.slice(1), 16);
}

function randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

type HistoryRow = {
    isInitial: boolean;
    operationLabel: string;
    resultValue: number;
    optionLabels: string[];
    selectedLabel: string | null;    // solution / history の選択（正解なら緑）
    playerSelectedLabel?: string | null; // プレイヤーの実選択（青・solution mode 専用）
};

// ────────────────────────────────────────────────────────────
// Style constants
// ────────────────────────────────────────────────────────────
const C = {
    BG:          '#0f172a',
    TEXT:        '#e2e8f0',
    SUBTEXT:     '#94a3b8',
    TIMER_OK:    '#fde68a',
    TIMER_WARN:  '#f87171',
    BTN_ACTIVE:  '#3b82f6',
    BTN_HOVER:   '#2563eb',
    BTN_SKIP:    '#64748b',
    BTN_NEXT_BG: '#1e293b',
    BTN_NEXT_FG: '#64748b',
    WIN:         '#4ade80',
    LOSE:        '#f87171',
} as const;

const FONT = 'Arial, sans-serif';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function makeText(
    scene: Scene,
    x: number, y: number,
    text: string,
    size: number,
    color: string,
    origin = 0.5,
): Phaser.GameObjects.Text {
    return scene.add.text(x, y, text, {
        fontFamily: FONT,
        fontSize: size,
        fill: color,
    }).setOrigin(origin);
}

function makeButton(
    scene: Scene,
    x: number, y: number, w: number, h: number,
    label: string,
    bgColor: string,
    onClick: () => void,
): { bg: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text } {
    const bg = scene.add.rectangle(x, y, w, h, hexToInt(bgColor))
        .setDepth(1000)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', onClick)
        .on('pointerover', function (this: Phaser.GameObjects.Rectangle) {
            this.setFillStyle(hexToInt(C.BTN_HOVER));
        })
        .on('pointerout', function (this: Phaser.GameObjects.Rectangle) {
            this.setFillStyle(hexToInt(bgColor));
        });
    const txt = scene.add.text(x, y, label, {
        fontFamily: FONT,
        fontSize: 32,
        fill: '#e2e8f0',
    }).setOrigin(0.5).setDepth(1001);
    return { bg, txt };
}

// ────────────────────────────────────────────────────────────
// Game Scene
// ────────────────────────────────────────────────────────────
export class Game extends Scene
{
    // ── state ──────────────────────────────────────────────
    private level = 1;
    private initialValue = 0;  // Store for solution finding
    private currentValue = 0;
    private targetValue = 0;
    private turnsLeft = 0;
    private currentOptions: Operation[] = [];
    private nextOptions: Operation[] = [];
    private isRoundActive = false;
    private isGameOver = false;
    private isAwaitingConfirm = false;  // 確認待ち状態
    private roundDeadline = 0;
    private timerEvent?: Phaser.Time.TimerEvent;
    private history: HistoryEntry[] = [];  // 各ターンの操作と結果
    private turnOptionHistory: Operation[][] = [];  // 各ターンで提示した選択肢
    private solutionPath: HistoryEntry[] | null = null;  // ゲームオーバー時の正解ルート

    // ── static UI ─────────────────────────────────────────
    private levelText!: Phaser.GameObjects.Text;
    private targetText!: Phaser.GameObjects.Text;
    private currentText!: Phaser.GameObjects.Text;
    private turnsText!: Phaser.GameObjects.Text;
    private timerText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private nextLabel!: Phaser.GameObjects.Text;
    private historyTitleText!: Phaser.GameObjects.Text;
    private historyPanelBg!: Phaser.GameObjects.Rectangle;
    private historyRowObjects: Phaser.GameObjects.GameObject[] = [];

    // ── dynamic buttons ───────────────────────────────────
    private currentBtns: { bg: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text }[] = [];
    private skipBtn?: { bg: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text };
    private nextTexts: Phaser.GameObjects.Text[] = [];
    private restartBtn?: { bg: Phaser.GameObjects.Rectangle; txt: Phaser.GameObjects.Text };

    constructor () { super('Game'); }

    // ── Phaser lifecycle ──────────────────────────────────
    create (): void
    {
        this.cameras.main.setBackgroundColor(C.BG);
        this.level = loadLevel(localStorage);
        this.buildStaticUI();
        this.setupClickHandler();
        this.startGame();
    }

    // ── UI setup ─────────────────────────────────────────
    private buildStaticUI (): void
    {
        // Header row (top-center)
        this.levelText   = makeText(this, 512,  36, '',  28, C.SUBTEXT);
        this.targetText  = makeText(this, 512,  80, '',  38, C.TEXT);
        this.currentText = makeText(this, 512, 126, '',  48, C.TEXT);
        this.turnsText   = makeText(this, 300, 172, '',  26, C.SUBTEXT);
        this.timerText   = makeText(this, 724, 172, '',  26, C.TIMER_OK);

        // History display panel (right column)
        this.historyTitleText = makeText(this, 852, 188, '計算ログ', 20, C.SUBTEXT);
        this.historyPanelBg = this.add.rectangle(852, 442, 304, 408, 0x111827);
        this.historyPanelBg.setStrokeStyle(2, 0x334155);

        // Divider between play area and history panel
        this.add.rectangle(686, 470, 4, 540, 0x334155);

        // Left label
        makeText(this, 236, 286, '── 今の候補 (選択) ──', 22, C.SUBTEXT);

        // Middle label
        this.nextLabel = makeText(this, 526, 286, '── 次の候補 ──', 20, C.SUBTEXT);

        // Status message (bottom-center)
        this.statusText = makeText(this, 512, 700, '', 24, C.TEXT);
        this.statusText.setAlign('center');
    }



    // ── Game flow ─────────────────────────────────────────
    private startGame (): void
    {
        this.clearRound();
        this.isGameOver = false;
        this.isAwaitingConfirm = false;
        const diff = getDifficulty(this.level);

        // Generate a problem with guaranteed solvable solution
        let valid = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            this.initialValue = randomBetween(diff.initialValueMin, diff.initialValueMax);
            this.targetValue  = randomBetween(diff.targetMin, diff.targetMax);
            if (canReachTarget(this.initialValue, this.targetValue, OPERATION_POOL, diff.maxTurns)) {
                valid = true;
                break;
            }
        }

        // Fallback (should rarely happen)
        if (!valid) {
            this.initialValue = 1;
            this.targetValue = 2;
        }

        this.currentValue      = this.initialValue;
        this.turnsLeft          = diff.maxTurns;
        this.history            = [];
        this.turnOptionHistory  = [];
        this.solutionPath       = null;
        this.currentOptions = pickOperations(OPERATION_POOL, OPTION_COUNT);
        this.nextOptions    = pickOperations(OPERATION_POOL, OPTION_COUNT);
        this.statusText.setText('').setColor(C.TEXT);
        this.updateHistoryDisplay();
        this.beginRound();
    }

    private beginRound (): void
    {
        this.clearRound();
        this.isRoundActive = true;
        this.refreshHeader();
        this.renderCurrentBtns();
        this.renderNextArea();
        this.turnOptionHistory.push([...this.currentOptions]);
        this.roundDeadline = this.time.now + TURN_TIME_MS;
        this.timerEvent = this.time.addEvent({
            delay: 100,
            callback: this.tickTimer,
            callbackScope: this,
            loop: true,
        });
        this.tickTimer();
    }

    private advanceTurn (chosenOp: Operation | null): void
    {
        const turnOptions = [...this.currentOptions];

        // Apply operation (null = skip)
        if (chosenOp !== null) {
            this.currentValue = applyOperation(this.currentValue, chosenOp);
        }
        this.turnsLeft -= 1;

        // Record in history
        this.history.push({ operation: chosenOp, resultValue: this.currentValue, options: turnOptions });
        this.updateHistoryDisplay();

        // Check win
        if (checkWin(this.currentValue, this.targetValue)) {
            this.finishGame(true);
            return;
        }

        // Check loss
        if (this.turnsLeft <= 0) {
            this.finishGame(false);
            return;
        }

        // Promote next → current, generate new next
        this.currentOptions = this.nextOptions;
        this.nextOptions    = pickOperations(OPERATION_POOL, OPTION_COUNT);
        this.beginRound();
    }

    private finishGame (won: boolean): void
    {
        this.clearRound();
        this.isGameOver = true;
        this.isAwaitingConfirm = false;
        this.refreshHeader();
        this.timerText.setText('');

        if (won) {
            this.level += 1;
            saveLevel(this.level, localStorage);
        } else {
            // Find solution path using only the options actually presented to the player
            this.solutionPath = findSolutionFromOptions(
                this.initialValue,
                this.targetValue,
                this.turnOptionHistory,
            );
        }

        this.updateStatusText();
    }

    // ── Input handlers ────────────────────────────────────
    private selectOption (index: number): void
    {
        if (!this.isRoundActive || this.isGameOver) return;
        const op = this.currentOptions[index];
        if (!op) return;
        this.advanceTurn(op);
    }

    private doSkip (): void
    {
        if (!this.isRoundActive || this.isGameOver) return;
        this.advanceTurn(null);
    }

    // ── Timer ─────────────────────────────────────────────
    private tickTimer (): void
    {
        if (!this.isRoundActive) return;
        const rest = Math.max(0, this.roundDeadline - this.time.now);
        const sec  = (rest / 1000).toFixed(1);
        const color = rest < 2000 ? C.TIMER_WARN : C.TIMER_OK;
        this.timerText.setText(`⏱ ${sec} 秒`).setColor(color);
        if (rest <= 0) this.advanceTurn(null); // timeout = skip
    }

    // ── Render helpers ────────────────────────────────────
    private refreshHeader (): void
    {
        this.levelText.setText(`Lv. ${this.level}`);
        this.targetText.setText(`目標: ${this.targetValue}`);
        this.currentText.setText(`現在: ${this.currentValue}`);
        this.turnsText.setText(`残り手数: ${this.turnsLeft}`);
    }

    private renderCurrentBtns (): void
    {
        const BW = 200, BH = 60;
        const OX = 236; // center x of left field

        this.currentOptions.forEach((op, i) => {
            const y = 360 + i * 88;
            const btn = makeButton(this, OX, y, BW, BH, op.label,
                C.BTN_ACTIVE, () => this.selectOption(i));
            this.currentBtns.push(btn);
        });

        // Skip button — fixed at bottom of left field
        this.skipBtn = makeButton(this, OX, 700, BW, BH, 'スキップ',
            C.BTN_SKIP, () => this.doSkip());
    }

    private renderNextArea (): void
    {
        const OX = 526;
        const BW = 160;
        const BH = 48;

        if (this.turnsLeft <= 1) {
            this.nextTexts.push(
                makeText(this, OX, 390, '次の手はありません', 20, C.SUBTEXT),
            );
            return;
        }

        this.nextOptions.forEach((op, i) => {
            const y = 360 + i * 88;
            const bg = this.add.rectangle(OX, y, BW, BH, hexToInt(C.BTN_NEXT_BG));
            const txt = this.add.text(OX, y, op.label, {
                fontFamily: FONT, fontSize: 22, fill: '#cbd5e1',
            }).setOrigin(0.5);
            this.nextTexts.push(bg as unknown as Phaser.GameObjects.Text, txt);
        });
    }

    // ── Cleanup ───────────────────────────────────────────
    private clearRound (): void
    {
        this.isRoundActive = false;
        this.timerEvent?.remove();
        this.timerEvent = undefined;

        this.currentBtns.forEach(({ bg, txt }) => { bg.destroy(); txt.destroy(); });
        this.currentBtns = [];

        if (this.skipBtn) {
            this.skipBtn.bg.destroy();
            this.skipBtn.txt.destroy();
            this.skipBtn = undefined;
        }

        this.nextTexts.forEach((o) => o.destroy());
        this.nextTexts = [];

        // Cleanup end-game buttons
        if (this.confirmBtn) {
            this.confirmBtn.bg.destroy();
            this.confirmBtn.txt.destroy();
            this.confirmBtn = undefined;
        }
        if (this.restartBtn) {
            this.restartBtn.bg.destroy();
            this.restartBtn.txt.destroy();
            this.restartBtn = undefined;
        }
    }

    // ── UI updates ────────────────────────────────────────
    private formatHistoryRows (entries: HistoryEntry[]): HistoryRow[]
    {
        const rows: HistoryRow[] = [{
            isInitial: true,
            operationLabel: '初期値',
            resultValue: this.initialValue,
            optionLabels: [],
            selectedLabel: null,
        }];
        entries.forEach((entry) => {
            const selectedLabel = entry.operation ? entry.operation.label : 'スキップ';
            const optionLabels = (entry.options ?? [])
                .map((op) => op.label)
                .slice(0, OPTION_COUNT);
            if (entry.operation === null) {
                optionLabels.push('スキップ');
            }

            rows.push({
                isInitial: false,
                operationLabel: selectedLabel,
                resultValue: entry.resultValue,
                optionLabels: Array.from(new Set(optionLabels)).slice(0, OPTION_COUNT),
                selectedLabel,
            });
        });
        return rows;
    }

    private clearHistoryRows (): void
    {
        this.historyRowObjects.forEach((o) => o.destroy());
        this.historyRowObjects = [];
    }

    private renderHistoryPanel (
        entries: HistoryEntry[],
        title: string,
        accentHex: string,
        mode: 'history' | 'solution',
    ): void
    {
        const rows = this.formatHistoryRows(entries);

        // solution mode: inject player's actual selection (blue) into each row from history
        if (mode === 'solution') {
            rows.forEach((row, i) => {
                if (row.isInitial) return;
                const playerEntry = this.history[i - 1]; // offset by initial row
                if (playerEntry) {
                    row.playerSelectedLabel = playerEntry.operation
                        ? playerEntry.operation.label
                        : 'スキップ';
                }
            });
        }

        this.clearHistoryRows();
        this.historyTitleText.setText(title).setColor(accentHex);

        const panelX = this.historyPanelBg.x;
        const panelTop = this.historyPanelBg.y - this.historyPanelBg.height / 2;
        const panelLeft = this.historyPanelBg.x - this.historyPanelBg.width / 2;
        const panelRight = this.historyPanelBg.x + this.historyPanelBg.width / 2;
        const panelWidth = this.historyPanelBg.width - 18;

        const rowGap = 28;
        const rowStartY = panelTop + 48;

        rows.forEach((row, i) => {
            const y = rowStartY + i * rowGap;
            const rowBg = this.add.rectangle(panelX, y, panelWidth, 24, i % 2 === 0 ? 0x0b1220 : 0x111827);
            this.historyRowObjects.push(rowBg);

            if (row.isInitial || row.optionLabels.length === 0) {
                const opText = this.add.text(panelLeft + 14, y, row.operationLabel, {
                    fontFamily: FONT,
                    fontSize: 16,
                    fill: '#cbd5e1',
                }).setOrigin(0, 0.5);
                const arrow = this.add.text(panelX, y, '→', {
                    fontFamily: FONT,
                    fontSize: 16,
                    fill: '#60a5fa',
                }).setOrigin(0.5);
                const resultText = this.add.text(panelRight - 14, y, String(row.resultValue), {
                    fontFamily: FONT,
                    fontSize: 17,
                    fill: '#e2e8f0',
                    fontStyle: 'bold',
                }).setOrigin(1, 0.5);
                this.historyRowObjects.push(opText, arrow, resultText);
                return;
            }

            const chipStartX = panelLeft + 12;
            const chipW = 46;
            const chipH = 18;
            const chipGap = 6;
            row.optionLabels.slice(0, OPTION_COUNT).forEach((label, idx) => {
                const chipX = chipStartX + idx * (chipW + chipGap) + chipW / 2;
                const isSolutionPick = row.selectedLabel === label;
                const isPlayerPick   = row.playerSelectedLabel === label;
                const bgColor = isSolutionPick && mode === 'solution' ? 0x16a34a  // 緑: 正解
                    : isPlayerPick                                    ? 0x2563eb  // 青: プレイヤー選択
                    : 0x334155;                                                   // グレー: 非選択
                const fgColor = (isSolutionPick || isPlayerPick) ? '#f8fafc' : '#94a3b8';
                const chip = this.add.rectangle(chipX, y, chipW, chipH, bgColor);
                const chipText = this.add.text(chipX, y, label, {
                    fontFamily: FONT,
                    fontSize: 12,
                    fill: fgColor,
                }).setOrigin(0.5);
                this.historyRowObjects.push(chip, chipText);
            });

            const resultText = this.add.text(panelRight - 14, y, String(row.resultValue), {
                fontFamily: FONT,
                fontSize: 17,
                fill: '#e2e8f0',
                fontStyle: 'bold',
            }).setOrigin(1, 0.5);
            this.historyRowObjects.push(resultText);
        });
    }

    private updateHistoryDisplay (): void
    {
        this.renderHistoryPanel(this.history, '計算ログ', C.SUBTEXT, 'history');
    }

    private updateStatusText (): void
    {
        if (!this.isGameOver) {
            this.statusText.setText('').setColor(C.TEXT);
            return;
        }

        if (this.history.length === 0) {
            // Never took a turn (shouldn't happen normally)
            this.statusText.setText('初期状態：今すぐ開始してください').setColor(C.TEXT);
            return;
        }

        // Get win/loss status
        const isWon = this.currentValue === this.targetValue;

        if (isWon) {
            const msg = this.isAwaitingConfirm
                ? '🎉 目標達成！クリア！\n画面クリックで次のレベルへ'
                : '🎉 目標達成！クリア！\n画面クリックで確認';
            this.statusText.setText(msg).setColor(C.WIN);
        } else {
            let msg: string;
            if (!this.isAwaitingConfirm) {
                msg = '💀 手数切れ…\n画面クリックで確認';
            } else if (this.solutionPath) {
                this.renderHistoryPanel(this.solutionPath, '正解ルート', C.LOSE, 'solution');
                msg = '💀 手数切れ…\n正解ルートを上に表示中\n画面クリックで再挑戦';
            } else {
                msg = '💀 手数切れ…\n(正解ルートが見つかりませんでした)\n画面クリックで再挑戦';
            }
            this.statusText.setText(msg).setColor(C.LOSE);
        }
    }

    private showRestartButton (): void
    {
        this.restartBtn?.bg.destroy();
        this.restartBtn?.txt.destroy();
        const isWon = this.currentValue === this.targetValue;
        const label = isWon ? '次のレベルへ' : '再挑戦';
        this.restartBtn = makeButton(this, 512, 600, 240, 60, label,
            C.BTN_ACTIVE, () => this.startGame());
    }

    private setupClickHandler (): void
    {
        this.input.on('pointerdown', () => {
            if (!this.isGameOver) return;
            if (!this.isAwaitingConfirm) {
                this.isAwaitingConfirm = true;
                this.updateStatusText();
                this.showRestartButton();
            } else {
                this.startGame();
            }
        });
    }
}
