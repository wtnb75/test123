import type { AllocationResult, CandidateResult } from './allocate';
import { formatPercent, formatProfit, isLoss, profitOf, theoreticalReturnRate, verdictOf } from './profit';

function rowHtml(c: CandidateResult, totalInvestment: number): string {
    const profit = profitOf(c.payout, totalInvestment);
    const loss = isLoss(profit);
    const badge = loss ? '<span class="dutchcalc-loss-badge">▼元本割れ</span>' : '';
    const rowClass = loss ? ' class="dutchcalc-loss"' : '';

    return (
        `<tr${rowClass}><td>${c.odds}</td><td>${c.units}</td><td>${Math.round(c.payout)}</td>` +
        `<td>${formatPercent(c.returnRate)}%</td><td>${formatProfit(profit)}${badge}</td></tr>`
    );
}

export function buildResultHtml(result: AllocationResult): string {
    const rows = result.candidates.map((c) => rowHtml(c, result.totalInvestment)).join('');
    const rate = theoreticalReturnRate(result.candidates.map((c) => c.odds));

    return `
        <div class="dutchcalc-table-wrap">
        <table class="dutchcalc-table">
          <thead><tr><th>倍率</th><th>口数</th><th>払戻</th><th>回収率</th><th>損益(円)</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        </div>
        <div class="dutchcalc-summary">
          合計投資額: ${Math.round(result.totalInvestment)}円 /
          最小払戻: ${Math.round(result.minPayout)}円 /
          最大払戻: ${Math.round(result.maxPayout)}円 /
          バランス度(差): ${Math.round(result.spread)}円
        </div>
        <div class="dutchcalc-summary dutchcalc-rate">理論回収率 ${formatPercent(rate)}%</div>
        <div class="dutchcalc-summary dutchcalc-verdict">${verdictOf(rate)}</div>`;
}
