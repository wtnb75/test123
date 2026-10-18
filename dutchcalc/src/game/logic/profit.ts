// Percent (as shown, rounded with toFixed(1)) at or above which a break-even allocation is possible.
export const BREAK_EVEN_PERCENT = 100;

export const VERDICT_BELOW = 'どの配分でも、少なくとも 1 つの候補が元本割れになります（円未満の丸めを除く）';
export const VERDICT_AT_OR_ABOVE =
    '理論上は元本割れを避けられます（口数が整数のため、表の配分では元本割れが残ることがあります）';

// Profit in whole yen, from the rounded payout and the rounded investment.
export function profitOf(payout: number, totalInvestment: number): number {
    return Math.round(payout) - Math.round(totalInvestment);
}

// Only a negative profit is a loss: exactly 0 is break-even.
export function isLoss(profit: number): boolean {
    return profit < 0;
}

export function formatProfit(profit: number): string {
    return profit >= 0 ? `+${profit}` : `${profit}`;
}

// Best return rate reachable when payouts are perfectly equal: 1 / sum(1 / odds).
export function theoreticalReturnRate(odds: number[]): number {
    return 1 / odds.reduce((total, o) => total + 1 / o, 0);
}

export function formatPercent(rate: number): string {
    return (rate * 100).toFixed(1);
}

// Judged on the displayed (rounded) percentage so the text and the verdict always agree.
export function verdictOf(rate: number): string {
    return Number(formatPercent(rate)) >= BREAK_EVEN_PERCENT ? VERDICT_AT_OR_ABOVE : VERDICT_BELOW;
}
