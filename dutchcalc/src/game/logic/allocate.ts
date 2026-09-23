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

// The goal is the smallest possible spread (max payout - min payout), found exactly:
//
// 1. The best allocation's minimum payout is some k * odds[i]. Trying every such value as a
//    "floor" (highest first) covers all candidates for the optimum.
// 2. For a given floor, each candidate needs at least the units that reach it. The remaining
//    units are spread so the highest payout is as low as possible (a bisection on the ceiling).
// 3. Since sum(units) = totalUnits, the payouts cannot all be above or all below
//    totalUnits / sum(1 / odds); that value bounds the floors worth trying, and lets the search
//    stop as soon as ideal - floor exceeds the best spread found so far.

const payoutOf = (units: number, odds: number): number => units * odds;

const sum = (values: number[]): number => values.reduce((total, value) => total + value, 0);

// Fewest units (at least 1) whose payout reaches `target`. The loops correct floating-point
// rounding so the answer is consistent with payoutOf().
function minUnitsReaching(target: number, odds: number): number {
    let units = Math.max(1, Math.ceil(target / odds));
    while (units > 1 && payoutOf(units - 1, odds) >= target) {
        units -= 1;
    }
    while (payoutOf(units, odds) < target) {
        units += 1;
    }

    return units;
}

// Most units whose payout stays within `limit` (0 if even one unit exceeds it).
function maxUnitsWithin(limit: number, odds: number): number {
    let units = Math.floor(limit / odds);
    while (units > 0 && payoutOf(units, odds) > limit) {
        units -= 1;
    }
    while (payoutOf(units + 1, odds) <= limit) {
        units += 1;
    }

    return units;
}

// Allocation in which every payout is at least `floor` and the highest payout is minimal, or
// null when the floor cannot be reached with `totalUnits`. Ties give the extra unit to the
// lowest index.
function allocateAboveFloor(odds: number[], totalUnits: number, floor: number): number[] | null {
    const lower = odds.map((o) => minUnitsReaching(floor, o));
    const spare = totalUnits - sum(lower);
    if (spare < 0) {
        return null;
    }

    const capacity = (ceiling: number): number =>
        sum(odds.map((o, i) => Math.max(lower[i], maxUnitsWithin(ceiling, o))));

    let low = Math.max(...lower.map((u, i) => payoutOf(u, odds[i])));
    let high = Math.max(...lower.map((u, i) => payoutOf(u + spare, odds[i])));
    if (capacity(low) >= totalUnits) {
        high = low;
    }
    for (let round = 0; round < 200 && low < high; round += 1) {
        const middle = (low + high) / 2;
        if (middle <= low || middle >= high) {
            break;
        }
        if (capacity(middle) >= totalUnits) {
            high = middle;
        } else {
            low = middle;
        }
    }

    const units = odds.map((o, i) => Math.max(lower[i], maxUnitsWithin(high, o)));
    // The ceiling can leave a few units too many (ties at the ceiling): take them back from the
    // highest payouts, last index first, so earlier candidates keep the extra unit.
    for (let extra = sum(units) - totalUnits; extra > 0; extra -= 1) {
        let pick = -1;
        for (let i = odds.length - 1; i >= 0; i -= 1) {
            const removable = units[i] > lower[i];
            if (removable && (pick < 0 || payoutOf(units[i], odds[i]) > payoutOf(units[pick], odds[pick]))) {
                pick = i;
            }
        }
        units[pick] -= 1;
    }

    return units;
}

function spreadOf(units: number[], odds: number[]): number {
    const payouts = units.map((u, i) => payoutOf(u, odds[i]));

    return Math.max(...payouts) - Math.min(...payouts);
}

function computeUnits(odds: number[], totalUnits: number): number[] {
    const idealPayout = totalUnits / sum(odds.map((o) => 1 / o));

    const floors: number[] = [];
    for (const o of odds) {
        for (let k = 1; payoutOf(k, o) <= idealPayout * (1 + 1e-9); k += 1) {
            floors.push(payoutOf(k, o));
        }
    }
    floors.sort((x, y) => y - x);

    let best: number[] = [];
    let bestSpread = Infinity;
    for (const floor of floors) {
        if (idealPayout - floor > bestSpread) {
            break;
        }
        const units = allocateAboveFloor(odds, totalUnits, floor);
        if (units === null) {
            continue;
        }
        const spread = spreadOf(units, odds);
        if (spread < bestSpread) {
            best = units;
            bestSpread = spread;
        }
    }

    return best;
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
