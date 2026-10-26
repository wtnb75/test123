import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allocate } from './allocate';
import { buildResultHtml } from './resultHtml';
import { VERDICT_AT_OR_ABOVE, VERDICT_BELOW } from './profit';

function render(odds: number[], totalUnits: number, unitPrice = 100): string {
    return buildResultHtml(allocate({ odds, totalUnits, unitPrice }), unitPrice);
}

function rowsOf(html: string): string[] {
    return html.match(/<tr[^>]*>(?:(?!<\/tr>).)*<\/tr>/g)?.filter((row) => row.includes('<td>')) ?? [];
}

describe('buildResultHtml table', () => {
    it('has five column headers in order, with the short payout header', () => {
        const html = render([2, 2], 10);
        expect(html).toContain('<th>倍率</th><th>口数</th><th>払戻</th><th>回収率</th><th>損益(円)</th>');
        expect(html).not.toContain('払戻見込み額');
    });

    it('shows break-even rows as +0 without the loss class or badge ([2, 2], 10 units: 5/5, payout 1000, invested 1000)', () => {
        const rows = rowsOf(render([2, 2], 10));
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row).toContain('<td>5</td><td>1000</td><td>100.0%</td><td>+0</td>');
            expect(row).not.toContain('dutchcalc-loss');
            expect(row).not.toContain('元本割れ');
        }
    });

    it('marks every row of a losing allocation ([1.5, 1.5], 10 units: payout 750, invested 1000, profit -250)', () => {
        const rows = rowsOf(render([1.5, 1.5], 10));
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row).toContain('class="dutchcalc-loss"');
            expect(row).toContain('<td>750</td><td>75.0%</td><td>-250<span class="dutchcalc-loss-badge">▼元本割れ</span></td>');
        }
    });

    it('marks only the losing row ([2, 2], 11 units: 6/5 gives +100 and -100)', () => {
        const rows = rowsOf(render([2, 2], 11));
        expect(rows[0]).toContain('<td>6</td><td>1200</td>');
        expect(rows[0]).toContain('+100</td>');
        expect(rows[0]).not.toContain('dutchcalc-loss');
        expect(rows[1]).toContain('<td>5</td><td>1000</td>');
        expect(rows[1]).toContain('class="dutchcalc-loss"');
        expect(rows[1]).toContain('-100<span class="dutchcalc-loss-badge">▼元本割れ</span>');
    });
});

describe('buildResultHtml payouts cut down to 10 yen per 100 yen', () => {
    // Odds 2.35 pays 230 yen per 100 yen (235 cut down), so 1 unit at 100 yen pays 230.
    it('shows 230 for 2.35 against 200 invested, +30 and 115.0% (one unit each)', () => {
        const rows = rowsOf(render([2.35, 2], 2));
        expect(rows[0]).toContain('<td>230</td><td>115.0%</td><td>+30</td>');
        expect(rows[1]).toContain('<td>200</td><td>100.0%</td><td>+0</td>');
        expect(rows[1]).not.toContain('dutchcalc-loss');
    });

    it('does not lose 10 yen to floating-point error: 2.3 pays 230, not 220', () => {
        const rows = rowsOf(render([2.3, 2], 2));
        expect(rows[0]).toContain('<td>230</td><td>115.0%</td><td>+30</td>');
    });

    it('scales with the unit price: 2.35 at 200 yen per unit pays 460 against 400 invested', () => {
        const rows = rowsOf(render([2.35, 2], 2, 200));
        expect(rows[0]).toContain('<td>460</td><td>115.0%</td><td>+60</td>');
        expect(rows[1]).toContain('<td>400</td><td>100.0%</td><td>+0</td>');
    });

    it('shows the summary from the cut-down payouts: min 200, max 230, balance 30', () => {
        expect(render([2.35, 2], 2)).toMatch(/最小払戻: 200円 \/\s+最大払戻: 230円 \/\s+バランス度\(差\): 30円/);
    });
});

describe('buildResultHtml summary', () => {
    it('keeps the four existing summary items with their wording', () => {
        const html = render([2, 2], 10);
        expect(html).toMatch(
            /合計投資額: 1000円 \/\s+最小払戻: 1000円 \/\s+最大払戻: 1000円 \/\s+バランス度\(差\): 0円/
        );
    });

    it('puts the table, summary, rate line and verdict line in that order', () => {
        const html = render([2, 2], 10);
        const order = ['dutchcalc-table-wrap', 'dutchcalc-summary">', 'dutchcalc-rate', 'dutchcalc-verdict'].map((key) =>
            html.indexOf(key)
        );
        expect(order.every((index) => index >= 0)).toBe(true);
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it('shows 75.0% and the below-100% sentence for [1.5, 1.5]', () => {
        const html = render([1.5, 1.5], 10);
        expect(html).toContain('理論回収率 75.0%');
        expect(html).toContain(VERDICT_BELOW);
        expect(html).not.toContain(VERDICT_AT_OR_ABOVE);
    });

    it('shows 133.3% and the at-or-above sentence for [2, 4]', () => {
        const html = render([2, 4], 10);
        expect(html).toContain('理論回収率 133.3%');
        expect(html).toContain(VERDICT_AT_OR_ABOVE);
    });

    it('keeps the at-or-above sentence even when the shown allocation has a loss row ([2, 2], 11 units)', () => {
        const html = render([2, 2], 11);
        expect(html).toContain('理論回収率 100.0%');
        expect(html).toContain(VERDICT_AT_OR_ABOVE);
        expect(html).toContain('dutchcalc-loss-badge');
    });
});

describe('narrow-screen stylesheet', () => {
    const css = readFileSync(new URL('../../../public/style.css', import.meta.url), 'utf8');
    const queryStart = css.indexOf('@media (max-width: 480px)');
    const outside = css.slice(0, queryStart);
    const inside = css.slice(queryStart);

    it('has a max-width 480px media query', () => {
        expect(queryStart).toBeGreaterThan(-1);
    });

    it('sets the 8px root and 12px panel padding only inside the media query', () => {
        expect(inside).toMatch(/\.dutchcalc-root\s*{\s*padding: 8px;/);
        expect(inside).toMatch(/\.dutchcalc-panel\s*{\s*padding: 12px;/);
        expect(outside).toMatch(/\.dutchcalc-root\s*{[^}]*padding: 24px;/);
        expect(outside).toMatch(/\.dutchcalc-panel\s*{[^}]*padding: 20px;/);
    });

    it('keeps the wide-screen panel width and cell padding outside the media query', () => {
        expect(outside).toContain('width: min(560px, 100%);');
        expect(outside).toMatch(/\.dutchcalc-table td\s*{\s*border: 1px solid var\(--line\);\s*padding: 4px 8px;/);
        expect(inside).toMatch(/\.dutchcalc-table td\s*{\s*padding: 4px;/);
    });
});

describe('余り（予算入力のあるときだけ、サマリーの行の後ろに出す）', () => {
    // odds [2, 2] with 10 units at 100 yen: 5 / 5, both payouts 1,000, so the balance is 0 円
    const allocation = () => allocate({ odds: [2, 2], totalUnits: 10, unitPrice: 100 });

    it('余りを渡すと、サマリーの行の後ろに「余り xx 円」が続く', () => {
        const html = buildResultHtml(allocation(), 100, 50);
        expect(html).toContain('バランス度(差): 0円 / 余り 50 円');
    });

    it('余りを渡さない（予算が空）ときは、余りの文字は出ない', () => {
        const html = buildResultHtml(allocation(), 100);
        expect(html).not.toContain('余り');
    });
});
