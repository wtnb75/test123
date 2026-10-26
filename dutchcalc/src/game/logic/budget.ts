// Budget (yen) ↔ units for the budget input. Pure: the Scene only reads and writes the two inputs.

/** The budget as an integer yen amount, or null when the text is empty or not an integer. */
export function parseBudget(text: string): number | null {
    if (text.trim() === '') {
        return null;
    }
    const value = Number(text);
    return Number.isInteger(value) ? value : null;
}

/** Units a budget buys at a unit price, rounded down; null when it cannot be computed. */
export function unitsFromBudget(budget: number, unitPrice: number): number | null {
    if (!Number.isFinite(budget) || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        return null;
    }
    return Math.floor(budget / unitPrice);
}

/** Budget (yen) that a unit count costs at a unit price. */
export function budgetFromUnits(units: number, unitPrice: number): number {
    return units * unitPrice;
}

/** The yen left over: the budget minus the total investment. */
export function remainderOf(budget: number, totalInvestment: number): number {
    return budget - totalInvestment;
}

/** The leftover as shown in the summary, e.g. `余り 50 円` (no thousands separator). */
export function formatRemainder(yen: number): string {
    return `余り ${yen} 円`;
}
