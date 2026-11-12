import { describe, expect, it } from 'vitest';
import {
    APPLY_LABEL,
    UNDO_LABEL,
    buildProposalHtml,
    buildRemovedHtml,
    parseOddsTexts,
    proposeSubset
} from './subset';

describe('proposeSubset (expected values worked out by hand)', () => {
    it('drops the single lowest-odds candidate for [1.5, 2, 3, 10] (62.5% -> 107.1%)', () => {
        const proposal = proposeSubset([1.5, 2, 3, 10]);
        expect(proposal.kind).toBe('propose');
        if (proposal.kind !== 'propose') {
            return;
        }
        expect(proposal.removeIndexes).toEqual([0]);
        expect(proposal.removedOdds).toEqual([1.5]);
        // 1 / (1/2 + 1/3 + 1/10) = 1 / 0.93333 = 1.0714
        expect(proposal.rate).toBeCloseTo(1.0714, 4);
    });

    it('drops the earlier row first when odds are equal ([2, 2, 2] -> drop row 0, leaving exactly 100.0%)', () => {
        const proposal = proposeSubset([2, 2, 2]);
        expect(proposal).toMatchObject({ kind: 'propose', removeIndexes: [0], removedOdds: [2] });
        if (proposal.kind === 'propose') {
            expect(proposal.rate).toBeCloseTo(1, 10);
        }
    });

    it('drops two candidates when one is not enough ([1.5, 1.5, 3, 6]: 85.7% after one, 200.0% after two)', () => {
        const proposal = proposeSubset([1.5, 1.5, 3, 6]);
        expect(proposal).toMatchObject({ kind: 'propose', removeIndexes: [0, 1], removedOdds: [1.5, 1.5] });
        if (proposal.kind === 'propose') {
            expect(proposal.rate).toBeCloseTo(2, 10);
        }
    });

    it('is unreachable for [1.5, 1.5, 1.5] and reports the best two-candidate rate 75.0%', () => {
        const proposal = proposeSubset([1.5, 1.5, 1.5]);
        expect(proposal.kind).toBe('unreachable');
        if (proposal.kind === 'unreachable') {
            expect(proposal.maxRate).toBeCloseTo(0.75, 10);
        }
    });

    it('is unreachable for exactly two candidates ([1.5, 1.5]: nothing can be dropped)', () => {
        const proposal = proposeSubset([1.5, 1.5]);
        expect(proposal.kind).toBe('unreachable');
        if (proposal.kind === 'unreachable') {
            expect(proposal.maxRate).toBeCloseTo(0.75, 10);
        }
    });

    it('proposes nothing when the rate already reads 100.0% or more ([2, 2] and [2, 4])', () => {
        expect(proposeSubset([2, 2])).toEqual({ kind: 'none' });
        expect(proposeSubset([2, 4])).toEqual({ kind: 'none' });
    });

    it('proposes nothing for fewer than two candidates', () => {
        // A single candidate's rate equals its odds (above 100%), so the count guard is equivalent to the rate
        // check for it; the test pins the result either way.
        expect(proposeSubset([1.5])).toEqual({ kind: 'none' });
        expect(proposeSubset([])).toEqual({ kind: 'none' });
    });

    it('reports the best two candidates (highest odds), not the lowest, as the unreachable maximum ([1.2, 1.5, 1.8] -> 81.8%)', () => {
        const proposal = proposeSubset([1.2, 1.5, 1.8]);
        expect(proposal.kind).toBe('unreachable');
        if (proposal.kind === 'unreachable') {
            // 1 / (1/1.5 + 1/1.8) = 1 / 1.22222 = 0.81818
            expect(proposal.maxRate).toBeCloseTo(0.81818, 4);
        }
    });

    it('sums the kept odds in row order, like the result table (float sums differ by order: [4.6, 2.3, 3.8])', () => {
        const proposal = proposeSubset([1.2, 4.6, 2.3, 3.8]);
        expect(proposal).toMatchObject({ kind: 'propose', removeIndexes: [0] });
        if (proposal.kind === 'propose') {
            // The sum in row order reads 109.3% (in ascending-odds order it would read 109.2%).
            expect(proposal.rate).toBe(1 / (1 / 4.6 + 1 / 2.3 + 1 / 3.8));
            expect((proposal.rate * 100).toFixed(1)).toBe('109.3');
        }
    });

    it('judges the break-even on the rounded rate when dropping rows: 99.96% after the drop reads 100.0% (proposal)', () => {
        const b = 1 / (1 / 0.9996 - 1 / 2); // [2, b] has rate 0.9996
        const proposal = proposeSubset([1.5, 2, b]);
        expect(proposal).toMatchObject({ kind: 'propose', removeIndexes: [0], removedOdds: [1.5] });
        if (proposal.kind === 'propose') {
            expect(proposal.rate).toBeLessThan(1);
            expect((proposal.rate * 100).toFixed(1)).toBe('100.0');
        }
    });

    it('stays unreachable when the best rate after the drop reads 99.9% ([1.5, 2, b] with [2, b] at 0.9994)', () => {
        const b = 1 / (1 / 0.9994 - 1 / 2);
        const proposal = proposeSubset([1.5, 2, b]);
        expect(proposal.kind).toBe('unreachable');
        if (proposal.kind === 'unreachable') {
            expect(proposal.maxRate).toBeCloseTo(0.9994, 6);
        }
    });

    it('judges on the displayed percentage for two candidates: 99.96% reads 100.0% (nothing), 99.94% is unreachable', () => {
        // sum of reciprocals 1/0.9996 and 1/0.9994 are reached by [a, b] with 1/a + 1/b = that sum.
        const reachable = (rate: number): number[] => {
            const sum = 1 / rate;
            const a = 2;
            return [a, 1 / (sum - 1 / a)];
        };
        expect(proposeSubset(reachable(0.9996))).toEqual({ kind: 'none' });
        expect(proposeSubset(reachable(0.9994)).kind).toBe('unreachable');
    });

    it('returns the original row indexes in ascending order when the odds are not sorted ([10, 1.5, 3, 2])', () => {
        const proposal = proposeSubset([10, 1.5, 3, 2]);
        expect(proposal).toMatchObject({ kind: 'propose', removeIndexes: [1], removedOdds: [1.5] });
    });

    it('lists removed odds in row order, not in dropping order ([3, 1.5, 6, 1.5])', () => {
        const proposal = proposeSubset([3, 1.5, 6, 1.5]);
        expect(proposal).toMatchObject({ kind: 'propose', removeIndexes: [1, 3], removedOdds: [1.5, 1.5] });
    });

    it('does not throw for the limits (2 and 20 candidates, all odds equal)', () => {
        expect(() => proposeSubset([1.01, 1.01])).not.toThrow();
        expect(() => proposeSubset(new Array(20).fill(1.01))).not.toThrow();
        expect(proposeSubset(new Array(20).fill(20)).kind).toBe('none');
    });
});

describe('proposeSubset against a brute-force oracle', () => {
    // Small deterministic generator (mulberry32) so the cases never change between runs.
    function rng(seed: number): () => number {
        let state = seed;
        return () => {
            state = (state + 0x6d2b79f5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const percentOf = (odds: number[]): number => Number((100 / odds.reduce((s, o) => s + 1 / o, 0)).toFixed(1));

    // Fewest rows to drop over EVERY subset that keeps at least two candidates.
    function minDrops(odds: number[]): number | null {
        let best: number | null = null;
        for (let mask = 0; mask < 1 << odds.length; mask++) {
            const kept = odds.filter((_, i) => (mask >> i) & 1);
            if (kept.length < 2 || percentOf(kept) < 100) {
                continue;
            }
            const drops = odds.length - kept.length;
            if (best === null || drops < best) {
                best = drops;
            }
        }
        return best;
    }

    it('finds the fewest drops, drops only the lowest odds, and reports the right rate', () => {
        const random = rng(20240601);
        const seen = { none: 0, propose: 0, unreachable: 0 };
        for (let n = 0; n < 600; n++) {
            const count = 2 + Math.floor(random() * 7);
            const odds = Array.from({ length: count }, () => 1.1 + Math.round(random() * 90) / 10);
            const proposal = proposeSubset(odds);
            const oracle = minDrops(odds);
            seen[proposal.kind]++;
            if (percentOf(odds) >= 100) {
                if (proposal.kind !== 'none') {
                    expect.fail(`expected none for ${JSON.stringify(odds)}`);
                }
                continue;
            }
            if (oracle === null) {
                if (proposal.kind !== 'unreachable') {
                    expect.fail(`expected unreachable for ${JSON.stringify(odds)}`);
                }
                continue;
            }
            if (proposal.kind !== 'propose' || proposal.removeIndexes.length !== oracle) {
                expect.fail(`wrong drop count for ${JSON.stringify(odds)}: oracle ${oracle}`);
            }
            const keptOdds = odds.filter((_, i) => !proposal.removeIndexes.includes(i));
            if (percentOf(keptOdds) < 100) {
                expect.fail(`kept set does not reach 100.0% for ${JSON.stringify(odds)}`);
            }
            if (Math.max(...proposal.removedOdds) > Math.min(...keptOdds)) {
                expect.fail(`dropped a higher-odds row before a lower one for ${JSON.stringify(odds)}`);
            }
        }
        // Guard against a vacuous run: every outcome was exercised.
        expect(seen.none).toBeGreaterThan(0);
        expect(seen.propose).toBeGreaterThan(0);
        expect(seen.unreachable).toBeGreaterThan(0);
    });
});

describe('parseOddsTexts', () => {
    it('reads valid odds texts as numbers', () => {
        expect(parseOddsTexts(['1.5', ' 2 ', '10'])).toEqual([1.5, 2, 10]);
    });

    it('is null for an empty or blank field', () => {
        expect(parseOddsTexts(['2', ''])).toBeNull();
        expect(parseOddsTexts(['2', '  '])).toBeNull();
    });

    it('is null for odds of exactly 1.0 or below, but accepts 1.01', () => {
        expect(parseOddsTexts(['2', '1'])).toBeNull();
        expect(parseOddsTexts(['2', '0.5'])).toBeNull();
        expect(parseOddsTexts(['2', '1.01'])).toEqual([2, 1.01]);
    });

    it('is null for text that is not a finite number', () => {
        expect(parseOddsTexts(['2', 'abc'])).toBeNull();
        expect(parseOddsTexts(['2', 'Infinity'])).toBeNull();
    });
});

describe('buildProposalHtml', () => {
    it('shows the count, the odds, the rate and an apply button for a proposal', () => {
        const html = buildProposalHtml(proposeSubset([1.5, 2, 3, 10]));
        expect(html).toContain('候補 1 件（倍率 1.5）を外すと、理論回収率は 107.1% になります。');
        expect(html).toContain('外した候補が当たっても払戻はなく、当たる確率は下がります。外すかどうかは、あなたの判断です。');
        expect(html).toContain('class="dutchcalc-btn dutchcalc-subset-apply"');
        expect(html).toContain(`>${APPLY_LABEL}</button>`);
        expect(html).not.toContain('dutchcalc-subset-undo');
    });

    it('lists several removed odds separated by ", " in row order', () => {
        const html = buildProposalHtml(proposeSubset([3, 1.5, 6, 1.4]));
        expect(html).toContain('候補 2 件（倍率 1.5, 1.4）を外すと');
    });

    it('shows the unreachable sentence without a button', () => {
        const html = buildProposalHtml(proposeSubset([1.5, 1.5, 1.5]));
        expect(html).toContain('候補を 2 件に絞っても、理論回収率は 100.0% に届きません（最大 75.0%）。');
        expect(html).not.toContain('<button');
    });

    it('is empty when there is nothing to propose', () => {
        expect(buildProposalHtml({ kind: 'none' })).toBe('');
        expect(buildProposalHtml(proposeSubset([2, 2]))).toBe('');
    });
});

describe('buildRemovedHtml', () => {
    it('states how many rows were removed and offers the undo button', () => {
        const html = buildRemovedHtml(['1.5', '1.50']);
        expect(html).toContain('候補 2 件（倍率 1.5, 1.5）を外しました。');
        expect(html).toContain('class="dutchcalc-btn dutchcalc-subset-undo"');
        expect(html).toContain(`>${UNDO_LABEL}</button>`);
        expect(html).not.toContain('dutchcalc-subset-apply');
    });
});
