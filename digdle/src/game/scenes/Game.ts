import { Scene, type GameObjects } from 'phaser';
import { applyGuess, createGame } from '../logic/game';
import type { DigitStatus, RoundState } from '../types';

type UiPhase = 'select' | 'playing' | 'won' | 'lost';

interface BoardCell {
    box: GameObjects.Rectangle;
    label: GameObjects.Text;
}

interface LayoutMetrics {
    width: number;
    height: number;
    keyboardDock: 'right' | 'bottom';
    leftTitleX: number;
    leftTitleY: number;
    boardCenterX: number;
    boardStartX: number;
    boardStartY: number;
    boardWidth: number;
    boardHeight: number;
    boardGap: number;
    boardCellSize: number;
    keyboardStartX: number;
    keyboardStartY: number;
    keyboardCols: number;
    keyboardRows: number;
    keyboardButtonHeight: number;
    keyboardButtonWidth: number;
    keyboardGap: number;
}

const COLORS: Record<DigitStatus, number> = {
    green: 0x16a34a,
    yellow: 0xf59e0b,
    gray: 0x6b7280
};

const KEY_PRIORITY: Record<DigitStatus, number> = {
    gray: 1,
    yellow: 2,
    green: 3
};

export class Game extends Scene {
    private phase: UiPhase = 'select';
    private gameApi = createGame();
    private round: RoundState | null = null;
    private currentGuess = '';
    private uiObjects: GameObjects.GameObject[] = [];
    private endUiObjects: GameObjects.GameObject[] = [];
    private boardCells: BoardCell[][] = [];
    private messageText: GameObjects.Text | null = null;
    private keyBoxes = new Map<string, GameObjects.Rectangle>();
    private keyStatus = new Map<string, DigitStatus>();
    private keyboardObjects: GameObjects.GameObject[] = [];
    private layout: LayoutMetrics | null = null;
    private endClickOverlay: GameObjects.Rectangle | null = null;

    constructor() {
        super('Game');
    }

    create(): void {
        this.cameras.main.setBackgroundColor(0x111827);

        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            this.onPhysicalKey(event.key);
        });

        this.scale.on('resize', () => {
            this.relayoutCurrentPhase();
        });

        this.events.once('shutdown', () => {
            this.scale.off('resize');
        });

        this.showSelectScreen();
    }

    private onPhysicalKey(key: string): void {
        if (this.phase === 'won' || this.phase === 'lost') {
            this.beginNextRoundFromTrigger();
            return;
        }

        if (this.phase === 'select') {
            if (key === '2' || key === '3' || key === '4' || key === '5') {
                this.startRound(Number(key));
            }
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

    private showSelectScreen(): void {
        this.cleanupMainUi();
        this.clearEndUi();
        this.phase = 'select';
        this.round = null;
        this.currentGuess = '';

        this.buildTopIcons(false);

        const width = this.scale.gameSize.width;
        const height = this.scale.gameSize.height;

        const titleY = Math.max(72, Math.floor(height * 0.15));
        const subtitleY = titleY + 58;
        const hintY = subtitleY + 42;

        this.createText(width / 2, titleY, 'digdle', 54, '#f9fafb', 0.5, this.uiObjects);
        this.createText(width / 2, subtitleY, 'N桁の素数を当てよう', 26, '#cbd5e1', 0.5, this.uiObjects);
        this.createText(width / 2, hintY, '2 / 3 / 4 / 5 を選択', 22, '#94a3b8', 0.5, this.uiObjects);

        const options = [2, 3, 4, 5];
        const narrow = width < 560;
        const buttonWidth = narrow ? 110 : 120;
        const buttonHeight = 64;
        const buttonGap = 20;
        const rowTop = hintY + 52;

        if (!narrow) {
            const rowWidth = options.length * buttonWidth + (options.length - 1) * buttonGap;
            const startX = (width - rowWidth) / 2;

            for (let i = 0; i < options.length; i += 1) {
                const value = options[i];
                const x = startX + i * (buttonWidth + buttonGap);
                this.createButton(
                    x,
                    rowTop,
                    buttonWidth,
                    buttonHeight,
                    String(value),
                    () => this.startRound(value),
                    this.uiObjects
                );
            }
            return;
        }

        const cols = 2;
        const gridWidth = cols * buttonWidth + (cols - 1) * buttonGap;
        const startX = (width - gridWidth) / 2;
        for (let i = 0; i < options.length; i += 1) {
            const value = options[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (buttonWidth + buttonGap);
            const y = rowTop + row * (buttonHeight + buttonGap);
            this.createButton(
                x,
                y,
                buttonWidth,
                buttonHeight,
                String(value),
                () => this.startRound(value),
                this.uiObjects
            );
        }
    }

    private relayoutCurrentPhase(): void {
        if (this.phase === 'select') {
            this.showSelectScreen();
            return;
        }

        if (!this.round) {
            this.showSelectScreen();
            return;
        }

        this.cleanupMainUi();
        this.clearEndUi();
        this.buildPlayUi();
        this.refreshUi();

        if (this.phase === 'won') {
            this.showEndUi('勝利！ 任意のキーまたはボタンで次ゲームへ');
        } else if (this.phase === 'lost') {
            this.showEndUi(`敗北… 正解は ${this.round.answer}`);
        }
    }

    private startRound(digits: number, previousAnswer?: string): void {
        this.round = this.gameApi.createRound(digits, previousAnswer);
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
            this.showSelectScreen();
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

        this.layout = this.computeLayout(this.round.attemptLimit, this.round.n);
        this.buildVerticalTitle();
        this.buildTopIcons(true);
        this.messageText = this.createText(this.layout.boardCenterX, 28, '', 20, '#fca5a5', 0.5, this.uiObjects);

        this.buildBoard(this.round.attemptLimit, this.round.n);
        this.buildVirtualKeyboard();
    }

    private buildTopIcons(showReselect: boolean): void {
        const width = this.scale.gameSize.width;
        const iconSize = 28;
        const margin = 12;

        const home = this.add.text(margin, margin, '🏠', {
            fontFamily: 'sans-serif',
            fontSize: iconSize,
            color: '#f8fafc'
        }).setOrigin(0, 0);
        home.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            window.location.assign('../');
        });
        this.uiObjects.push(home);

        if (!showReselect) {
            return;
        }

        const reselect = this.add.text(width - margin, margin, '🍥', {
            fontFamily: 'sans-serif',
            fontSize: iconSize,
            color: '#f8fafc'
        }).setOrigin(1, 0);
        reselect.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            this.showSelectScreen();
        });
        this.uiObjects.push(reselect);
    }

    private buildVerticalTitle(): void {
        if (!this.layout) {
            return;
        }

        const title = this.add.text(this.layout.leftTitleX, this.layout.leftTitleY, 'd\ni\ng\nd\nl\ne', {
            fontFamily: 'sans-serif',
            fontSize: 34,
            color: '#f9fafb',
            align: 'center',
            lineSpacing: 2
        }).setOrigin(0.5);

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

        const labelSize = Math.max(20, Math.floor(cellSize * 0.5));

        for (let row = 0; row < rows; row += 1) {
            const rowCells: BoardCell[] = [];
            for (let col = 0; col < cols; col += 1) {
                const x = startX + col * (cellSize + gap);
                const y = startY + row * (cellSize + gap);

                const box = this.add.rectangle(x, y, cellSize, cellSize, 0x1f2937)
                    .setOrigin(0, 0)
                    .setStrokeStyle(2, 0x4b5563);
                const label = this.add.text(x + cellSize / 2, y + cellSize / 2, '', {
                    fontFamily: 'monospace',
                    fontSize: labelSize,
                    color: '#ffffff'
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
                const label = token === 'backspace' ? '削除' : (token === 'enter' ? '確定' : token);
                const x = this.layout.keyboardStartX + col * (this.layout.keyboardButtonWidth + this.layout.keyboardGap);
                const y = this.layout.keyboardStartY + row * (this.layout.keyboardButtonHeight + this.layout.keyboardGap);

                const { box } = this.createButton(
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
            if (this.messageText) {
                this.messageText.setText(result.message ?? '入力を確認してください');
            }
            return;
        }

        this.round = result.round;
        this.currentGuess = '';
        if (result.colors) {
            this.updateKeyStatus(result.round.history[result.round.history.length - 1].guess, result.colors);
        }

        if (this.round.status === 'won') {
            this.phase = 'won';
            this.showEndUi('勝利！ 任意のキーまたはボタンで次ゲームへ');
        } else if (this.round.status === 'lost') {
            this.phase = 'lost';
            this.showEndUi(`敗北… 正解は ${this.round.answer}`);
        }

        this.refreshUi();
    }

    private showEndUi(statusMessage: string): void {
        this.clearEndUi();
        this.clearKeyboardUi();
        this.keyBoxes.clear();

        if (this.messageText) {
            this.messageText.setText(statusMessage);
            this.messageText.setColor('#f8fafc');
        }

        const width = this.layout?.width ?? this.scale.gameSize.width;
        const height = this.layout?.height ?? this.scale.gameSize.height;

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

        this.createButton(
            buttonX,
            buttonY,
            buttonWidth,
            buttonHeight,
            '桁数を選び直す',
            () => this.showSelectScreen(),
            this.endUiObjects
        );
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

        if (this.phase === 'playing') {
            this.messageText?.setText('');
            this.messageText?.setColor('#fca5a5');
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

                cell.box.setFillStyle(0x1f2937);
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
        this.messageText = null;
        this.layout = null;
    }

    private clearKeyboardUi(): void {
        for (const obj of this.keyboardObjects) {
            obj.destroy();
        }
        this.keyboardObjects = [];
    }

    private computeLayout(rows: number, cols: number): LayoutMetrics {
        const width = this.scale.gameSize.width;
        const height = this.scale.gameSize.height;

        const outerMargin = Math.max(8, Math.min(14, Math.floor(width * 0.02)));
        const leftTitleWidth = Math.max(36, Math.min(62, Math.floor(width * 0.07)));
        const panelGap = Math.max(6, Math.min(12, Math.floor(width * 0.02)));

        const useBottomKeyboard = width < 760 || height > width;

        let keyboardDock: 'right' | 'bottom' = useBottomKeyboard ? 'bottom' : 'right';
        let keyboardCols = keyboardDock === 'right' ? 2 : 4;
        let keyboardRows = keyboardDock === 'right' ? 6 : 3;
        const keyboardGap = 8;

        const rightPanelWidth = keyboardDock === 'right'
            ? Math.max(140, Math.min(220, Math.floor(width * 0.20)))
            : 0;

        const keyboardButtonWidth = keyboardDock === 'right'
            ? Math.floor((rightPanelWidth - keyboardGap * (keyboardCols - 1)) / keyboardCols)
            : Math.max(52, Math.floor((width - (outerMargin * 2) - leftTitleWidth - panelGap - keyboardGap * (keyboardCols - 1)) / keyboardCols));

        const keyboardButtonHeight = keyboardDock === 'right'
            ? Math.max(36, Math.min(64, Math.floor((height - 120 - keyboardGap * (keyboardRows - 1)) / keyboardRows)))
            : Math.max(38, Math.min(54, Math.floor((height * 0.22 - keyboardGap * (keyboardRows - 1)) / keyboardRows)));

        const boardTop = 60;
        const bottomKeyboardHeight = keyboardDock === 'bottom'
            ? keyboardRows * keyboardButtonHeight + (keyboardRows - 1) * keyboardGap
            : 0;

        const boardBottom = keyboardDock === 'bottom'
            ? height - outerMargin - bottomKeyboardHeight - panelGap
            : height - outerMargin;
        const boardLeft = outerMargin + leftTitleWidth + panelGap;
        const boardRight = width - rightPanelWidth - panelGap - outerMargin;
        const boardHeightLimit = Math.max(120, boardBottom - boardTop);
        const boardWidthLimit = Math.max(120, boardRight - boardLeft);

        const boardGap = Math.max(4, Math.min(10, Math.floor(boardHeightLimit / (rows * 7))));
        const cellByHeight = Math.floor((boardHeightLimit - boardGap * (rows - 1)) / rows);
        const cellByWidth = Math.floor((boardWidthLimit - boardGap * (cols - 1)) / cols);
        const boardCellSize = Math.max(28, Math.min(92, cellByHeight, cellByWidth));

        const boardWidth = cols * boardCellSize + (cols - 1) * boardGap;
        const boardHeight = rows * boardCellSize + (rows - 1) * boardGap;
        const boardStartX = boardLeft + Math.max(0, Math.floor((boardWidthLimit - boardWidth) / 2));
        const boardStartY = boardTop + Math.max(0, Math.floor((boardHeightLimit - boardHeight) / 2));

        const keyboardHeight = keyboardRows * keyboardButtonHeight + (keyboardRows - 1) * keyboardGap;
        const keyboardWidth = keyboardCols * keyboardButtonWidth + (keyboardCols - 1) * keyboardGap;
        const keyboardStartX = keyboardDock === 'right'
            ? width - outerMargin - rightPanelWidth
            : width - outerMargin - keyboardWidth;
        const keyboardStartY = keyboardDock === 'right'
            ? Math.max(72, Math.floor((height - keyboardHeight) / 2))
            : height - outerMargin - keyboardHeight;

        return {
            width,
            height,
            keyboardDock,
            leftTitleX: outerMargin + Math.floor(leftTitleWidth / 2),
            leftTitleY: Math.floor(height / 2),
            boardCenterX: boardStartX + boardWidth / 2,
            boardStartX,
            boardStartY,
            boardWidth,
            boardHeight,
            boardGap,
            boardCellSize,
            keyboardStartX,
            keyboardStartY,
            keyboardCols,
            keyboardRows,
            keyboardButtonHeight,
            keyboardButtonWidth,
            keyboardGap
        };
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

    private createText(
        x: number,
        y: number,
        text: string,
        fontSize: number,
        color: string,
        origin: number,
        store: GameObjects.GameObject[]
    ): GameObjects.Text {
        const obj = this.add.text(x, y, text, {
            fontFamily: 'sans-serif',
            fontSize,
            color
        }).setOrigin(origin, 0.5);
        store.push(obj);
        return obj;
    }

    private createButton(
        x: number,
        y: number,
        width: number,
        height: number,
        label: string,
        onClick: () => void,
        store: GameObjects.GameObject[]
    ): { box: GameObjects.Rectangle; text: GameObjects.Text } {
        const box = this.add.rectangle(x, y, width, height, 0x334155)
            .setOrigin(0, 0)
            .setStrokeStyle(2, 0x94a3b8);
        const text = this.add.text(x + width / 2, y + height / 2, label, {
            fontFamily: 'sans-serif',
            fontSize: 20,
            color: '#f8fafc'
        }).setOrigin(0.5);

        box.setInteractive({ useHandCursor: true }).on('pointerdown', () => onClick());
        text.setInteractive({ useHandCursor: true }).on('pointerdown', () => onClick());

        store.push(box, text);
        return { box, text };
    }
}
