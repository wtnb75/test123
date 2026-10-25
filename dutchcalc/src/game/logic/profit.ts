// Percent (as shown, rounded with toFixed(1)) at or above which a break-even allocation is possible.
export const BREAK_EVEN_PERCENT = 100;

export const VERDICT_BELOW = 'どの配分でも、少なくとも 1 つの候補が元本割れになります（円未満の丸めを除く）';
export const VERDICT_AT_OR_ABOVE =
    '理論上は元本割れを避けられます（口数が整数のため、表の配分では元本割れが残ることがあります）';

// Payout for 100 yen on one candidate, cut down to a multiple of 10 yen. The product is rounded to
// 6 decimals first, so 2.3 * 100 = 229.99999999999997 is read as 230 and not 220.
export function payoutPer100Yen(odds: number): number {
    const exact = Math.round(odds * 100 * 1e6) / 1e6;
    return Math.floor(exact / 10) * 10;
}

// Payout in whole yen for `units` units at `unitPrice` yen each (a multiple of 100).
export function payoutFor(odds: number, units: number, unitPrice: number): number {
    return units * (unitPrice / 100) * payoutPer100Yen(odds);
}

// Profit in whole yen: the payout minus the total investment.
export function profitOf(payout: number, totalInvestment: number): number {
    return payout - totalInvestment;
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
