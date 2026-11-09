import { Scene } from 'phaser';
import { MAX_CANDIDATES, MAX_TOTAL_UNITS, MIN_CANDIDATES } from '../logic/allocate';
import { buildResultHtml } from '../logic/resultHtml';
import { budgetFromUnits, parseBudget, unitsFromBudget } from '../logic/budget';
import { decideCalc, type CalcMode } from '../logic/liveCalc';

type UiRefs = {
    root: HTMLDivElement;
    candidateList: HTMLDivElement;
    addBtn: HTMLButtonElement;
    totalUnitsInput: HTMLInputElement;
    budgetInput: HTMLInputElement;
    unitPriceInput: HTMLInputElement;
    calculateBtn: HTMLButtonElement;
    error: HTMLDivElement;
    staleNote: HTMLDivElement;
    result: HTMLDivElement;
};

export class Game extends Scene {
    private oddsValues: string[] = ['', ''];
    private ui?: UiRefs;
    // true while a result is on screen (a failed auto calculation keeps it and shows a notice)
    private hasResult = false;

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
            budgetInput: root.querySelector('[data-role="budget"]') as HTMLInputElement,
            unitPriceInput: root.querySelector('[data-role="unit-price"]') as HTMLInputElement,
            calculateBtn: root.querySelector('[data-role="calculate"]') as HTMLButtonElement,
            error: root.querySelector('[data-role="error"]') as HTMLDivElement,
            staleNote: root.querySelector('[data-role="stale-note"]') as HTMLDivElement,
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
              <label>予算（円）</label>
              <input data-role="budget" type="number" min="0" step="100" max="${MAX_TOTAL_UNITS * 100}" />
            </div>
            <div class="dutchcalc-row">
              <label>1口あたり金額</label>
              <input data-role="unit-price" type="number" min="100" step="100" value="100" />
            </div>
            <button class="dutchcalc-btn dutchcalc-btn-primary" data-role="calculate">計算</button>
            <div class="dutchcalc-error" data-role="error"></div>
            <div class="dutchcalc-stale" data-role="stale-note" hidden>入力が無効です。下は直前の有効な入力の結果です</div>
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
            this.runCalculation('button');
        });

        // Every edit of a field recalculates; the budget and units links below also recalculate.
        for (const input of [this.ui.totalUnitsInput, this.ui.budgetInput, this.ui.unitPriceInput]) {
            input.addEventListener('input', () => {
                this.runCalculation('auto');
            });
        }

        // Budget and units are linked both ways when either changes (the link itself does not calculate).
        this.ui.budgetInput.addEventListener('change', () => {
            const budget = parseBudget(this.ui?.budgetInput.value ?? '');
            const unitPrice = Number(this.ui?.unitPriceInput.value);
            if (budget === null || this.ui === undefined) {
                return;
            }
            const units = unitsFromBudget(budget, unitPrice);
            if (units !== null) {
                this.ui.totalUnitsInput.value = String(units);
                this.runCalculation('auto');
            }
        });

        this.ui.totalUnitsInput.addEventListener('change', () => {
            const units = parseBudget(this.ui?.totalUnitsInput.value ?? '');
            const unitPrice = Number(this.ui?.unitPriceInput.value);
            if (units === null || this.ui === undefined) {
                return;
            }
            this.ui.budgetInput.value = String(budgetFromUnits(units, unitPrice));
            this.runCalculation('auto');
        });

        // The budget's upper limit follows the unit price (the unit count's limit times the price).
        this.ui.unitPriceInput.addEventListener('change', () => {
            if (this.ui === undefined) {
                return;
            }
            const unitPrice = Number(this.ui.unitPriceInput.value);
            if (Number.isFinite(unitPrice) && unitPrice > 0) {
                this.ui.budgetInput.max = String(MAX_TOTAL_UNITS * unitPrice);
            }
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
                this.runCalculation('auto');
            });
            input.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' || event.isComposing) {
                    return;
                }
                event.preventDefault();
                this.focusNextOdds(index);
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
                this.runCalculation('auto');
            });

            row.appendChild(label);
            row.appendChild(input);
            row.appendChild(removeBtn);
            list.appendChild(row);
        });

        this.ui.addBtn.disabled = this.oddsValues.length >= MAX_CANDIDATES;
    }

    // Enter in an odds field: move to the next row, or add a row after the last one (up to the limit).
    private focusNextOdds(index: number): void {
        if (!this.ui) {
            return;
        }
        if (index === this.oddsValues.length - 1) {
            if (this.oddsValues.length >= MAX_CANDIDATES) {
                return;
            }
            this.oddsValues.push('');
            this.renderCandidates();
        }
        const inputs = this.ui.candidateList.querySelectorAll<HTMLInputElement>('[data-role="odds-input"]');
        inputs[index + 1]?.focus();
    }

    // `auto` (every edit) leaves the screen alone while a field is blank and keeps the last result when
    // the input is invalid; `button` always shows the error and clears the result.
    private runCalculation(mode: CalcMode): void {
        if (!this.ui) {
            return;
        }

        const outcome = decideCalc(
            {
                oddsTexts: this.oddsValues,
                totalUnitsText: this.ui.totalUnitsInput.value,
                unitPriceText: this.ui.unitPriceInput.value,
                budgetText: this.ui.budgetInput.value
            },
            mode
        );

        if (outcome.kind === 'incomplete') {
            return;
        }
        if (outcome.kind === 'ok') {
            this.ui.error.textContent = '';
            this.ui.staleNote.hidden = true;
            this.ui.result.innerHTML = buildResultHtml(outcome.result, outcome.unitPrice, outcome.remainder);
            this.hasResult = true;
            return;
        }

        this.ui.error.textContent = outcome.message;
        if (mode === 'button') {
            this.ui.result.innerHTML = '';
            this.hasResult = false;
        }
        this.ui.staleNote.hidden = !this.hasResult;
    }

    private onResize(): void {
        if (!this.ui) {
            return;
        }
        this.ui.root.style.width = `${this.scale.width}px`;
        this.ui.root.style.height = `${this.scale.height}px`;
    }
}
