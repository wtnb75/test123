import { MIN_CANDIDATES } from './allocate';
import { BREAK_EVEN_PERCENT, formatPercent, theoreticalReturnRate } from './profit';

export type SubsetProposal =
    // The theoretical return rate already reads 100.0% or more: nothing to propose.
    | { kind: 'none' }
    // Drop these rows (ascending original indexes) to reach the break-even rate with the fewest drops.
    | { kind: 'propose'; removeIndexes: number[]; removedOdds: number[]; rate: number }
    // Even the best MIN_CANDIDATES candidates do not reach it; `maxRate` is their rate.
    | { kind: 'unreachable'; maxRate: number };

// Judged on the displayed (rounded) percentage, like the verdict line.
function reachesBreakEven(odds: number[]): boolean {
    return Number(formatPercent(theoreticalReturnRate(odds))) >= BREAK_EVEN_PERCENT;
}

// Reads the odds fields as numbers; null when any of them is not a finite number above 1.0.
export function parseOddsTexts(texts: string[]): number[] | null {
    const values: number[] = [];
    for (const text of texts) {
        const value = text.trim() === '' ? Number.NaN : Number(text);
        if (!Number.isFinite(value) || value <= 1) {
            return null;
        }
        values.push(value);
    }
    return values;
}

// Lowest odds go first (they raise the rate the most when dropped); equal odds drop the earlier row first.
export function proposeSubset(odds: number[]): SubsetProposal {
    const count = odds.length;
    if (count < MIN_CANDIDATES || reachesBreakEven(odds)) {
        return { kind: 'none' };
    }
    const order = odds.map((_, index) => index).sort((a, b) => odds[a] - odds[b] || a - b);
    for (let drop = 1; drop <= count - MIN_CANDIDATES; drop++) {
        const removeIndexes = order.slice(0, drop).sort((a, b) => a - b);
        // Kept odds stay in row order: the result table sums them that way, and float addition is order-dependent.
        const kept = odds.filter((_, index) => !removeIndexes.includes(index));
        if (reachesBreakEven(kept)) {
            return {
                kind: 'propose',
                removeIndexes,
                removedOdds: removeIndexes.map((index) => odds[index]),
                rate: theoreticalReturnRate(kept)
            };
        }
    }
    const bestIndexes = order.slice(count - MIN_CANDIDATES);
    const best = odds.filter((_, index) => bestIndexes.includes(index));
    return { kind: 'unreachable', maxRate: theoreticalReturnRate(best) };
}

function oddsList(odds: number[]): string {
    return odds.map((value) => String(value)).join(', ');
}

export const APPLY_LABEL = '提案を適用';
export const UNDO_LABEL = '元に戻す';

export function buildProposalHtml(proposal: SubsetProposal): string {
    if (proposal.kind === 'propose') {
        const text =
            `候補 ${proposal.removeIndexes.length} 件（倍率 ${oddsList(proposal.removedOdds)}）を外すと、` +
            `理論回収率は ${formatPercent(proposal.rate)}% になります。` +
            '外した候補が当たっても払戻はなく、当たる確率は下がります。外すかどうかは、あなたの判断です。';
        return (
            `<p class="dutchcalc-subset-text">${text}</p>` +
            `<button type="button" class="dutchcalc-btn dutchcalc-subset-apply">${APPLY_LABEL}</button>`
        );
    }
    if (proposal.kind === 'unreachable') {
        return (
            `<p class="dutchcalc-subset-text">候補を ${MIN_CANDIDATES} 件に絞っても、` +
            `理論回収率は 100.0% に届きません（最大 ${formatPercent(proposal.maxRate)}%）。</p>`
        );
    }
    return '';
}

// `removedTexts` are the odds fields of the dropped rows, in their original row order.
export function buildRemovedHtml(removedTexts: string[]): string {
    const odds = removedTexts.map((text) => Number(text));
    return (
        `<p class="dutchcalc-subset-text">候補 ${odds.length} 件（倍率 ${oddsList(odds)}）を外しました。</p>` +
        `<button type="button" class="dutchcalc-btn dutchcalc-subset-undo">${UNDO_LABEL}</button>`
    );
}
