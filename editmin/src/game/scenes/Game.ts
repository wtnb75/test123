import { Scene } from 'phaser';
import {
    evaluateDifficulty,
    getNeighbors as neighborsOf,
    type BoardCell,
    type BoardState,
    type DifficultyEvaluation
} from '../logic/evaluateDifficulty';
import {
    ZOOM_DEFAULT,
    anchoredScroll,
    fitZoom,
    isCompact,
    maxScroll,
    nextZoom,
    wheelDirection,
    wheelMayZoom,
    zoomKeyAction,
    type ZoomAction
} from '../logic/zoom';
import { openCell, playCellView, startPlay, toggleFlag, type PlayState } from '../logic/play';
import {
    DISPLAY_MODE_DEFAULT,
    displayModeButtonLabel,
    isDisplayModeKey,
    isPaleCell,
    nextDisplayMode,
    paintMines,
    showMineLabel,
    showNumbers,
    type DisplayMode,
    type PaleCellState
} from '../logic/displayMode';

const MIN_SIZE = 2;
const MAX_SIZE = 50;

/** Whether the key event comes from a text field (the W and H inputs), where the shortcuts must not act. */
const isTypingInInput = (event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement | null;
    return target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
};

type UiRefs = {
    root: HTMLDivElement;
    boardGrid: HTMLDivElement;
    boardScroll: HTMLDivElement;
    widthInput: HTMLInputElement;
    heightInput: HTMLInputElement;
    applySizeBtn: HTMLButtonElement;
    startBtn: HTMLButtonElement;
    copyBtn: HTMLButtonElement;
    playToggleBtn: HTMLButtonElement;
    playHint: HTMLDivElement;
    zoomOutBtn: HTMLButtonElement;
    zoomInBtn: HTMLButtonElement;
    zoomFitBtn: HTMLButtonElement;
    zoomLabel: HTMLSpanElement;
    displayModeBtn: HTMLButtonElement;
    status: HTMLDivElement;
    playStatus: HTMLDivElement;
    rank: HTMLDivElement;
    evidence: HTMLDivElement;
    logical: HTMLDivElement;
};

export class Game extends Scene {
    private widthCells = 12;
    private heightCells = 12;
    private cells: BoardCell[] = [];
    private startIndex: number | null = null;
    private startMode = false;
    private cellSize = ZOOM_DEFAULT;
    private lastWheelZoomAt: number | null = null;
    private displayMode: DisplayMode = DISPLAY_MODE_DEFAULT;
    /** The play of docs/spec/play-test.md; null while editing. Never saved. */
    private play: PlayState | null = null;
    private ui?: UiRefs;

    constructor() {
        super('Game');
    }

    create() {
        this.cells = this.createCells(this.widthCells * this.heightCells);
        // A restart starts editing again, with no play and no start cell.
        this.play = null;
        this.startIndex = null;
        this.startMode = false;
        this.cameras.main.setBackgroundColor(0xf4f1e8);

        const el = this.add.dom(0, 0).createFromHTML(this.buildUiHtml()) as Phaser.GameObjects.DOMElement;
        el.setOrigin(0, 0);
        el.setDepth(10);

        const root = el.node as HTMLDivElement;
        this.ui = {
            root,
            boardGrid: root.querySelector('[data-role="board-grid"]') as HTMLDivElement,
            boardScroll: root.querySelector('[data-role="board-scroll"]') as HTMLDivElement,
            widthInput: root.querySelector('[data-role="width"]') as HTMLInputElement,
            heightInput: root.querySelector('[data-role="height"]') as HTMLInputElement,
            applySizeBtn: root.querySelector('[data-role="apply-size"]') as HTMLButtonElement,
            startBtn: root.querySelector('[data-role="start-mode"]') as HTMLButtonElement,
            copyBtn: root.querySelector('[data-role="copy-board"]') as HTMLButtonElement,
            playToggleBtn: root.querySelector('[data-role="play-toggle"]') as HTMLButtonElement,
            playHint: root.querySelector('[data-role="play-hint"]') as HTMLDivElement,
            zoomOutBtn: root.querySelector('[data-role="zoom-out"]') as HTMLButtonElement,
            zoomInBtn: root.querySelector('[data-role="zoom-in"]') as HTMLButtonElement,
            zoomFitBtn: root.querySelector('[data-role="zoom-fit"]') as HTMLButtonElement,
            zoomLabel: root.querySelector('[data-role="zoom-label"]') as HTMLSpanElement,
            displayModeBtn: root.querySelector('[data-role="display-mode"]') as HTMLButtonElement,
            status: root.querySelector('[data-role="status"]') as HTMLDivElement,
            playStatus: root.querySelector('[data-role="play-status"]') as HTMLDivElement,
            rank: root.querySelector('[data-role="rank"]') as HTMLDivElement,
            evidence: root.querySelector('[data-role="evidence"]') as HTMLDivElement,
            logical: root.querySelector('[data-role="logical"]') as HTMLDivElement
        };

        this.bindUiEvents();
        this.onResize();
        this.renderAll();

        this.scale.on('resize', this.onResize, this);
        this.events.once('shutdown', this.removeInputListeners, this);
    }

    private buildUiHtml(): string {
        return `
        <div class="editmin-root" data-role="root">
          <div class="editmin-board-scroll" data-role="board-scroll">
            <div class="editmin-board-grid" data-role="board-grid"></div>
          </div>
          <div class="editmin-sidebar">
            <h1>Editmin</h1>
            <div class="editmin-row">
              <label>W</label>
              <input data-role="width" type="number" min="2" max="50" value="12" />
              <label>H</label>
              <input data-role="height" type="number" min="2" max="50" value="12" />
              <button data-role="apply-size">反映</button>
            </div>
            <div class="editmin-row">
              <button data-role="start-mode">開始マスを指定</button>
                            <button data-role="copy-board">盤面テキストをコピー</button>
            </div>
            <div class="editmin-row">
              <button data-role="play-toggle">プレイ</button>
            </div>
            <div class="editmin-play-hint" data-role="play-hint">開始マスを指定するとプレイできます</div>
            <div class="editmin-row editmin-zoom-row">
              <button data-role="zoom-out" aria-label="縮小">−</button>
              <span class="editmin-zoom-label" data-role="zoom-label">表示 ${this.cellSize}px</span>
              <button data-role="zoom-in" aria-label="拡大">＋</button>
              <button data-role="zoom-fit">フィット</button>
            </div>
            <div class="editmin-row">
              <button data-role="display-mode">${displayModeButtonLabel(DISPLAY_MODE_DEFAULT)}</button>
            </div>
            <div class="editmin-status" data-role="status"></div>
            <hr />
            <div class="editmin-play-status" data-role="play-status"></div>
            <div class="editmin-metric" data-role="rank">ランク: 未評価</div>
            <div class="editmin-metric" data-role="logical">論理解法可否: 未評価</div>
            <div class="editmin-metric" data-role="evidence">根拠値: 未評価</div>
            <p class="editmin-help">左クリック: 爆弾トグル / 開始マス指定モード中は開始マス設定<br />ズーム: + / − / 0（フィット）、Ctrl（⌘）+ホイール<br />表示モード: 「表示」ボタン、またはキー M（絵 → 数字 → 両方 → 絵）<br />プレイ: 左クリックで開く・右クリックで旗（数字と旗はマスが 20 px 以上のときに出ます）</p>
          </div>
        </div>`;
    }

    private bindUiEvents(): void {
        if (!this.ui) {
            return;
        }

        this.ui.applySizeBtn.addEventListener('click', () => {
            const w = Number(this.ui?.widthInput.value ?? this.widthCells);
            const h = Number(this.ui?.heightInput.value ?? this.heightCells);
            const nextW = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number.isFinite(w) ? Math.floor(w) : this.widthCells));
            const nextH = Math.max(MIN_SIZE, Math.min(MAX_SIZE, Number.isFinite(h) ? Math.floor(h) : this.heightCells));
            this.widthCells = nextW;
            this.heightCells = nextH;
            this.cells = this.createCells(nextW * nextH);
            this.startIndex = null;
            this.startMode = false;
            this.setStatus(`盤面サイズを ${nextW}x${nextH} に変更しました。`);
            this.renderAll();
        });

        this.ui.startBtn.addEventListener('click', () => {
            this.startMode = !this.startMode;
            this.ui!.startBtn.classList.toggle('active', this.startMode);
            this.setStatus(this.startMode ? '開始マスをクリックしてください。' : '開始マス指定モードを終了しました。');
        });

        this.ui.zoomOutBtn.addEventListener('click', () => this.applyZoomAction('out'));
        this.ui.zoomInBtn.addEventListener('click', () => this.applyZoomAction('in'));
        this.ui.zoomFitBtn.addEventListener('click', () => this.applyZoomAction('fit'));
        this.ui.displayModeBtn.addEventListener('click', () => this.cycleDisplayMode());
        window.addEventListener('keydown', this.onZoomKey);
        window.addEventListener('keydown', this.onDisplayKey);
        // Not passive: Ctrl+wheel over the board must not trigger the browser's page zoom.
        this.ui.boardScroll.addEventListener('wheel', this.onBoardWheel, { passive: false });

        this.ui.copyBtn.addEventListener('click', async () => {
            const text = this.toBoardText();
            const copied = await this.copyTextToClipboard(text);
            this.setStatus(copied ? '盤面テキストをクリップボードにコピーしました。' : 'コピーに失敗しました。');
        });
        this.ui.playToggleBtn.addEventListener('click', () => this.togglePlay());
        // A right click on the board opens no menu while the play is on (a right click on a cell flags it).
        this.ui.boardGrid.addEventListener('contextmenu', this.onBoardContextMenu);
    }

    private removeInputListeners(): void {
        window.removeEventListener('keydown', this.onZoomKey);
        window.removeEventListener('keydown', this.onDisplayKey);
        this.ui?.boardScroll.removeEventListener('wheel', this.onBoardWheel);
        this.ui?.boardGrid.removeEventListener('contextmenu', this.onBoardContextMenu);
        this.scale.off('resize', this.onResize, this);
    }

    private readonly onBoardContextMenu = (event: MouseEvent): void => {
        if (this.play !== null) {
            event.preventDefault();
        }
    };

    private readonly onDisplayKey = (event: KeyboardEvent): void => {
        if (isDisplayModeKey(event, isTypingInInput(event))) {
            this.cycleDisplayMode();
        }
    };

    private readonly onZoomKey = (event: KeyboardEvent): void => {
        const action = zoomKeyAction(event, isTypingInInput(event));
        if (action !== null) {
            event.preventDefault();
            this.applyZoomAction(action);
        }
    };

    private readonly onBoardWheel = (event: WheelEvent): void => {
        if (!event.ctrlKey && !event.metaKey) {
            return; // a plain wheel scrolls as usual
        }
        event.preventDefault();
        const direction = wheelDirection(event.deltaY);
        if (direction === 0 || !wheelMayZoom(event.timeStamp, this.lastWheelZoomAt) || !this.ui) {
            return;
        }
        const next = nextZoom(this.cellSize, direction);
        if (next === this.cellSize) {
            return;
        }
        const scroll = this.ui.boardScroll;
        const rect = scroll.getBoundingClientRect();
        this.setZoom(next, event.clientX - rect.left - scroll.clientLeft, event.clientY - rect.top - scroll.clientTop);
        this.lastWheelZoomAt = event.timeStamp;
    };

    /** Buttons and keys keep the centre of the board display area where it is. */
    private applyZoomAction(action: ZoomAction): void {
        if (!this.ui) {
            return;
        }
        const scroll = this.ui.boardScroll;
        const next =
            action === 'fit'
                ? fitZoom(this.widthCells, this.heightCells, scroll.clientWidth, scroll.clientHeight)
                : nextZoom(this.cellSize, action === 'in' ? 1 : -1);
        if (next !== this.cellSize) {
            this.setZoom(next, scroll.clientWidth / 2, scroll.clientHeight / 2);
        }
    }

    /** Changes the cell side only through CSS (no button is rebuilt) and keeps the board point under the anchor. */
    private setZoom(next: number, anchorX: number, anchorY: number): void {
        if (!this.ui) {
            return;
        }
        const old = this.cellSize;
        const scroll = this.ui.boardScroll;
        // Measure before the change: the browser clamps the scroll position as soon as the content shrinks.
        const { scrollLeft, scrollTop, clientWidth, clientHeight } = scroll;
        this.cellSize = next;
        this.applyCellSize();
        scroll.scrollLeft = anchoredScroll(
            scrollLeft, anchorX, old, next, maxScroll(this.widthCells, next, clientWidth)
        );
        scroll.scrollTop = anchoredScroll(
            scrollTop, anchorY, old, next, maxScroll(this.heightCells, next, clientHeight)
        );
    }

    private applyCellSize(): void {
        if (!this.ui) {
            return;
        }
        const grid = this.ui.boardGrid;
        grid.style.setProperty('--cell', `${this.cellSize}px`);
        grid.style.gridTemplateColumns = `repeat(${this.widthCells}, ${this.cellSize}px)`;
        grid.style.gridTemplateRows = `repeat(${this.heightCells}, ${this.cellSize}px)`;
        this.ui.zoomLabel.textContent = `表示 ${this.cellSize}px`;
        this.applyGridDisplayClasses();
    }

    /**
     * Digits, "B" and the mine paint follow the mode and the cell side, through classes only. During the play the
     * digits and "B" follow the cell side alone, and the paint is kept for the mines the play has revealed.
     */
    private applyGridDisplayClasses(): void {
        if (!this.ui) {
            return;
        }
        const grid = this.ui.boardGrid;
        if (this.play !== null) {
            grid.classList.toggle('hide-numbers', isCompact(this.cellSize));
            grid.classList.toggle('hide-mine-label', isCompact(this.cellSize));
            grid.classList.add('paint-mines');
        } else {
            grid.classList.toggle('hide-numbers', !showNumbers(this.displayMode, this.cellSize));
            grid.classList.toggle('hide-mine-label', !showMineLabel(this.displayMode, this.cellSize));
            grid.classList.toggle('paint-mines', paintMines(this.displayMode, this.cellSize));
        }
        this.ui.displayModeBtn.textContent = displayModeButtonLabel(this.displayMode);
    }

    /** 絵 → 数字 → 両方 → 絵. Only classes change; no cell button is rebuilt. Not during the play. */
    private cycleDisplayMode(): void {
        if (!this.ui || this.play !== null) {
            return;
        }
        this.displayMode = nextDisplayMode(this.displayMode);
        this.applyGridDisplayClasses();
        this.applyCellViews();
    }

    /** Sets each cell's text and classes from the mode (or the play) and the cell state. No button is created here. */
    private applyCellViews(): void {
        if (!this.ui) {
            return;
        }
        const board = this.play !== null ? this.toBoardState() : null;
        const forbidden = this.forbiddenCells();
        const buttons = this.ui.boardGrid.querySelectorAll<HTMLButtonElement>('.editmin-cell');
        buttons.forEach((button, i) => {
            const cell = this.cells[i];
            const isStart = this.startIndex === i;
            button.className = 'editmin-cell';
            button.classList.toggle('start', isStart);
            if (this.play !== null && board !== null) {
                this.applyPlayCellView(button, i, board, this.play, forbidden);
                return;
            }
            button.classList.toggle('forbidden', forbidden.has(i));
            button.classList.toggle('mine', cell.hasMine);
            button.classList.toggle('pale', isPaleCell(this.displayMode, this.cellState(i, forbidden)));
            if (cell.hasMine) {
                button.textContent = 'B';
                return;
            }
            const count = this.computeAdjacentMineCount(i);
            button.textContent = String(count);
            if (count >= 1 && count <= 8) {
                button.classList.add(`n${count}`);
            }
        });
    }

    /** A closed cell looks closed; an open one is pale (except the start) and shows its count; a revealed mine is dark. */
    private applyPlayCellView(
        button: HTMLButtonElement,
        index: number,
        board: BoardState,
        state: PlayState,
        forbidden: Set<number>
    ): void {
        const view = playCellView(board, state, index);
        const isMine = this.cells[index].hasMine;
        button.classList.toggle('forbidden', forbidden.has(index) && !view.opened);
        button.classList.toggle('pale', view.opened && !isMine && this.startIndex !== index);
        button.classList.toggle('mine', view.revealedMine);
        button.classList.toggle('flag', view.flagged);
        if (view.opened && !isMine && view.label !== '') {
            button.classList.add(`n${view.label}`);
        }
        button.textContent = view.label;
    }

    private forbiddenCells(): Set<number> {
        return this.startIndex === null ? new Set<number>() : this.getForbiddenSet(this.startIndex);
    }

    private cellState(index: number, forbidden: Set<number>): PaleCellState {
        return {
            hasMine: this.cells[index].hasMine,
            isStart: this.startIndex === index,
            isForbidden: forbidden.has(index)
        };
    }

    private toBoardText(): string {
        const lines: string[] = [];
        for (let y = 0; y < this.heightCells; y += 1) {
            const row: string[] = [];
            for (let x = 0; x < this.widthCells; x += 1) {
                const index = y * this.widthCells + x;
                if (this.startIndex === index) {
                    row.push('X');
                    continue;
                }
                if (this.cells[index].hasMine) {
                    row.push('B');
                    continue;
                }
                row.push(String(this.computeAdjacentMineCount(index)));
            }
            lines.push(row.join(' '));
        }
        return lines.join('\n');
    }

    private async copyTextToClipboard(text: string): Promise<boolean> {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch {
                // Fallback below for environments where clipboard API is blocked.
            }
        }

        if (typeof document === 'undefined') {
            return false;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            return document.execCommand('copy');
        } catch {
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }

    private onResize(): void {
        if (!this.ui) {
            return;
        }
        this.ui.root.style.width = `${this.scale.width}px`;
        this.ui.root.style.height = `${this.scale.height}px`;
    }

    private createCells(size: number): BoardCell[] {
        return Array.from({ length: size }, () => ({ hasMine: false }));
    }

    private getNeighbors(index: number): number[] {
        return neighborsOf(index, this.widthCells, this.heightCells);
    }

    private getForbiddenSet(startIndex: number): Set<number> {
        const zone = new Set<number>([startIndex]);
        for (const n of this.getNeighbors(startIndex)) {
            zone.add(n);
        }
        return zone;
    }

    private hasMineInZone(startIndex: number): boolean {
        const zone = this.getForbiddenSet(startIndex);
        for (const i of zone) {
            if (this.cells[i].hasMine) {
                return true;
            }
        }
        return false;
    }

    private computeAdjacentMineCount(index: number): number {
        return this.getNeighbors(index).reduce((sum, n) => sum + (this.cells[n].hasMine ? 1 : 0), 0);
    }

    private onCellClick(index: number, event: MouseEvent): void {
        if (this.play !== null) {
            // A keyboard "click" (Space or Enter on a focused cell) has detail 0: the play opens cells by mouse only.
            if (event.detail !== 0) {
                this.openPlayCell(index);
            }
            return;
        }

        if (this.startMode) {
            if (this.hasMineInZone(index)) {
                this.setStatus('開始マス周囲に爆弾があるため、開始マス設定を拒否しました。');
                return;
            }
            this.startIndex = index;
            this.startMode = false;
            if (this.ui) {
                this.ui.startBtn.classList.remove('active');
            }
            this.setStatus('開始マスを設定しました。');
            this.renderAll();
            return;
        }

        if (this.startIndex !== null && this.getForbiddenSet(this.startIndex).has(index)) {
            this.setStatus('開始マス制約: このセルには爆弾を置けません。');
            return;
        }

        this.cells[index].hasMine = !this.cells[index].hasMine;
        this.renderAll();
    }

    private toBoardState(): BoardState | null {
        if (this.startIndex === null) {
            return null;
        }
        return {
            width: this.widthCells,
            height: this.heightCells,
            startIndex: this.startIndex,
            cells: this.cells.map((c) => ({ hasMine: c.hasMine }))
        };
    }

    private updateAnalysis(): void {
        if (!this.ui) {
            return;
        }

        const board = this.toBoardState();
        if (!board) {
            this.ui.rank.textContent = 'ランク: 未評価';
            this.ui.logical.textContent = '論理解法可否: 未評価';
            this.ui.evidence.textContent = '根拠値: 未評価';
            return;
        }

        const result = evaluateDifficulty({ board });
        if (!result.ok) {
            this.ui.rank.textContent = 'ランク: エラー';
            this.ui.logical.textContent = '論理解法可否: エラー';
            this.ui.evidence.textContent = `根拠値: ${result.code}`;
            this.setStatus(`評価エラー: ${result.message}`);
            return;
        }

        this.writeMetrics(result.value);
    }

    private writeMetrics(value: DifficultyEvaluation): void {
        if (!this.ui) {
            return;
        }
        this.ui.rank.textContent = `ランク: ${value.rank} (D=${value.evidence.D})`;
        this.ui.logical.textContent = `論理解法可否: ${value.logicallySolvable ? 'True' : 'False'}`;
        this.ui.evidence.textContent = `根拠値: B=${value.evidence.B}, A=${value.evidence.A}, C=${value.evidence.C}, U=${value.evidence.U.toFixed(3)}, requires-guess=${value.evidence.requiresGuess}`;
    }

    private setStatus(message: string): void {
        if (this.ui) {
            this.ui.status.textContent = message;
        }
    }

    private renderBoard(): void {
        if (!this.ui) {
            return;
        }

        const grid = this.ui.boardGrid;
        grid.innerHTML = '';
        this.applyCellSize();

        for (let i = 0; i < this.cells.length; i += 1) {
            const cellBtn = document.createElement('button');
            cellBtn.className = 'editmin-cell';
            cellBtn.addEventListener('click', (event) => this.onCellClick(i, event));
            cellBtn.addEventListener('contextmenu', () => this.toggleFlagAt(i));
            grid.appendChild(cellBtn);
        }
        this.applyCellViews();
    }

    private renderAll(): void {
        this.renderBoard();
        this.updateAnalysis();
        this.updatePlayUi();
    }

    /** Starts the play from the start cell, or goes back to editing. Neither rebuilds a cell button. */
    private togglePlay(): void {
        if (!this.ui) {
            return;
        }
        if (this.play !== null) {
            this.play = null;
        } else {
            const result = startPlay(this.toBoardState());
            if (!result.ok) {
                return;
            }
            this.play = result.state;
            this.startMode = false;
            this.ui.startBtn.classList.remove('active');
        }
        this.setStatus('');
        this.updatePlayUi();
    }

    /** A right click during the play puts a flag on a closed cell, or takes it off. The menu is blocked by the grid. */
    private toggleFlagAt(index: number): void {
        if (this.play === null) {
            return;
        }
        const result = toggleFlag(this.play, index);
        if (result.ok) {
            this.play = result.state;
        }
        this.updatePlayUi();
    }

    private openPlayCell(index: number): void {
        const board = this.toBoardState();
        if (!board || this.play === null) {
            return;
        }
        const result = openCell(board, this.play, index);
        if (result.ok) {
            this.play = result.state;
        }
        this.updatePlayUi();
    }

    /** The play's buttons, state line, and what is locked during the play; the cells follow the play state. */
    private updatePlayUi(): void {
        if (!this.ui) {
            return;
        }
        const playing = this.play !== null;
        const hasStart = this.startIndex !== null;
        this.ui.playToggleBtn.textContent = playing ? '編集に戻る' : 'プレイ';
        this.ui.playToggleBtn.disabled = !playing && !hasStart;
        this.ui.playHint.hidden = playing || hasStart;
        for (const el of [this.ui.applySizeBtn, this.ui.startBtn, this.ui.widthInput, this.ui.heightInput, this.ui.displayModeBtn]) {
            el.disabled = playing;
        }
        this.ui.playStatus.textContent = this.playStatusText();
        this.applyGridDisplayClasses();
        this.applyCellViews();
    }

    private playStatusText(): string {
        if (this.play === null) {
            return '';
        }
        switch (this.play.status) {
            case 'exploded':
                return '爆死。爆弾を見せています';
            case 'cleared':
                return 'クリア';
            default:
                return 'プレイ中';
        }
    }
}
