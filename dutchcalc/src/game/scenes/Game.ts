import { Scene } from 'phaser';
import { allocate, MAX_CANDIDATES, MAX_TOTAL_UNITS, MIN_CANDIDATES, type AllocationResult } from '../logic/allocate';
import { buildResultHtml } from '../logic/resultHtml';

type UiRefs = {
    root: HTMLDivElement;
    candidateList: HTMLDivElement;
    addBtn: HTMLButtonElement;
    totalUnitsInput: HTMLInputElement;
    unitPriceInput: HTMLInputElement;
    calculateBtn: HTMLButtonElement;
    error: HTMLDivElement;
    result: HTMLDivElement;
};

export class Game extends Scene {
    private oddsValues: string[] = ['', ''];
    private ui?: UiRefs;

    constructor() {
        super('Game');
    }

    create() {
        this.cameras.main.setBackgroundColor(0xf4f1e8);

        const el = this.add.dom(0, 0).createFromHTML(this.buildRootHtml()) as Phaser.GameObjects.DOMElement;
        el.setOrigin(0, 0);
        el.setDepth(10);

        const root = el.node as HTMLDivElement;
        this.ui = {
            root,
            candidateList: root.querySelector('[data-role="candidate-list"]') as HTMLDivElement,
            addBtn: root.querySelector('[data-role="add-candidate"]') as HTMLButtonElement,
            totalUnitsInput: root.querySelector('[data-role="total-units"]') as HTMLInputElement,
            unitPriceInput: root.querySelector('[data-role="unit-price"]') as HTMLInputElement,
            calculateBtn: root.querySelector('[data-role="calculate"]') as HTMLButtonElement,
            error: root.querySelector('[data-role="error"]') as HTMLDivElement,
            result: root.querySelector('[data-role="result"]') as HTMLDivElement
        };

        this.bindUiEvents();
        this.renderCandidates();
        this.onResize();
        this.scale.on('resize', this.onResize, this);
    }

    private buildRootHtml(): string {
        return `
        <div class="dutchcalc-root" data-role="root">
          <div class="dutchcalc-panel">
            <h1>dutchcalc</h1>
            <div class="dutchcalc-candidates" data-role="candidate-list"></div>
            <button class="dutchcalc-btn" data-role="add-candidate">候補を追加</button>
            <div class="dutchcalc-row">
              <label>合計口数</label>
              <input data-role="total-units" type="number" min="1" max="${MAX_TOTAL_UNITS}" step="1" value="10" />
            </div>
            <div class="dutchcalc-row">
              <label>1口あたり金額</label>
              <input data-role="unit-price" type="number" min="100" step="100" value="100" />
            </div>
            <button class="dutchcalc-btn dutchcalc-btn-primary" data-role="calculate">計算</button>
            <div class="dutchcalc-error" data-role="error"></div>
            <div class="dutchcalc-result" data-role="result"></div>
          </div>
        </div>`;
    }

    private bindUiEvents(): void {
        if (!this.ui) {
            return;
        }

        this.ui.addBtn.addEventListener('click', () => {
            if (this.oddsValues.length >= MAX_CANDIDATES) {
                return;
            }
            this.oddsValues.push('');
            this.renderCandidates();
        });

        this.ui.calculateBtn.addEventListener('click', () => {
            this.runCalculation();
        });
    }

    private renderCandidates(): void {
        if (!this.ui) {
            return;
        }

        const list = this.ui.candidateList;
        list.innerHTML = '';

        this.oddsValues.forEach((value, index) => {
            const row = document.createElement('div');
            row.className = 'dutchcalc-candidate-row';

            const label = document.createElement('label');
            label.textContent = '倍率';

            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.1';
            input.min = '1.01';
            input.value = value;
            input.dataset.role = 'odds-input';
            input.addEventListener('input', () => {
                this.oddsValues[index] = input.value;
            });

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '削除';
            removeBtn.dataset.role = 'remove-candidate';
            removeBtn.disabled = this.oddsValues.length <= MIN_CANDIDATES;
            removeBtn.addEventListener('click', () => {
                if (this.oddsValues.length <= MIN_CANDIDATES) {
                    return;
                }
                this.oddsValues.splice(index, 1);
                this.renderCandidates();
            });

            row.appendChild(label);
            row.appendChild(input);
            row.appendChild(removeBtn);
            list.appendChild(row);
        });

        this.ui.addBtn.disabled = this.oddsValues.length >= MAX_CANDIDATES;
    }

    private runCalculation(): void {
        if (!this.ui) {
            return;
        }

        this.ui.error.textContent = '';
        this.ui.result.innerHTML = '';

        const odds = this.oddsValues.map((v) => Number(v));
        const totalUnits = Number(this.ui.totalUnitsInput.value);
        const unitPrice = Number(this.ui.unitPriceInput.value);

        try {
            const result = allocate({ odds, totalUnits, unitPrice });
            this.renderResult(result, unitPrice);
        } catch (err) {
            this.ui.error.textContent = err instanceof Error ? err.message : String(err);
        }
    }

    private renderResult(result: AllocationResult, unitPrice: number): void {
        if (!this.ui) {
            return;
        }

        this.ui.result.innerHTML = buildResultHtml(result, unitPrice);
    }

    private onResize(): void {
        if (!this.ui) {
            return;
        }
        this.ui.root.style.width = `${this.scale.width}px`;
        this.ui.root.style.height = `${this.scale.height}px`;
    }
}
