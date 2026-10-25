import type { AllocationResult, CandidateResult } from './allocate';
import { formatPercent, formatProfit, isLoss, payoutFor, profitOf, theoreticalReturnRate, verdictOf } from './profit';

function rowHtml(c: CandidateResult, payout: number, totalInvestment: number): string {
    const profit = profitOf(payout, totalInvestment);
    const loss = isLoss(profit);
    const badge = loss ? '<span class="dutchcalc-loss-badge">▼元本割れ</span>' : '';
    const rowClass = loss ? ' class="dutchcalc-loss"' : '';

    return (
        `<tr${rowClass}><td>${c.odds}</td><td>${c.units}</td><td>${payout}</td>` +
        `<td>${formatPercent(payout / totalInvestment)}%</td><td>${formatProfit(profit)}${badge}</td></tr>`
    );
}

// Every amount shown here uses the payout cut down to 10 yen per 100 yen. The allocation itself
// was made on the uncut payouts, so the shown spread can differ from the one it minimised.
export function buildResultHtml(result: AllocationResult, unitPrice: number): string {
    const { totalInvestment } = result;
    const payouts = result.candidates.map((c) => payoutFor(c.odds, c.units, unitPrice));
    const minPayout = Math.min(...payouts);
    const maxPayout = Math.max(...payouts);
    const rows = result.candidates.map((c, i) => rowHtml(c, payouts[i], totalInvestment)).join('');
    const rate = theoreticalReturnRate(result.candidates.map((c) => c.odds));

    return `
        <div class="dutchcalc-table-wrap">
        <table class="dutchcalc-table">
          <thead><tr><th>倍率</th><th>口数</th><th>払戻</th><th>回収率</th><th>損益(円)</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        </div>
        <div class="dutchcalc-summary">
          合計投資額: ${totalInvestment}円 /
          最小払戻: ${minPayout}円 /
          最大払戻: ${maxPayout}円 /
          バランス度(差): ${maxPayout - minPayout}円
        </div>
        <div class="dutchcalc-summary dutchcalc-rate">理論回収率 ${formatPercent(rate)}%</div>
        <div class="dutchcalc-summary dutchcalc-verdict">${verdictOf(rate)}</div>`;
}
