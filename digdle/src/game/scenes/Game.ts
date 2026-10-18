import { Scene, type GameObjects, type Time } from 'phaser';
import {
    CELL_FILL, CELL_FONT_FAMILY, CELL_LABEL_COLOR, CELL_STROKE, CELL_STROKE_WIDTH, cellLabelSize, COLORS
} from '../logic/boardStyle';
import { applyGuess, createGame } from '../logic/game';
import {
    computeGameLayout, computeToastPlacement, pickToastFontSize, TOAST_FONT_SIZE, TOAST_PADDING_Y, toastBoxWidth,
    type LayoutMetrics
} from '../logic/gameLayout';
import { isDigitOption, modeFromData } from '../logic/selectLayout';
import type { DigitOption, DigitStatus, GameMode, GameStartData, RoundState, TitleData } from '../types';
import {
    BACKGROUND_COLOR, createButton, createHomeIcon, createReselectIcon, createText, detectLocale, translate,
    type Locale, type TextKey
} from './ui';

type UiPhase = 'playing' | 'won' | 'lost';

interface BoardCell {
    box: GameObjects.Rectangle;
    label: GameObjects.Text;
}

const KEY_PRIORITY: Record<DigitStatus, number> = {
    gray: 1,
    yellow: 2,
    green: 3
};

export class Game extends Scene {
    private phase: UiPhase = 'playing';
    private gameApi = createGame();
    private round: RoundState | null = null;
    private selectedMode: GameMode = 'normal';
    private currentGuess = '';
    private uiObjects: GameObjects.GameObject[] = [];
    private endUiObjects: GameObjects.GameObject[] = [];
    private boardCells: BoardCell[][] = [];
    private toastText: GameObjects.Text | null = null;
    private toastBg: GameObjects.Rectangle | null = null;
    private toastTimer: Time.TimerEvent | null = null;
    private toastMaxWidth = 0;
    private keyBoxes = new Map<string, GameObjects.Rectangle>();
    private keyStatus = new Map<string, DigitStatus>();
    private keyboardObjects: GameObjects.GameObject[] = [];
    private layout: LayoutMetrics | null = null;
    private endClickOverlay: GameObjects.Rectangle | null = null;
    private locale: Locale = 'ja';
    private startDigits: DigitOption | null = null;
    private startedAt = 0;
    private readonly onResize = (): void => {
        this.relayoutCurrentPhase();
    };

    constructor() {
        super('Game');
    }

    init(data?: Partial<GameStartData>): void {
        this.selectedMode = modeFromData(data);
        this.startDigits = isDigitOption(data?.digits) ? data.digits : null;
        this.phase = 'playing';
        this.round = null;
        this.currentGuess = '';
        this.uiObjects = [];
        this.endUiObjects = [];
        this.boardCells = [];
        this.toastText = null;
        this.toastBg = null;
        this.toastTimer = null;
        this.keyBoxes.clear();
        this.keyStatus.clear();
        this.keyboardObjects = [];
        this.layout = null;
        this.endClickOverlay = null;
    }

    create(): void {
        if (this.startDigits === null) {
            this.goToTitle();
            return;
        }

        this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);
        this.locale = detectLocale();
        this.startedAt = typeof performance !== 'undefined' ? performance.now() : 0;

        this.input.keyboard?.on('keydown', this.onKeyDown);
        this.scale.on('resize', this.onResize);

        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown);
            this.scale.off('resize', this.onResize);
        });

        this.startRound(this.startDigits);
    }

    /** Ignores the key press that started this Scene, so it is not typed into the board. */
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.timeStamp < this.startedAt) {
            return;
        }

        this.onPhysicalKey(event.key);
    };

    private onPhysicalKey(key: string): void {
        if (this.phase === 'won' || this.phase === 'lost') {
            this.beginNextRoundFromTrigger();
            return;
        }

        if (key === 'Backspace') {
            this.handleToken('backspace');
            return;
        }

        if (key === 'Enter') {
            this.handleToken('enter');
            return;
        }

        if (/^\d$/.test(key)) {
            this.handleToken(key);
        }
    }

    private onVirtualKey(token: string): void {
        if (this.phase === 'won' || this.phase === 'lost') {
            this.beginNextRoundFromTrigger();
            return;
        }

        this.handleToken(token);
    }

    private relayoutCurrentPhase(): void {
        if (!this.round) {
            return;
        }

        this.cleanupMainUi();
        this.clearEndUi();
        this.buildPlayUi();
        this.refreshUi();

        if (this.phase === 'won') {
            this.showEndUi(this.t('clear'));
        } else if (this.phase === 'lost') {
            this.showEndUi(this.t('gameOver'));
        }
    }

    private startRound(digits: number, previousAnswer?: string): void {
        this.round = this.gameApi.createRound(digits, this.selectedMode, previousAnswer);
        this.phase = 'playing';
        this.currentGuess = '';
        this.keyStatus.clear();

        this.cleanupMainUi();
        this.clearEndUi();
        this.buildPlayUi();
        this.refreshUi();
    }

    private beginNextRoundFromTrigger(): void {
        if (!this.round) {
            this.goToTitle();
            return;
        }
        const previous = this.round.answer;
        const digits = this.round.n;
        this.startRound(digits, previous);
    }

    private buildPlayUi(): void {
        if (!this.round) {
            return;
        }

        this.layout = computeGameLayout(
            this.scale.gameSize.width, this.scale.gameSize.height, this.round.attemptLimit, this.round.n
        );
        this.buildVerticalTitle();
        this.buildTopIcons();
        this.createToastUi();

        this.buildBoard(this.round.attemptLimit, this.round.n);
        this.buildVirtualKeyboard();
    }

    private createToastUi(): void {
        if (!this.layout) {
            return;
        }

        // The notice sits in the strip above the board, so it never covers a row or a key.
        const placement = computeToastPlacement(this.layout.width);
        this.toastMaxWidth = placement.maxBoxWidth;

        this.toastBg = this.add.rectangle(placement.centerX, placement.centerY, 10, 10, 0x0b1220, 0.92)
            .setOrigin(0.5, 0.5)
            .setVisible(false)
            .setDepth(1200);
        this.toastText = this.add.text(placement.centerX, placement.centerY, '', {
            fontFamily: 'sans-serif',
            fontSize: TOAST_FONT_SIZE,
            color: '#fca5a5',
            align: 'center',
            // Advanced wrap also breaks inside a long run with no spaces (Japanese messages).
            wordWrap: { width: placement.textWidth, useAdvancedWrap: true }
        }).setOrigin(0.5, 0.5)
            .setVisible(false)
            .setDepth(1201);

        this.uiObjects.push(this.toastBg, this.toastText);
    }

    private showToast(message: string, duration = 2200): void {
        if (!this.toastText || !this.toastBg) {
            return;
        }

        this.toastText.setText(message);
        this.toastText.setColor('#fca5a5');
        this.toastText.setVisible(true);

        const text = this.toastText;
        const fontSize = pickToastFontSize((size) => {
            text.setFontSize(size);
            return text.getBounds().height + TOAST_PADDING_Y * 2;
        });
        text.setFontSize(fontSize);

        const bounds = text.getBounds();
        this.toastBg.setSize(
            toastBoxWidth(bounds.width, this.toastMaxWidth),
            bounds.height + TOAST_PADDING_Y * 2
        );
        this.toastBg.setVisible(true);

        if (this.toastTimer) {
            this.toastTimer.destroy();
            this.toastTimer = null;
        }

        this.toastTimer = this.time.delayedCall(duration, () => {
            this.hideToast();
        });
    }

    private hideToast(): void {
        this.toastText?.setVisible(false);
        this.toastBg?.setVisible(false);
        if (this.toastTimer) {
            this.toastTimer.destroy();
            this.toastTimer = null;
        }
    }

    private buildTopIcons(): void {
        createHomeIcon(this, this.uiObjects);
        createReselectIcon(this, this.scale.gameSize.width, () => this.goToTitle(), this.uiObjects);
    }

    /** Back to the Title; the selected mode is handed over so it stays highlighted. */
    private goToTitle(): void {
        const data: TitleData = { mode: this.selectedMode };
        this.scene.start('Title', data);
    }

    private buildVerticalTitle(): void {
        if (!this.layout) {
            return;
        }

        const title = this.add.text(this.layout.leftTitleX, this.layout.leftTitleY, 'digdle', {
            fontFamily: 'serif',
            fontSize: 34,
            color: '#f9fafb',
            align: 'center',
            lineSpacing: 2
        }).setOrigin(0.5).setAngle(90);

        this.uiObjects.push(title);
    }

    private buildBoard(rows: number, cols: number): void {
        this.boardCells = [];

        if (!this.layout) {
            return;
        }

        const cellSize = this.layout.boardCellSize;
        const gap = this.layout.boardGap;
        const startX = this.layout.boardStartX;
        const startY = this.layout.boardStartY;

        const labelSize = cellLabelSize(cellSize);

        for (let row = 0; row < rows; row += 1) {
            const rowCells: BoardCell[] = [];
            for (let col = 0; col < cols; col += 1) {
                const x = startX + col * (cellSize + gap);
                const y = startY + row * (cellSize + gap);

                const box = this.add.rectangle(x, y, cellSize, cellSize, CELL_FILL)
                    .setOrigin(0, 0)
                    .setStrokeStyle(CELL_STROKE_WIDTH, CELL_STROKE);
                const label = this.add.text(x + cellSize / 2, y + cellSize / 2, '', {
                    fontFamily: CELL_FONT_FAMILY,
                    fontSize: labelSize,
                    color: CELL_LABEL_COLOR
                }).setOrigin(0.5);

                this.uiObjects.push(box, label);
                rowCells.push({ box, label });
            }
            this.boardCells.push(rowCells);
        }
    }

    private buildVirtualKeyboard(): void {
        if (!this.layout) {
            return;
        }

        this.clearKeyboardUi();
        this.keyBoxes.clear();

        const grid = this.layout.keyboardDock === 'right'
            ? [
                ['1', '2'],
                ['3', '4'],
                ['5', '6'],
                ['7', '8'],
                ['9', '0'],
                ['backspace', 'enter']
            ]
            : [
                ['1', '2', '3', '4'],
                ['5', '6', '7', '8'],
                ['9', '0', 'backspace', 'enter']
            ];

        for (let row = 0; row < this.layout.keyboardRows; row += 1) {
            for (let col = 0; col < this.layout.keyboardCols; col += 1) {
                const token = grid[row][col];
                const label = token === 'backspace' ? '⌫' : (token === 'enter' ? '⏎' : token);
                const x = this.layout.keyboardStartX + col * (this.layout.keyboardButtonWidth + this.layout.keyboardGap);
                const y = this.layout.keyboardStartY + row * (this.layout.keyboardButtonHeight + this.layout.keyboardGap);

                const { box } = createButton(
                    this,
                    x,
                    y,
                    this.layout.keyboardButtonWidth,
                    this.layout.keyboardButtonHeight,
                    label,
                    () => this.onVirtualKey(token),
                    this.keyboardObjects
                );

                if (/^\d$/.test(token)) {
                    this.keyBoxes.set(token, box);
                }
            }
        }
    }

    private handleToken(token: string): void {
        if (!this.round || this.phase !== 'playing') {
            return;
        }

        if (token === 'backspace') {
            if (this.currentGuess.length > 0) {
                this.currentGuess = this.currentGuess.slice(0, -1);
                this.refreshBoardOnly();
            }
            return;
        }

        if (token === 'enter') {
            this.submitGuess();
            return;
        }

        if (!/^\d$/.test(token)) {
            return;
        }

        if (this.currentGuess.length >= this.round.n) {
            return;
        }

        if (this.currentGuess.length === 0 && token === '0') {
            return;
        }

        this.currentGuess += token;
        this.refreshBoardOnly();
    }

    private submitGuess(): void {
        if (!this.round) {
            return;
        }

        const result = applyGuess(this.round, this.currentGuess);
        if (!result.accepted) {
            this.showToast(this.localizeValidationMessage(result.message ?? this.t('checkInput')));
            return;
        }

        this.hideToast();

        this.round = result.round;
        this.currentGuess = '';
        if (result.colors) {
            this.updateKeyStatus(result.round.history[result.round.history.length - 1].guess, result.colors);
        }

        if (this.round.status === 'won') {
            this.phase = 'won';
            this.showEndUi(this.t('clear'));
        } else if (this.round.status === 'lost') {
            this.phase = 'lost';
            this.showEndUi(this.t('gameOver'));
        }

        this.refreshUi();
    }

    private showEndUi(statusMessage: string): void {
        this.clearEndUi();
        this.clearKeyboardUi();
        this.keyBoxes.clear();
        this.hideToast();

        const width = this.layout?.width ?? this.scale.gameSize.width;
        const height = this.layout?.height ?? this.scale.gameSize.height;
        const centerX = this.layout?.boardCenterX ?? width / 2;

        createText(this, centerX, 52, statusMessage, 22, '#f8fafc', 0.5, this.endUiObjects);
        if (this.phase === 'lost' && this.round) {
            createText(this, centerX, 82, this.formatAnswerReveal(this.round.answer), 18, '#fca5a5', 0.5, this.endUiObjects);
        }

        this.endClickOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.001)
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.beginNextRoundFromTrigger();
            });

        const buttonWidth = 240;
        const buttonHeight = 44;
        const buttonX = (width - buttonWidth) / 2;
        const buttonY = height - 70;

        createButton(
            this,
            buttonX,
            buttonY,
            buttonWidth,
            buttonHeight,
            this.t('reselectDigits'),
            () => this.goToTitle(),
            this.endUiObjects
        );
    }

    private formatAnswerReveal(answer: string): string {
        if (this.locale === 'ja') {
            return `正解: ${answer}`;
        }
        return `Answer: ${answer}`;
    }

    private t(key: TextKey): string {
        return translate(this.locale, key);
    }

    private localizeValidationMessage(message: string): string {
        if (this.locale === 'ja') {
            return message;
        }

        const lengthPrefix = 'N桁の数字を入力してください';
        const primePrefix = '素数を入力してください';
        const hardGreen = 'ハードモード: 確定した位置の数字を変えられません';
        const hardYellow = 'ハードモード: 判明した数字を必ず含めてください';

        if (message.startsWith(lengthPrefix)) {
            const digits = this.round?.n;
            return digits ? `Enter a ${digits}-digit number` : 'Enter the required number of digits';
        }

        if (message.startsWith(primePrefix)) {
            const suffix = message.slice(primePrefix.length).trim();
            return suffix ? `Enter a prime number ${suffix}` : 'Enter a prime number';
        }

        if (message === hardGreen) {
            return 'Hard mode: confirmed digits must stay in place';
        }

        if (message === hardYellow) {
            return 'Hard mode: must include all revealed digits';
        }

        return message;
    }

    private updateKeyStatus(guess: string, colors: DigitStatus[]): void {
        for (let i = 0; i < guess.length; i += 1) {
            const digit = guess[i];
            const next = colors[i];
            const current = this.keyStatus.get(digit);
            if (!current || KEY_PRIORITY[next] > KEY_PRIORITY[current]) {
                this.keyStatus.set(digit, next);
            }
        }

        for (const [digit, status] of this.keyStatus.entries()) {
            const box = this.keyBoxes.get(digit);
            if (box) {
                box.setFillStyle(COLORS[status]);
            }
        }
    }

    private refreshUi(): void {
        if (!this.round) {
            return;
        }

        if (import.meta.env.DEV) {
            // QA only: a read-only view of the round (never part of the production bundle).
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Game',
                phase: this.phase,
                digits: this.round.n,
                mode: this.round.mode,
                attemptsUsed: this.round.attemptsUsed,
                attemptLimit: this.round.attemptLimit
            };
        }

        this.refreshBoardOnly();
    }

    private refreshBoardOnly(): void {
        if (!this.round) {
            return;
        }

        for (let row = 0; row < this.boardCells.length; row += 1) {
            const history = this.round.history[row];

            for (let col = 0; col < this.boardCells[row].length; col += 1) {
                const cell = this.boardCells[row][col];

                if (history) {
                    const digit = history.guess[col] ?? '';
                    const color = history.colors[col] ?? 'gray';
                    cell.label.setText(digit);
                    cell.box.setFillStyle(COLORS[color]);
                    continue;
                }

                if (row === this.round.attemptsUsed) {
                    const digit = this.currentGuess[col] ?? '';
                    cell.label.setText(digit);
                } else {
                    cell.label.setText('');
                }

                cell.box.setFillStyle(CELL_FILL);
            }
        }
    }

    private cleanupMainUi(): void {
        for (const obj of this.uiObjects) {
            obj.destroy();
        }
        this.uiObjects = [];
        this.clearKeyboardUi();
        this.boardCells = [];
        this.keyBoxes.clear();
        this.toastText = null;
        this.toastBg = null;
        this.hideToast();
        this.layout = null;
    }

    private clearKeyboardUi(): void {
        for (const obj of this.keyboardObjects) {
            obj.destroy();
        }
        this.keyboardObjects = [];
    }

    private clearEndUi(): void {
        if (this.endClickOverlay) {
            this.endClickOverlay.destroy();
            this.endClickOverlay = null;
        }

        for (const obj of this.endUiObjects) {
            obj.destroy();
        }
        this.endUiObjects = [];
    }
}
