import { Scene } from 'phaser';
import { analyzePuzzle } from '../core/solver';
import { createBinaryBoard, createPlayerBoard, filledMatch, resizeBinaryBoard } from '../core/board';
import { exportPBM, importPBM } from '../core/pbm';
import { generateColHints, generateRowHints } from '../core/hints';
import type { AnalysisResult, BinaryCell, PlayerCell } from '../core/types';

type Mode = 'edit' | 'play';

type Button = {
    x: number;
    y: number;
    label: string;
    width?: number;
    height?: number;
    onClick: () => void;
    active?: boolean;
};

type MobileTab = 'edit' | 'analysis' | 'data';
type PlayInputMode = 'fill' | 'mark';

type DragState = {
    active: boolean;
    startX: number;
    startY: number;
    axis: 'horizontal' | 'vertical' | null;
    lastX: number;
    lastY: number;
    moved: boolean;
};

type CellRenderCache = {
    rect: Phaser.GameObjects.Rectangle;
    mark: Phaser.GameObjects.Text | null;
};

const TITLE_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    color: '#f4f4f4',
    fontFamily: 'monospace',
    fontSize: '20px',
};

const UI_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
    color: '#d8d8d8',
    fontFamily: 'monospace',
    fontSize: '14px',
};

const SIZE_SHORTCUTS = [5, 7, 10, 12, 15, 18, 20, 22, 25] as const;

export class Game extends Scene {
    private solution: BinaryCell[][] = createBinaryBoard(10, 10, 0);
    private player: PlayerCell[][] = createPlayerBoard(10, 10, 'unknown');
    private mode: Mode = 'edit';
    private analysis: AnalysisResult = analyzePuzzle(this.solution, generateRowHints(this.solution), generateColHints(this.solution));
    private message = 'Ready';
    private moveCount = 0;
    private startedAt = Date.now();
    private playInputMode: PlayInputMode = 'fill';
    private drag: DragState = {
        active: false,
        startX: 0,
        startY: 0,
        axis: null,
        lastX: -1,
        lastY: -1,
        moved: false,
    };
    private importDialog: HTMLDivElement | null = null;
    private isMobileLayout = false;
    private mobileTab: MobileTab = 'edit';
    private cellCache: CellRenderCache[][] = [];
    private renderScheduled = false;
    private renderRafId: number | null = null;
    private cleanupDone = false;
    private readonly onPointerUp = (): void => {
        this.finishDrag();
    };
    private readonly onResize = (): void => {
        this.requestRender();
    };
    private readonly onKeyC = (): void => {
        this.copyPBM();
    };
    private readonly onKeyD = (): void => {
        this.runAnalysis();
        this.requestRender();
    };
    private readonly onKeyE = (): void => {
        this.mode = 'edit';
        this.message = 'Switched to edit mode';
        this.requestRender();
    };
    private readonly onKeyR = (): void => {
        this.solution = createBinaryBoard(this.solution[0].length, this.solution.length, 0);
        this.player = createPlayerBoard(this.solution[0].length, this.solution.length, 'unknown');
        this.runAnalysis();
        this.message = 'Board cleared';
        this.requestRender();
    };
    private readonly onKeyT = (): void => {
        this.startPlayMode();
    };
    private readonly onSceneShutdown = (): void => {
        this.cleanupSceneResources();
    };
    private readonly onSceneDestroy = (): void => {
        this.cleanupSceneResources();
    };
    private readonly digitHandlers: Array<() => void> = SIZE_SHORTCUTS.map((mapping) => () => {
        this.applySize(mapping, mapping);
    });

    constructor() {
        super('Game');
    }

    create(): void {
        this.cleanupDone = false;
        this.cameras.main.setBackgroundColor('#141414');
        this.input.addPointer(1);
        this.input.on('pointerup', this.onPointerUp);
        this.scale.on('resize', this.onResize);
        this.events.once('shutdown', this.onSceneShutdown, this);
        this.events.once('destroy', this.onSceneDestroy, this);
        this.bindKeyboard();
        this.runAnalysis();
        this.requestRender();
    }

    shutdown(): void {
        this.cleanupSceneResources();
    }

    private cleanupSceneResources(): void {
        if (this.cleanupDone) {
            return;
        }
        this.cleanupDone = true;

        this.input.off('pointerup', this.onPointerUp);
        this.scale.off('resize', this.onResize);
        this.unbindKeyboard();
        this.events.off('shutdown', this.onSceneShutdown, this);
        this.events.off('destroy', this.onSceneDestroy, this);
        if (this.renderRafId !== null && typeof window !== 'undefined') {
            window.cancelAnimationFrame(this.renderRafId);
            this.renderRafId = null;
        }
        this.renderScheduled = false;
        this.closeImportDialog();
    }

    private requestRender(): void {
        if (this.renderScheduled) {
            return;
        }
        this.renderScheduled = true;

        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            this.renderRafId = window.requestAnimationFrame(() => {
                this.renderRafId = null;
                this.renderScheduled = false;
                this.render();
            });
            return;
        }

        this.renderScheduled = false;
        this.render();
    }

    private bindKeyboard(): void {
        const keyboard = this.input.keyboard;
        if (!keyboard) {
            return;
        }

        keyboard.on('keydown-C', this.onKeyC);
        keyboard.on('keydown-D', this.onKeyD);
        keyboard.on('keydown-E', this.onKeyE);
        keyboard.on('keydown-R', this.onKeyR);
        keyboard.on('keydown-T', this.onKeyT);

        for (let i = 1; i <= 9; i += 1) {
            keyboard.on(`keydown-${i}`, this.digitHandlers[i - 1]);
        }
    }

    private unbindKeyboard(): void {
        const keyboard = this.input.keyboard;
        if (!keyboard) {
            return;
        }

        keyboard.off('keydown-C', this.onKeyC);
        keyboard.off('keydown-D', this.onKeyD);
        keyboard.off('keydown-E', this.onKeyE);
        keyboard.off('keydown-R', this.onKeyR);
        keyboard.off('keydown-T', this.onKeyT);

        for (let i = 1; i <= 9; i += 1) {
            keyboard.off(`keydown-${i}`, this.digitHandlers[i - 1]);
        }
    }

    private applySize(width: number, height: number): void {
        this.solution = resizeBinaryBoard(this.solution, width, height);
        this.player = createPlayerBoard(this.solution[0].length, this.solution.length, 'unknown');
        this.mode = 'edit';
        this.runAnalysis();
        this.message = `Resized to ${this.solution[0].length} x ${this.solution.length}`;
        this.requestRender();
    }

    private startPlayMode(): void {
        this.mode = 'play';
        this.playInputMode = 'fill';
        this.player = createPlayerBoard(this.solution[0].length, this.solution.length, 'unknown');
        this.moveCount = 0;
        this.startedAt = Date.now();
        if (!this.analysis.unique || !this.analysis.solvable) {
            this.message = 'Warning: puzzle is not unique/solvable but play is allowed';
        } else {
            this.message = 'Play mode started';
        }
        this.requestRender();
    }

    private runAnalysis(): void {
        const rows = generateRowHints(this.solution);
        const cols = generateColHints(this.solution);
        this.analysis = analyzePuzzle(this.solution, rows, cols, 3000);
    }

    private copyPBM(): void {
        const data = exportPBM(this.solution, this.analysis);
        navigator.clipboard.writeText(data)
            .then(() => {
                this.message = 'PBM copied to clipboard';
                this.requestRender();
            })
            .catch((err: unknown) => {
                this.message = `Clipboard copy failed: ${String(err)}`;
                this.requestRender();
            });
    }

    private loadPBMText(text: string): void {
        try {
            const loaded = importPBM(text);
            this.solution = loaded.puzzle.solution;
            this.player = createPlayerBoard(loaded.puzzle.width, loaded.puzzle.height, 'unknown');
            this.mode = 'edit';
            this.runAnalysis();
            this.message = `PBM loaded (${loaded.puzzle.width} x ${loaded.puzzle.height})`;
            this.requestRender();
        } catch (err) {
            this.message = `PBM load failed: ${String(err)}`;
            this.requestRender();
        }
    }

    private closeImportDialog(): void {
        if (this.importDialog) {
            this.importDialog.remove();
            this.importDialog = null;
        }
    }

    private openImportDialog(): void {
        this.closeImportDialog();
        const mobile = this.getScreenWidth() <= 768;

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0, 0, 0, 0.55)';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '1000';

        const panel = document.createElement('div');
        panel.style.width = mobile ? '100vw' : 'min(760px, 92vw)';
        panel.style.height = mobile ? '100vh' : 'auto';
        panel.style.background = '#1e1e1e';
        panel.style.border = '1px solid #444';
        panel.style.borderRadius = mobile ? '0' : '8px';
        panel.style.padding = mobile ? '14px' : '12px';
        panel.style.display = 'flex';
        panel.style.flexDirection = 'column';
        panel.style.gap = '10px';

        const title = document.createElement('div');
        title.textContent = 'Paste P1 PBM text';
        title.style.fontFamily = 'monospace';
        title.style.fontSize = '14px';
        title.style.color = '#f4f4f4';

        const textarea = document.createElement('textarea');
        textarea.rows = mobile ? 20 : 16;
        textarea.style.width = '100%';
        textarea.style.resize = 'vertical';
        textarea.style.background = '#111';
        textarea.style.color = '#f0f0f0';
        textarea.style.border = '1px solid #555';
        textarea.style.padding = '8px';
        textarea.style.fontFamily = 'monospace';
        textarea.style.fontSize = mobile ? '14px' : '13px';
        if (mobile) {
            textarea.style.flex = '1';
            textarea.style.minHeight = '300px';
        }
        textarea.placeholder = 'P1\n# comments\n5 5\n0 1 0 1 0 ...';

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'flex-end';
        actions.style.gap = '8px';

        const cancel = document.createElement('button');
        cancel.textContent = 'Cancel';
        cancel.style.minHeight = '44px';
        cancel.onclick = () => this.closeImportDialog();

        const load = document.createElement('button');
        load.textContent = 'Load PBM';
        load.style.minHeight = '44px';
        load.onclick = () => {
            const text = textarea.value.trim();
            if (!text) {
                this.message = 'PBM input is empty';
                this.requestRender();
                return;
            }
            this.closeImportDialog();
            this.loadPBMText(text);
        };

        actions.append(cancel, load);
        panel.append(title, textarea, actions);
        overlay.append(panel);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                this.closeImportDialog();
            }
        });

        document.body.append(overlay);
        this.importDialog = overlay;
        textarea.focus();
    }

    private startDrag(x: number, y: number): void {
        this.drag.active = true;
        this.drag.startX = x;
        this.drag.startY = y;
        this.drag.axis = null;
        this.drag.lastX = x;
        this.drag.lastY = y;
        this.drag.moved = false;
    }

    private getDragRange(x: number, y: number): { minX: number; maxX: number; minY: number; maxY: number; targetX: number; targetY: number } {
        const targetX = this.drag.axis === 'vertical' ? this.drag.startX : x;
        const targetY = this.drag.axis === 'horizontal' ? this.drag.startY : y;
        return {
            minX: Math.min(this.drag.startX, targetX),
            maxX: Math.max(this.drag.startX, targetX),
            minY: Math.min(this.drag.startY, targetY),
            maxY: Math.max(this.drag.startY, targetY),
            targetX,
            targetY,
        };
    }

    private applyEditClick(x: number, y: number): number {
        this.solution[y][x] = this.solution[y][x] === 1 ? 0 : 1;
        return 1;
    }

    private applyEditDrag(minX: number, maxX: number, minY: number, maxY: number): number {
        let anyEmpty = false;
        let changed = 0;
        for (let yy = minY; yy <= maxY; yy += 1) {
            for (let xx = minX; xx <= maxX; xx += 1) {
                if (this.solution[yy][xx] === 0) {
                    anyEmpty = true;
                }
            }
        }

        if (anyEmpty) {
            for (let yy = minY; yy <= maxY; yy += 1) {
                for (let xx = minX; xx <= maxX; xx += 1) {
                    if (this.solution[yy][xx] === 0) {
                        this.solution[yy][xx] = 1;
                        changed += 1;
                    }
                }
            }
            return changed;
        }

        for (let yy = minY; yy <= maxY; yy += 1) {
            for (let xx = minX; xx <= maxX; xx += 1) {
                if (this.solution[yy][xx] === 1) {
                    this.solution[yy][xx] = 0;
                    changed += 1;
                }
            }
        }
        return changed;
    }

    private applyPlayClick(x: number, y: number): number {
        const current = this.player[y][x];
        const target: PlayerCell = this.playInputMode === 'fill' ? 'filled' : 'marked';
        const next: PlayerCell = current === 'unknown' ? target : 'unknown';
        if (next === current) {
            return 0;
        }
        this.player[y][x] = next;
        return 1;
    }

    private applyPlayDrag(minX: number, maxX: number, minY: number, maxY: number): number {
        let unknownCount = 0;
        let filledCount = 0;
        let markedCount = 0;

        for (let yy = minY; yy <= maxY; yy += 1) {
            for (let xx = minX; xx <= maxX; xx += 1) {
                const value = this.player[yy][xx];
                if (value === 'unknown') {
                    unknownCount += 1;
                } else if (value === 'filled') {
                    filledCount += 1;
                } else {
                    markedCount += 1;
                }
            }
        }

        let changed = 0;
        const total = unknownCount + filledCount + markedCount;
        if (unknownCount > 0) {
            const target: PlayerCell = this.playInputMode === 'fill' ? 'filled' : 'marked';
            for (let yy = minY; yy <= maxY; yy += 1) {
                for (let xx = minX; xx <= maxX; xx += 1) {
                    if (this.player[yy][xx] === 'unknown') {
                        this.player[yy][xx] = target;
                        changed += 1;
                    }
                }
            }
            return changed;
        }

        if (this.playInputMode === 'fill' && filledCount === total) {
            for (let yy = minY; yy <= maxY; yy += 1) {
                for (let xx = minX; xx <= maxX; xx += 1) {
                    this.player[yy][xx] = 'unknown';
                    changed += 1;
                }
            }
            return changed;
        }

        if (this.playInputMode === 'mark' && markedCount === total) {
            for (let yy = minY; yy <= maxY; yy += 1) {
                for (let xx = minX; xx <= maxX; xx += 1) {
                    this.player[yy][xx] = 'unknown';
                    changed += 1;
                }
            }
            return changed;
        }

        return 0;
    }

    private setPlayInputMode(nextMode: PlayInputMode): void {
        this.playInputMode = nextMode;
        this.message = `Play input: ${nextMode}`;
        this.requestRender();
    }

    private togglePlayInputMode(): void {
        this.setPlayInputMode(this.playInputMode === 'fill' ? 'mark' : 'fill');
    }

    private applyDragTo(x: number, y: number): void {
        if (!this.drag.active) {
            return;
        }
        if (x === this.drag.lastX && y === this.drag.lastY) {
            return;
        }
        this.drag.lastX = x;
        this.drag.lastY = y;
        this.drag.moved = true;

        const dx = x - this.drag.startX;
        const dy = y - this.drag.startY;
        if (this.drag.axis === null && (dx !== 0 || dy !== 0)) {
            this.drag.axis = Math.abs(dx) >= Math.abs(dy) ? 'horizontal' : 'vertical';
        }

        const range = this.getDragRange(x, y);

        this.message = this.mode === 'edit'
            ? `Preview edit line from (${this.drag.startX}, ${this.drag.startY}) to (${range.targetX}, ${range.targetY})`
            : `Preview play line (${this.playInputMode}) from (${this.drag.startX}, ${this.drag.startY}) to (${range.targetX}, ${range.targetY})`;
        this.requestRender();
    }

    private finishDrag(): void {
        if (!this.drag.active) {
            return;
        }

        // Tap/click without movement toggles just one cell.
        if (!this.drag.moved) {
            if (this.mode === 'edit') {
                this.applyEditClick(this.drag.startX, this.drag.startY);
                this.message = `Edited cell (${this.drag.startX}, ${this.drag.startY})`;
            } else {
                const changed = this.applyPlayClick(this.drag.startX, this.drag.startY);
                this.moveCount += changed;
                if (filledMatch(this.solution, this.player)) {
                    const elapsedSec = Math.floor((Date.now() - this.startedAt) / 1000);
                    this.message = `Cleared! moves=${this.moveCount} time=${elapsedSec}s`;
                } else {
                    this.message = `Play move ${this.moveCount}`;
                }
            }
            this.updateCellsInRange(this.drag.startX, this.drag.startX, this.drag.startY, this.drag.startY);
        } else {
            const range = this.getDragRange(this.drag.lastX, this.drag.lastY);
            if (this.mode === 'edit') {
                this.applyEditDrag(range.minX, range.maxX, range.minY, range.maxY);
                this.updateCellsInRange(range.minX, range.maxX, range.minY, range.maxY);
            } else {
                const changed = this.applyPlayDrag(range.minX, range.maxX, range.minY, range.maxY);
                this.moveCount += changed;
                this.updateCellsInRange(range.minX, range.maxX, range.minY, range.maxY);
            }
        }

        this.drag.active = false;
        if (this.mode === 'edit') {
            this.runAnalysis();
        } else if (this.drag.moved) {
            if (filledMatch(this.solution, this.player)) {
                const elapsedSec = Math.floor((Date.now() - this.startedAt) / 1000);
                this.message = `Cleared! moves=${this.moveCount} time=${elapsedSec}s`;
            } else {
                this.message = `Play move ${this.moveCount}`;
            }
        }
        this.requestRender();
    }

    private getScreenWidth(): number {
        if (typeof window !== 'undefined') {
            return Math.floor(window.visualViewport?.width ?? window.innerWidth);
        }
        return this.scale.width;
    }

    private drawButton(button: Button): void {
        const width = button.width ?? Math.max(44, button.label.length * 9 + 20);
        const height = button.height ?? 44;
        const bgColor = button.active ? 0x2f5d3a : 0x2a2a2a;
        const borderColor = button.active ? 0x87d3a2 : 0x666666;

        const bg = this.add.rectangle(button.x, button.y, width, height, bgColor, 1)
            .setOrigin(0, 0)
            .setStrokeStyle(1, borderColor)
            .setInteractive({ useHandCursor: true });
        const txt = this.add.text(button.x + width / 2, button.y + height / 2, button.label, {
            ...UI_STYLE,
            fontSize: '13px',
            color: '#f4f4f4',
        }).setOrigin(0.5, 0.5);

        bg.on('pointerdown', button.onClick);
        txt.setInteractive({ useHandCursor: true });
        txt.on('pointerdown', button.onClick);
    }

    private updateCellVisual(x: number, y: number): void {
        const row = this.cellCache[y];
        const cell = row?.[x];
        if (!cell) {
            return;
        }

        const content = this.mode === 'edit' ? (this.solution[y][x] === 1 ? 'filled' : 'empty') : this.player[y][x];
        const fillColor = content === 'filled' ? 0x111111 : 0xf7f7f7;
        cell.rect.setFillStyle(fillColor, 1);

        const shouldShowMark = this.mode === 'play' && content === 'marked';
        if (shouldShowMark) {
            if (!cell.mark) {
                cell.mark = this.add.text(
                    cell.rect.x + cell.rect.width * 0.3,
                    cell.rect.y + cell.rect.height * 0.15,
                    'x',
                    { ...UI_STYLE, color: '#2f4f4f', fontSize: '18px' },
                );
            }
        } else if (cell.mark) {
            cell.mark.destroy();
            cell.mark = null;
        }
    }

    private canDiffUpdate(): boolean {
        const height = this.solution.length;
        const width = this.solution[0]?.length ?? 0;
        if (this.cellCache.length !== height) {
            return false;
        }
        for (let y = 0; y < height; y += 1) {
            if (this.cellCache[y]?.length !== width) {
                return false;
            }
        }
        return true;
    }

    private updateCellsInRange(minX: number, maxX: number, minY: number, maxY: number): void {
        if (!this.canDiffUpdate()) {
            this.requestRender();
            return;
        }
        for (let yy = minY; yy <= maxY; yy += 1) {
            for (let xx = minX; xx <= maxX; xx += 1) {
                this.updateCellVisual(xx, yy);
            }
        }
    }

    private drawDragPreview(gridLeft: number, gridTop: number, cellSize: number): void {
        if (!this.drag.active) {
            return;
        }

        const range = this.drag.moved
            ? this.getDragRange(this.drag.lastX, this.drag.lastY)
            : {
                minX: this.drag.startX,
                maxX: this.drag.startX,
                minY: this.drag.startY,
                maxY: this.drag.startY,
                targetX: this.drag.startX,
                targetY: this.drag.startY,
            };

        const preview = this.add.graphics();
        const fillColor = this.mode === 'edit' ? 0x2f7bff : 0x5ca35c;
        preview.fillStyle(fillColor, 0.2);
        preview.lineStyle(2, fillColor, 0.9);

        const x = gridLeft + range.minX * cellSize;
        const y = gridTop + range.minY * cellSize;
        const w = (range.maxX - range.minX + 1) * cellSize - 1;
        const h = (range.maxY - range.minY + 1) * cellSize - 1;
        preview.fillRect(x, y, w, h);
        preview.strokeRect(x, y, w, h);
    }

    private render(): void {
        this.children.removeAll(true);
        this.cellCache = [];

        const worldWidth = this.scale.width;
        const worldHeight = this.scale.height;
        const screenWidth = this.getScreenWidth();
        this.isMobileLayout = screenWidth <= 768;

        const width = this.solution[0].length;
        const height = this.solution.length;
        const rowHints = generateRowHints(this.solution);
        const colHints = generateColHints(this.solution);

        const headerX = this.isMobileLayout ? 12 : 24;
        this.add.text(headerX, 16, 'NonoEdit', TITLE_STYLE);
        this.add.text(headerX, 44, `Mode: ${this.mode}`, UI_STYLE);
        this.add.text(headerX, 64, `Size: ${width} x ${height}`, UI_STYLE);
        if (this.mode === 'play') {
            this.add.text(headerX, 84, `Input: ${this.playInputMode}`, UI_STYLE);
        }

        const desktopButtons: Button[] = [
            {
                x: 220,
                y: 20,
                label: '[Resize]',
                width: 80,
                onClick: () => {
                    const w = window.prompt('width (5-25)', String(width));
                    const h = window.prompt('height (5-25)', String(height));
                    if (!w || !h) {
                        return;
                    }
                    this.applySize(Number(w), Number(h));
                },
            },
            { x: 308, y: 20, label: '[Import]', width: 76, onClick: () => this.openImportDialog() },
            { x: 392, y: 20, label: '[Copy PBM]', width: 104, onClick: () => this.copyPBM() },
            {
                x: 500,
                y: 20,
                label: '[Analyze]',
                width: 86,
                onClick: () => {
                    this.runAnalysis();
                    this.message = 'Analysis updated';
                    this.requestRender();
                },
            },
            {
                x: 590,
                y: 20,
                label: this.mode === 'edit' ? '[Test Play]' : '[Back to Edit]',
                width: 126,
                onClick: () => {
                    if (this.mode === 'edit') {
                        this.startPlayMode();
                    } else {
                        this.mode = 'edit';
                        this.message = 'Back to edit mode';
                        this.requestRender();
                    }
                },
            },
        ];

        if (this.mode === 'play') {
            desktopButtons.push({
                x: 720,
                y: 20,
                label: this.playInputMode === 'fill' ? '[Input: Fill]' : '[Input: Mark]',
                width: 128,
                active: true,
                onClick: () => this.togglePlayInputMode(),
            });
        }

        if (!this.isMobileLayout) {
            for (const button of desktopButtons) {
                this.drawButton(button);
            }
        }

        const toolbarHeight = 0;
        const tabHeight = this.isMobileLayout ? 42 : 0;
        const panelHeight = this.isMobileLayout ? 102 : 0;
        const boardTop = this.isMobileLayout ? 92 : 120;
        const boardBottomPadding = this.isMobileLayout ? toolbarHeight + tabHeight + panelHeight + 12 : 12;

        const gridLeftBase = this.isMobileLayout ? 12 : 220;
        const gridTopBase = boardTop;
        const gridMaxWidth = this.isMobileLayout ? worldWidth - 24 : Math.min(580, worldWidth - 300);
        const gridMaxHeight = Math.max(180, worldHeight - gridTopBase - boardBottomPadding);

        const maxRowHintLen = Math.max(Math.ceil(height / 4) + 1, Math.max(...rowHints.map((h) => h.length)));
        const maxColHintLen = Math.max(Math.ceil(width / 4) + 1, Math.max(...colHints.map((h) => h.length)));
        const rowHintStep = this.isMobileLayout ? 14 : 20;
        const colHintStep = this.isMobileLayout ? 14 : 18;
        const rowHintSpace = maxRowHintLen * rowHintStep + 8;
        const colHintSpace = maxColHintLen * colHintStep + 8;

        const cellSizeByWidth = Math.floor((gridMaxWidth - rowHintSpace) / Math.max(1, width));
        const cellSizeByHeight = Math.floor((gridMaxHeight - colHintSpace) / Math.max(1, height));
        const minCell = this.isMobileLayout ? 14 : 18;
        const maxCell = this.isMobileLayout ? 32 : 28;
        const cellSize = Math.max(minCell, Math.min(maxCell, Math.min(cellSizeByWidth, cellSizeByHeight)));

        const gridLeft = gridLeftBase + rowHintSpace;
        const gridTop = gridTopBase + colHintSpace;

        for (let y = 0; y < rowHints.length; y += 1) {
            const hints = rowHints[y];
            for (let i = 0; i < maxRowHintLen; i += 1) {
                const hintValue = hints[hints.length - maxRowHintLen + i];
                const text = hintValue === undefined ? '' : String(hintValue);
                const hintStyle = this.isMobileLayout ? { ...UI_STYLE, fontSize: '12px' } : UI_STYLE;
                this.add.text(gridLeft - (maxRowHintLen - i) * rowHintStep, gridTop + y * cellSize + 4, text, hintStyle);
            }
        }

        for (let x = 0; x < colHints.length; x += 1) {
            const hints = colHints[x];
            for (let i = 0; i < maxColHintLen; i += 1) {
                const hintValue = hints[hints.length - maxColHintLen + i];
                const text = hintValue === undefined ? '' : String(hintValue);
                const hintStyle = this.isMobileLayout ? { ...UI_STYLE, fontSize: '12px' } : UI_STYLE;
                this.add.text(gridLeft + x * cellSize + 3, gridTop - (maxColHintLen - i) * colHintStep, text, hintStyle);
            }
        }

        for (let y = 0; y < height; y += 1) {
            this.cellCache[y] = [];
            for (let x = 0; x < width; x += 1) {
                const px = gridLeft + x * cellSize;
                const py = gridTop + y * cellSize;
                const rect = this.add.rectangle(px, py, cellSize - 1, cellSize - 1, 0xffffff, 1).setOrigin(0, 0).setStrokeStyle(1, 0x666666);
                this.cellCache[y][x] = { rect, mark: null };
                this.updateCellVisual(x, y);

                rect.setInteractive({ useHandCursor: true });
                rect.on('pointerdown', () => {
                    this.startDrag(x, y);
                    this.requestRender();
                });

                rect.on('pointerover', (pointer: Phaser.Input.Pointer) => {
                    if (!this.drag.active || !pointer.isDown) {
                        return;
                    }
                    this.applyDragTo(x, y);
                });
            }
        }

        this.drawDragPreview(gridLeft, gridTop, cellSize);

        // 5-cell subdivision overlay
        const subGraphics = this.add.graphics();
        const totalGridW = width * cellSize;
        const totalGridH = height * cellSize;

        // outer border - 1px
        subGraphics.lineStyle(1, 0x888888, 1);
        subGraphics.strokeRect(gridLeft - 1, gridTop - 1, totalGridW + 1, totalGridH + 1);

        // 5-cell boundary lines: 3px centered on the gap, overlapping into adjacent cells
        // 0x5599dd (blue-gray) is visible on both white (empty) and dark (filled) cells
        subGraphics.lineStyle(3, 0x5599dd, 0.85);
        for (let gx = 5; gx < width; gx += 5) {
            const cx = gridLeft + gx * cellSize - 0.5;
            subGraphics.lineBetween(cx, gridTop, cx, gridTop + totalGridH - 1);
        }
        for (let gy = 5; gy < height; gy += 5) {
            const cy = gridTop + gy * cellSize - 0.5;
            subGraphics.lineBetween(gridLeft, cy, gridLeft + totalGridW - 1, cy);
        }

        if (!this.isMobileLayout) {
            // Keep analysis panel inside the viewport on narrow non-mobile widths (e.g. 769-819px).
            const statusX = Math.max(24, Math.min(Math.max(820, worldWidth - 200), worldWidth - 180));
            this.add.text(statusX, 120, 'Analysis', TITLE_STYLE);
            this.add.text(statusX, 150, `solvable: ${this.analysis.solvable}`, UI_STYLE);
            this.add.text(statusX, 170, `unique: ${this.analysis.unique}`, UI_STYLE);
            this.add.text(statusX, 190, `logical: ${this.analysis.logical}`, UI_STYLE);
            this.add.text(statusX, 210, `difficulty: ${this.analysis.difficulty}`, UI_STYLE);
            this.add.text(statusX, 230, `score: ${this.analysis.score}`, UI_STYLE);
            this.add.text(statusX, 250, `remaining: ${this.analysis.remainingCells}`, UI_STYLE);
            const techLabels: Array<[string, string]> = [
                ['full-line-fill', 'fill'],
                ['full-line-empty', 'empty'],
                ['edge-overlap', 'overlap'],
                ['candidate-common', 'common'],
                ['cross-constraint', 'cross'],
                ['region-split', 'split'],
                ['box-reduction', 'box'],
                ['probe-consistency', 'probe'],
            ];
            let techY = 270;
            for (const [key, label] of techLabels) {
                const count = this.analysis.techniquesUsed[key as keyof typeof this.analysis.techniquesUsed] ?? 0;
                const color = count > 0 ? '#d8d8d8' : '#666666';
                this.add.text(statusX, techY, `${label}: ${count}`, { ...UI_STYLE, color });
                techY += 18;
            }
            if (this.analysis.timedOut) {
                this.add.text(statusX, techY, 'timeout: 3s', { ...UI_STYLE, color: '#ffcc66' });
            }
        }

        if (this.isMobileLayout) {
            const panelY = worldHeight - (toolbarHeight + tabHeight + panelHeight);
            const panelX = 12;
            const panelW = worldWidth - 24;
            this.add.rectangle(panelX, panelY, panelW, panelHeight, 0x1e1e1e, 1)
                .setOrigin(0, 0)
                .setStrokeStyle(1, 0x444444);

            if (this.mobileTab === 'analysis') {
                this.add.text(panelX + 10, panelY + 8, `solvable: ${this.analysis.solvable}  unique: ${this.analysis.unique}`, { ...UI_STYLE, fontSize: '13px' });
                this.add.text(panelX + 10, panelY + 28, `logical: ${this.analysis.logical}  difficulty: ${this.analysis.difficulty}`, { ...UI_STYLE, fontSize: '13px' });
                this.add.text(panelX + 10, panelY + 48, `score: ${this.analysis.score}  remaining: ${this.analysis.remainingCells}`, { ...UI_STYLE, fontSize: '13px' });
                const fill = this.analysis.techniquesUsed['full-line-fill'] ?? 0;
                const empty = this.analysis.techniquesUsed['full-line-empty'] ?? 0;
                const overlap = this.analysis.techniquesUsed['edge-overlap'] ?? 0;
                const common = this.analysis.techniquesUsed['candidate-common'] ?? 0;
                const cross = this.analysis.techniquesUsed['cross-constraint'] ?? 0;
                const split = this.analysis.techniquesUsed['region-split'] ?? 0;
                const box = this.analysis.techniquesUsed['box-reduction'] ?? 0;
                const probe = this.analysis.techniquesUsed['probe-consistency'] ?? 0;
                this.add.text(panelX + 10, panelY + 68, `f:${fill} e:${empty} o:${overlap} c:${common} x:${cross}`, { ...UI_STYLE, fontSize: '12px', color: '#aaaaaa' });
                this.add.text(panelX + 10, panelY + 82, `s:${split} b:${box} p:${probe}`, { ...UI_STYLE, fontSize: '12px', color: '#aaaaaa' });
                if (this.analysis.timedOut) {
                    this.add.text(panelX + 10, panelY + 96, 'timeout: 3s', { ...UI_STYLE, fontSize: '13px', color: '#ffcc66' });
                }
            } else if (this.mobileTab === 'data') {
                this.add.text(panelX + 10, panelY + 10, 'PBM I/O', { ...UI_STYLE, fontSize: '13px' });
                this.drawButton({ x: panelX + 10, y: panelY + 34, label: 'Import', width: 100, onClick: () => this.openImportDialog() });
                this.drawButton({ x: panelX + 120, y: panelY + 34, label: 'Copy', width: 98, onClick: () => this.copyPBM() });
            } else {
                this.add.text(panelX + 10, panelY + 10, this.mode === 'edit' ? 'Edit tools' : 'Play tools', { ...UI_STYLE, fontSize: '13px' });
                this.drawButton({
                    x: panelX + 10,
                    y: panelY + 34,
                    label: 'Resize',
                    width: 94,
                    onClick: () => {
                        const w = window.prompt('width (5-25)', String(width));
                        const h = window.prompt('height (5-25)', String(height));
                        if (!w || !h) {
                            return;
                        }
                        this.applySize(Number(w), Number(h));
                    },
                });
                if (this.mode === 'play') {
                    this.drawButton({
                        x: panelX + 94,
                        y: panelY + 34,
                        label: 'Edit',
                        width: 70,
                        onClick: () => {
                            this.mode = 'edit';
                            this.message = 'Back to edit mode';
                            this.requestRender();
                        },
                    });
                    this.drawButton({
                        x: panelX + 170,
                        y: panelY + 34,
                        label: this.playInputMode === 'fill' ? 'Fill' : 'Mark',
                        width: 92,
                        active: true,
                        onClick: () => this.togglePlayInputMode(),
                    });
                    this.add.text(panelX + 10, panelY + 82, `input: ${this.playInputMode}`, { ...UI_STYLE, fontSize: '12px', color: '#a8a8a8' });
                } else {
                    this.drawButton({
                        x: panelX + 112,
                        y: panelY + 34,
                        label: 'Play',
                        width: 94,
                        onClick: () => {
                            this.startPlayMode();
                        },
                    });
                    this.add.text(panelX + 10, panelY + 76, 'Analysis is updated automatically', { ...UI_STYLE, fontSize: '12px', color: '#a8a8a8' });
                }
            }

            const tabY = worldHeight - (toolbarHeight + tabHeight);
            const tabW = Math.floor((worldWidth - 24 - 16) / 3);
            this.drawButton({ x: 12, y: tabY, label: '編集', width: tabW, height: 38, active: this.mobileTab === 'edit', onClick: () => { this.mobileTab = 'edit'; this.requestRender(); } });
            this.drawButton({ x: 20 + tabW, y: tabY, label: '情報', width: tabW, height: 38, active: this.mobileTab === 'analysis', onClick: () => { this.mobileTab = 'analysis'; this.requestRender(); } });
            this.drawButton({ x: 28 + tabW * 2, y: tabY, label: '入出力', width: tabW, height: 38, active: this.mobileTab === 'data', onClick: () => { this.mobileTab = 'data'; this.requestRender(); } });
        }

        const messageY = this.isMobileLayout ? Math.max(76, gridTop - 18) : worldHeight - 68;
        if (!this.isMobileLayout) {
            this.add.text(headerX, messageY, this.message, { ...UI_STYLE, color: '#ffe08a', fontSize: '14px' });
        } else {
            const showMobileMessage =
                this.mode === 'play'
                || this.mobileTab === 'data'
                || this.message.startsWith('Cleared')
                || this.message.includes('PBM')
                || this.message.includes('Clipboard')
                || this.message.includes('failed');
            if (showMobileMessage) {
                this.add.text(headerX, messageY, this.message, { ...UI_STYLE, color: '#ffe08a', fontSize: '13px' });
            }
        }
        if (!this.isMobileLayout) {
            this.add.text(24, worldHeight - 44, 'Shortcuts: 1-9 resize, C copy, D analyze, T play, E edit, R clear', UI_STYLE);
        }
    }
}
