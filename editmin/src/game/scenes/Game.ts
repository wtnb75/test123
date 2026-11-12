import { Scene } from 'phaser';
import { canPlaceMine, canSetStart, forbiddenZone, toBoardText, type Grid } from '../logic/board';
import {
    evaluateDifficulty,
    getNeighbors,
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
import { adjacentMineCount, openCell, playCellView, startPlay, toggleFlag, type PlayState } from '../logic/play';
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
import {
    clampSize,
    clearMines,
    emptyHistory,
    hasAnyMine,
    historyButtonState,
    historyKeyAction,
    recordMove,
    redo,
    resizeSnapshot,
    undo,
    type BoardSnapshot,
    type History
} from '../logic/history';
import { beginStroke, paintModeAt, strokeLine, strokeStatus, strokeStatusText, visitCell, type Stroke } from '../logic/paint';

/** Whether the key event comes from a text field (the W and H inputs), where the shortcuts must not act. */
const isTypingInInput = (event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement | null;
    return target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
};

/** The drag edit in progress (docs/spec.md "ドラッグ編集"): the paint so far, the working mines, the board before it. */
type ActiveStroke = {
    paint: Stroke;
    mines: boolean[];
    before: BoardSnapshot;
    /** The cell the pointer was last over; the next line starts here. */
    last: number;
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
    undoBtn: HTMLButtonElement;
    redoBtn: HTMLButtonElement;
    clearBtn: HTMLButtonElement;
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
    /** The undo / redo history of docs/spec/undo-history.md. Never saved; empty after a restart. */
    private history: History = emptyHistory();
    /** The drag edit in progress; null otherwise. */
    private stroke: ActiveStroke | null = null;
    /** True from a stroke's press until the next press: the `click` that press ends with must not toggle again. */
    private suppressClick = false;
    private ui?: UiRefs;

    constructor() {
        super('Game');
    }

    create() {
        this.cells = this.createCells(this.widthCells * this.heightCells);
        // A restart starts editing again, with no play and no start cell.
        this.play = null;
        this.history = emptyHistory();
        this.stroke = null;
        this.suppressClick = false;
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
            undoBtn: root.querySelector('[data-role="undo"]') as HTMLButtonElement,
            redoBtn: root.querySelector('[data-role="redo"]') as HTMLButtonElement,
            clearBtn: root.querySelector('[data-role="clear-mines"]') as HTMLButtonElement,
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
            <div class="editmin-row editmin-history-row">
              <button data-role="undo" disabled>元に戻す</button>
              <button data-role="redo" disabled>やり直す</button>
              <button data-role="clear-mines" disabled>全消去</button>
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
            <p class="editmin-help">左クリック: 爆弾トグル / 開始マス指定モード中は開始マス設定<br />左ボタンを押したままなぞると、通ったマスにまとめて置く／消せます（最初に押したマスに爆弾が無ければ置く、あれば消す）<br />ズーム: + / − / 0（フィット）、Ctrl（⌘）+ホイール<br />表示モード: 「表示」ボタン、またはキー M（絵 → 数字 → 両方 → 絵）<br />元に戻す: Ctrl（⌘）+Z、やり直す: Ctrl（⌘）+Shift+Z / Ctrl+Y<br />プレイ: 左クリックで開く・右クリックで旗（数字と旗はマスが 20 px 以上のときに出ます）</p>
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
            const nextW = clampSize(w, this.widthCells);
            const nextH = clampSize(h, this.heightCells);
            const before = this.snapshot();
            const after = resizeSnapshot(before, nextW, nextH);
            this.commitMove(before, after);
            this.startMode = false;
            this.ui!.startBtn.classList.remove('active');
            const released = before.startIndex !== null && after.startIndex === null;
            this.setStatus(
                `盤面サイズを ${nextW}x${nextH} に変更しました。${released ? '開始マスは盤面の外になったため解除しました。' : ''}`
            );
            this.renderAll();
        });
        this.ui.undoBtn.addEventListener('click', () => this.stepHistory('undo'));
        this.ui.redoBtn.addEventListener('click', () => this.stepHistory('redo'));
        this.ui.clearBtn.addEventListener('click', () => this.clearAllMines());
        window.addEventListener('keydown', this.onHistoryKey);

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
            const text = toBoardText(this.grid(), this.startIndex);
            const copied = await this.copyTextToClipboard(text);
            this.setStatus(copied ? '盤面テキストをクリップボードにコピーしました。' : 'コピーに失敗しました。');
        });
        this.ui.playToggleBtn.addEventListener('click', () => this.togglePlay());
        // A right click on the board opens no menu while the play is on (a right click on a cell flags it).
        this.ui.boardGrid.addEventListener('contextmenu', this.onBoardContextMenu);
        this.ui.boardGrid.addEventListener('pointerdown', this.onBoardPointerDown);
    }

    private removeInputListeners(): void {
        this.removeStrokeListeners();
        this.ui?.boardGrid.removeEventListener('pointerdown', this.onBoardPointerDown);
        window.removeEventListener('keydown', this.onZoomKey);
        window.removeEventListener('keydown', this.onDisplayKey);
        window.removeEventListener('keydown', this.onHistoryKey);
        this.ui?.boardScroll.removeEventListener('wheel', this.onBoardWheel);
        this.ui?.boardGrid.removeEventListener('contextmenu', this.onBoardContextMenu);
        this.scale.off('resize', this.onResize, this);
    }

    private readonly onBoardContextMenu = (event: MouseEvent): void => {
        // No menu during the play, nor in the middle of a drag edit (the menu would swallow the left button's release).
        if (this.play !== null || this.stroke !== null) {
            event.preventDefault();
        }
    };

    /** The cell index of a board button (or of something inside one); null for anything else. */
    private cellIndexOf(target: EventTarget | null): number | null {
        const button = (target as Element | null)?.closest?.('.editmin-cell') as HTMLElement | null | undefined;
        return button?.dataset.index === undefined ? null : Number(button.dataset.index);
    }

    /** A left mouse press on a cell starts a drag edit (edit mode only); every press ends the previous click suppression. */
    private readonly onBoardPointerDown = (event: PointerEvent): void => {
        if (this.stroke !== null) {
            return; // a press while a stroke runs does nothing
        }
        this.suppressClick = false;
        const index = this.cellIndexOf(event.target);
        // Ctrl + press is a right click on macOS, so it never starts a stroke.
        if (event.pointerType !== 'mouse' || event.button !== 0 || event.ctrlKey || this.play !== null || this.startMode || index === null) {
            return;
        }
        event.preventDefault();
        this.suppressClick = true;
        const mines = this.cells.map((c) => c.hasMine);
        this.stroke = { paint: beginStroke(paintModeAt(mines, index)), mines, before: this.snapshot(), last: index };
        window.addEventListener('pointermove', this.onStrokeMove);
        window.addEventListener('pointerup', this.onStrokeEnd);
        window.addEventListener('pointercancel', this.onStrokeEnd);
        window.addEventListener('mousedown', this.onStrokeMouseDown);
        this.passCells([index]);
    };

    /** Another button pressed while the left one is held does nothing (a middle press must not start the browser's auto-scroll). */
    private readonly onStrokeMouseDown = (event: MouseEvent): void => {
        if (event.button !== 0) {
            event.preventDefault();
        }
    };

    private readonly onStrokeMove = (event: PointerEvent): void => {
        const stroke = this.stroke;
        if (stroke === null) {
            return;
        }
        if ((event.buttons & 1) === 0) {
            this.endStroke(); // the release was missed
            return;
        }
        const index = this.cellIndexOf(document.elementFromPoint(event.clientX, event.clientY));
        if (index === null || index === stroke.last) {
            return;
        }
        const line = strokeLine(stroke.last, index, this.widthCells);
        stroke.last = index;
        this.passCells(line);
    };

    private readonly onStrokeEnd = (): void => this.endStroke();

    private removeStrokeListeners(): void {
        window.removeEventListener('pointermove', this.onStrokeMove);
        window.removeEventListener('pointerup', this.onStrokeEnd);
        window.removeEventListener('pointercancel', this.onStrokeEnd);
        window.removeEventListener('mousedown', this.onStrokeMouseDown);
    }

    /**
     * Applies the stroke's mode to the cells and redraws the changed cells and their neighbours (the numbers) in
     * place: no button is rebuilt, no analysis yet.
     */
    private passCells(indices: number[]): void {
        const stroke = this.stroke;
        if (stroke === null) {
            return;
        }
        const touched = new Set<number>();
        for (const index of indices) {
            const result = visitCell(stroke.paint, stroke.mines, index, canPlaceMine(this.grid(), this.startIndex, index));
            stroke.paint = result.stroke;
            stroke.mines = result.mines;
            if (result.outcome === 'changed') {
                this.cells[index].hasMine = result.mines[index];
                touched.add(index);
                getNeighbors(index, this.widthCells, this.heightCells).forEach((n) => touched.add(n));
            }
        }
        if (touched.size > 0) {
            this.applyCellViews(touched);
        }
    }

    /** Ends the drag edit: one history move, the status line, and one redraw with the analysis. */
    private endStroke(): void {
        const stroke = this.stroke;
        if (stroke === null) {
            return;
        }
        this.stroke = null;
        this.removeStrokeListeners();
        const text = strokeStatusText(strokeStatus(stroke.paint));
        if (text !== null) {
            this.setStatus(text);
        }
        this.commitMove(stroke.before, this.snapshot());
        this.renderAll();
    }

    private readonly onHistoryKey = (event: KeyboardEvent): void => {
        const action = historyKeyAction(event, isTypingInInput(event), this.play !== null || this.stroke !== null);
        if (action !== null) {
            event.preventDefault();
            this.stepHistory(action);
        }
    };

    /** The whole editable state, as the history keeps it. */
    private snapshot(): BoardSnapshot {
        return {
            width: this.widthCells,
            height: this.heightCells,
            mines: this.cells.map((c) => c.hasMine),
            startIndex: this.startIndex
        };
    }

    /** Makes `snapshot` the board (size, mines, start cell); zoom, scroll and mode stay. */
    private applySnapshot(snapshot: BoardSnapshot): void {
        this.widthCells = snapshot.width;
        this.heightCells = snapshot.height;
        this.cells = snapshot.mines.map((hasMine) => ({ hasMine }));
        this.startIndex = snapshot.startIndex;
    }

    /** Applies a move's result to the board and records it (a move that changes nothing is not recorded). */
    private commitMove(before: BoardSnapshot, after: BoardSnapshot): void {
        this.history = recordMove(this.history, before, after);
        this.applySnapshot(after);
    }

    private stepHistory(action: 'undo' | 'redo'): void {
        if (this.play !== null) {
            return;
        }
        const step = (action === 'undo' ? undo : redo)(this.history, this.snapshot());
        if (step === null) {
            return;
        }
        this.history = step.history;
        this.applySnapshot(step.snapshot);
        if (this.ui) {
            // The inputs show the restored size (a plain move leaves what the user typed alone).
            this.ui.widthInput.value = String(this.widthCells);
            this.ui.heightInput.value = String(this.heightCells);
        }
        this.setStatus(action === 'undo' ? '元に戻しました。' : 'やり直しました。');
        this.renderAll();
    }

    private clearAllMines(): void {
        const before = this.snapshot();
        if (this.play !== null || !hasAnyMine(before)) {
            return;
        }
        if (!window.confirm('地雷をすべて消しますか？（「元に戻す」で戻せます）')) {
            return;
        }
        this.commitMove(before, clearMines(before));
        this.setStatus('地雷をすべて消しました。');
        this.renderAll();
    }

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
    private applyCellViews(only?: ReadonlySet<number>): void {
        if (!this.ui) {
            return;
        }
        const board = this.play !== null ? this.toBoardState() : null;
        const forbidden = this.forbiddenCells();
        const grid = this.grid();
        const buttons = this.ui.boardGrid.querySelectorAll<HTMLButtonElement>('.editmin-cell');
        buttons.forEach((button, i) => {
            if (only !== undefined && !only.has(i)) {
                return; // a drag edit redraws just the cells it touched
            }
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
            const count = adjacentMineCount(grid, i);
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
        return this.startIndex === null ? new Set<number>() : forbiddenZone(this.startIndex, this.widthCells, this.heightCells);
    }

    private cellState(index: number, forbidden: Set<number>): PaleCellState {
        return {
            hasMine: this.cells[index].hasMine,
            isStart: this.startIndex === index,
            isForbidden: forbidden.has(index)
        };
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

    /** The size and mines the board rules (logic/board.ts) read. */
    private grid(): Grid {
        return { width: this.widthCells, height: this.heightCells, cells: this.cells };
    }

    private onCellClick(index: number, event: MouseEvent): void {
        // The mouse press of a drag edit already painted; its own click must not toggle again (a keyboard click, detail 0, does).
        if (this.suppressClick && event.detail !== 0) {
            this.suppressClick = false;
            return;
        }
        if (this.play !== null) {
            // A keyboard "click" (Space or Enter on a focused cell) has detail 0: the play opens cells by mouse only.
            if (event.detail !== 0) {
                this.openPlayCell(index);
            }
            return;
        }

        if (this.startMode) {
            if (!canSetStart(this.grid(), index)) {
                this.setStatus('開始マス周囲に爆弾があるため、開始マス設定を拒否しました。');
                return;
            }
            const before = this.snapshot();
            this.commitMove(before, { ...before, startIndex: index });
            this.startMode = false;
            if (this.ui) {
                this.ui.startBtn.classList.remove('active');
            }
            this.setStatus('開始マスを設定しました。');
            this.renderAll();
            return;
        }

        if (!canPlaceMine(this.grid(), this.startIndex, index)) {
            this.setStatus('開始マス制約: このセルには爆弾を置けません。');
            return;
        }

        const before = this.snapshot();
        const mines = [...before.mines];
        mines[index] = !mines[index];
        this.commitMove(before, { ...before, mines });
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
            cellBtn.dataset.index = String(i);
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
        const buttons = historyButtonState(this.history, this.cells.some((c) => c.hasMine), playing);
        this.ui.undoBtn.disabled = !buttons.undoEnabled;
        this.ui.redoBtn.disabled = !buttons.redoEnabled;
        this.ui.clearBtn.disabled = !buttons.clearEnabled;
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
