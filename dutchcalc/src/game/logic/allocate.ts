export interface AllocateInput {
    odds: number[];
    totalUnits: number;
    unitPrice: number;
}

export interface CandidateResult {
    odds: number;
    units: number;
    payout: number;
    returnRate: number;
}

export interface AllocationResult {
    candidates: CandidateResult[];
    totalInvestment: number;
    minPayout: number;
    maxPayout: number;
    spread: number;
}

export const MAX_TOTAL_UNITS = 100000;
export const MIN_CANDIDATES = 2;
export const MAX_CANDIDATES = 20;

function validate(input: AllocateInput): void {
    const { odds, totalUnits, unitPrice } = input;

    if (odds.length < MIN_CANDIDATES) {
        throw new Error(`候補は${MIN_CANDIDATES}件以上指定してください`);
    }
    if (odds.length > MAX_CANDIDATES) {
        throw new Error(`候補は${MAX_CANDIDATES}件以下にしてください`);
    }
    for (const o of odds) {
        if (!Number.isFinite(o) || o <= 1.0) {
            throw new Error('倍率はすべて1.0より大きい有限の数値にしてください');
        }
    }
    if (!Number.isInteger(totalUnits) || totalUnits <= 0) {
        throw new Error('合計口数は正の整数にしてください');
    }
    if (totalUnits < odds.length) {
        throw new Error('合計口数は候補数以上にしてください');
    }
    if (totalUnits > MAX_TOTAL_UNITS) {
        throw new Error(`合計口数は${MAX_TOTAL_UNITS}以下にしてください`);
    }
    if (!Number.isInteger(unitPrice) || unitPrice < 100 || unitPrice % 100 !== 0) {
        throw new Error('1口あたり金額は100以上かつ100の倍数にしてください');
    }
}

// Sequential greedy: always add one unit to whichever candidate currently has
// the smallest projected payout, tie-broken by the lowest index. This alone is
// not guaranteed optimal (it can overshoot on the last few units), so it is
// followed by a local-search refinement pass — see refineSpread().
function greedyAllocate(odds: number[], totalUnits: number): number[] {
    const units = new Array<number>(odds.length).fill(1);
    let remaining = totalUnits - odds.length;

    while (remaining > 0) {
        let minIndex = 0;
        let minPayout = units[0] * odds[0];
        for (let i = 1; i < odds.length; i += 1) {
            const payout = units[i] * odds[i];
            if (payout < minPayout) {
                minPayout = payout;
                minIndex = i;
            }
        }
        units[minIndex] += 1;
        remaining -= 1;
    }

    return units;
}

// Repeatedly move one unit from the current max-payout candidate to the
// current min-payout candidate, as long as doing so strictly reduces the
// spread (max payout - min payout) across all candidates. Each accepted move
// strictly decreases the spread over a finite set of unit distributions, so
// this always terminates. This closes most of the gap the greedy pass alone
// leaves behind, though it is still a heuristic, not a proven global optimum.
function refineSpread(units: number[], odds: number[]): number[] {
    const refined = units.slice();

    for (;;) {
        const payouts = refined.map((u, i) => u * odds[i]);
        const maxIndex = payouts.indexOf(Math.max(...payouts));
        const minIndex = payouts.indexOf(Math.min(...payouts));
        if (maxIndex === minIndex || refined[maxIndex] <= 1) {
            break;
        }

        const currentSpread = payouts[maxIndex] - payouts[minIndex];
        const movedMaxPayout = (refined[maxIndex] - 1) * odds[maxIndex];
        const movedMinPayout = (refined[minIndex] + 1) * odds[minIndex];
        const unaffectedPayouts = payouts.filter((_, i) => i !== maxIndex && i !== minIndex);
        const candidatePayouts = [movedMaxPayout, movedMinPayout, ...unaffectedPayouts];
        const newSpread = Math.max(...candidatePayouts) - Math.min(...candidatePayouts);

        if (newSpread >= currentSpread) {
            break;
        }
        refined[maxIndex] -= 1;
        refined[minIndex] += 1;
    }

    return refined;
}

function computeUnits(odds: number[], totalUnits: number): number[] {
    return refineSpread(greedyAllocate(odds, totalUnits), odds);
}

export function allocate(input: AllocateInput): AllocationResult {
    validate(input);

    const { odds, totalUnits, unitPrice } = input;
    const units = computeUnits(odds, totalUnits);
    const totalInvestment = totalUnits * unitPrice;

    const candidates: CandidateResult[] = odds.map((o, i) => {
        const payout = units[i] * o * unitPrice;
        return {
            odds: o,
            units: units[i],
            payout,
            returnRate: payout / totalInvestment
        };
    });

    const payouts = candidates.map((c) => c.payout);
    const minPayout = Math.min(...payouts);
    const maxPayout = Math.max(...payouts);

    return {
        candidates,
        totalInvestment,
        minPayout,
        maxPayout,
        spread: maxPayout - minPayout
    };
}
