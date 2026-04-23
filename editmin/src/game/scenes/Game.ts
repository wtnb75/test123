import { Scene } from 'phaser';
import {
    evaluateDifficulty,
    type BoardCell,
    type BoardState,
    type DifficultyEvaluation
} from '../logic/evaluateDifficulty';

const CELL_SIZE = 32;
const MIN_SIZE = 2;
const MAX_SIZE = 50;

type UiRefs = {
    root: HTMLDivElement;
    boardGrid: HTMLDivElement;
    boardScroll: HTMLDivElement;
    widthInput: HTMLInputElement;
    heightInput: HTMLInputElement;
    applySizeBtn: HTMLButtonElement;
    startBtn: HTMLButtonElement;
    copyBtn: HTMLButtonElement;
    status: HTMLDivElement;
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
    private ui?: UiRefs;

    constructor() {
        super('Game');
    }

    create() {
        this.cells = this.createCells(this.widthCells * this.heightCells);
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
            status: root.querySelector('[data-role="status"]') as HTMLDivElement,
            rank: root.querySelector('[data-role="rank"]') as HTMLDivElement,
            evidence: root.querySelector('[data-role="evidence"]') as HTMLDivElement,
            logical: root.querySelector('[data-role="logical"]') as HTMLDivElement
        };

        this.bindUiEvents();
        this.onResize();
        this.renderAll();

        this.scale.on('resize', this.onResize, this);
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
            <div class="editmin-status" data-role="status"></div>
            <hr />
            <div class="editmin-metric" data-role="rank">ランク: 未評価</div>
            <div class="editmin-metric" data-role="logical">論理解法可否: 未評価</div>
            <div class="editmin-metric" data-role="evidence">根拠値: 未評価</div>
            <p class="editmin-help">左クリック: 爆弾トグル / 開始マス指定モード中は開始マス設定</p>
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

        this.ui.copyBtn.addEventListener('click', async () => {
            const text = this.toBoardText();
            const copied = await this.copyTextToClipboard(text);
            this.setStatus(copied ? '盤面テキストをクリップボードにコピーしました。' : 'コピーに失敗しました。');
        });
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

        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch {
            copied = false;
        }

        document.body.removeChild(textarea);
        return copied;
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

    private indexToXY(index: number): { x: number; y: number } {
        return {
            x: index % this.widthCells,
            y: Math.floor(index / this.widthCells)
        };
    }

    private getNeighbors(index: number): number[] {
        const { x, y } = this.indexToXY(index);
        const out: number[] = [];

        for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) {
                    continue;
                }
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= this.widthCells || ny >= this.heightCells) {
                    continue;
                }
                out.push(ny * this.widthCells + nx);
            }
        }

        return out;
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

    private onCellClick(index: number): void {
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
        grid.style.gridTemplateColumns = `repeat(${this.widthCells}, ${CELL_SIZE}px)`;
        grid.style.gridTemplateRows = `repeat(${this.heightCells}, ${CELL_SIZE}px)`;

        const forbidden = this.startIndex === null ? new Set<number>() : this.getForbiddenSet(this.startIndex);

        for (let i = 0; i < this.cells.length; i += 1) {
            const cellBtn = document.createElement('button');
            cellBtn.className = 'editmin-cell';
            if (this.startIndex === i) {
                cellBtn.classList.add('start');
            }
            if (forbidden.has(i)) {
                cellBtn.classList.add('forbidden');
            }
            if (this.cells[i].hasMine) {
                cellBtn.classList.add('mine');
                cellBtn.textContent = 'B';
            } else {
                const count = this.computeAdjacentMineCount(i);
                cellBtn.textContent = String(count);
                if (count >= 1 && count <= 8) {
                    cellBtn.classList.add(`n${count}`);
                }
            }
            cellBtn.addEventListener('click', () => this.onCellClick(i));
            grid.appendChild(cellBtn);
        }
    }

    private renderAll(): void {
        this.renderBoard();
        this.updateAnalysis();
    }
}
