// Decides what a calculation does with the current form values. Pure: the Scene only reads the
// inputs, calls decideCalc() and updates the DOM from the outcome.

import { allocate, type AllocationResult } from './allocate';
import { parseBudget, remainderOf } from './budget';

/** `auto`: run on every input, blank fields mean "not finished". `button`: the 計算 button, blank fields are errors. */
export type CalcMode = 'auto' | 'button';

export interface CalcInput {
    oddsTexts: string[];
    totalUnitsText: string;
    unitPriceText: string;
    budgetText: string;
}

export type CalcOutcome =
    | { kind: 'incomplete' }
    | { kind: 'ok'; result: AllocationResult; unitPrice: number; remainder?: number }
    | { kind: 'invalid'; message: string };

const isBlank = (text: string): boolean => text.trim() === '';

/** True when an auto calculation has to wait: a required field is still empty. */
function isIncomplete(input: CalcInput): boolean {
    return input.oddsTexts.some(isBlank) || isBlank(input.totalUnitsText) || isBlank(input.unitPriceText);
}

/** Never throws: an error from allocate() becomes `invalid` with its message. */
export function decideCalc(input: CalcInput, mode: CalcMode): CalcOutcome {
    if (mode === 'auto' && isIncomplete(input)) {
        return { kind: 'incomplete' };
    }

    const unitPrice = Number(input.unitPriceText);
    try {
        const result = allocate({
            odds: input.oddsTexts.map((text) => Number(text)),
            totalUnits: Number(input.totalUnitsText),
            unitPrice
        });
        // the leftover is shown only when a budget was entered
        const budget = parseBudget(input.budgetText);
        const remainder = budget === null ? undefined : remainderOf(budget, result.totalInvestment);
        return { kind: 'ok', result, unitPrice, remainder };
    } catch (err) {
        return { kind: 'invalid', message: err instanceof Error ? err.message : String(err) };
    }
}
