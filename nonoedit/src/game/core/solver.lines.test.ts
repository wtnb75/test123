import { describe, expect, it } from 'vitest';
import {
    applyCandidateCommon,
    applyEdgeOverlap,
    applyFullLineEmpty,
    applyFullLineFill,
    applyRegionSplit,
    generateCandidates,
    type LineContext,
} from './solver';
import type { BinaryCell } from './types';

// Exhaustive checks of the single-line techniques against an independent oracle:
// for every line up to MAX_LENGTH cells, every hint list it can produce, and every subset of
// its cells revealed as "known", a deduction is only valid if it holds in *all* lines that
// still match the hints and the known cells.

const MAX_LENGTH = 8;
const NO_TIMEOUT = 1_000_000;

type Known = (BinaryCell | null)[];

const bitsOf = (mask: number, length: number): BinaryCell[] =>
    Array.from({ length }, (_, i) => ((mask >> i) & 1) as BinaryCell);

const hintsOf = (line: BinaryCell[]): number[] => {
    const hints: number[] = [];
    let run = 0;
    for (const cell of line) {
        if (cell === 1) {
            run += 1;
        } else if (run > 0) {
            hints.push(run);
            run = 0;
        }
    }
    if (run > 0) {
        hints.push(run);
    }
    return hints.length === 0 ? [0] : hints;
};

const key = (line: readonly number[]): string => line.join('');

// Hint list of every line, computed once: LINES[length][mask].
const LINES = Array.from({ length: MAX_LENGTH + 1 }, (_, length) =>
    Array.from({ length: 1 << length }, (_, mask) => {
        const cells = bitsOf(mask, length);
        return { cells, hintKey: key(hintsOf(cells)) };
    }),
);

// Oracle: every line of `length` cells whose hints equal `hints` and that agrees with `known`.
const consistentLines = (hints: number[], known: Known): BinaryCell[][] => {
    const wanted = key(hints);
    return LINES[known.length]
        .filter(({ cells, hintKey }) => hintKey === wanted && cells.every((cell, i) => known[i] === null || known[i] === cell))
        .map(({ cells }) => cells);
};

const context = (hints: number[], known: Known): LineContext => ({
    hints,
    known,
    maxMillis: NO_TIMEOUT,
    startTime: Date.now(),
});

type Scenario = { solution: BinaryCell[]; hints: number[]; known: Known; consistent: BinaryCell[][] };

// Every (solution line, revealed subset) pair. The solution line itself is always consistent.
function* scenarios(): Generator<Scenario> {
    for (let length = 1; length <= MAX_LENGTH; length += 1) {
        for (let lineMask = 0; lineMask < 1 << length; lineMask += 1) {
            const solution = bitsOf(lineMask, length);
            const hints = hintsOf(solution);
            for (let revealMask = 0; revealMask < 1 << length; revealMask += 1) {
                const known: Known = solution.map((cell, i) => (((revealMask >> i) & 1) === 1 ? cell : null));
                yield { solution, hints, known, consistent: consistentLines(hints, known) };
            }
        }
    }
}

// Built once and shared by all tests below.
let cachedScenarios: Scenario[] | undefined;
const allScenarios = (): Scenario[] => (cachedScenarios ??= [...scenarios()]);

const describeScenario = ({ hints, known }: Scenario): string =>
    `hints=[${hints.join(',')}] known=${known.map((c) => (c === null ? '?' : c)).join('')}`;

const allSameAt = (lines: BinaryCell[][], index: number): BinaryCell | null => {
    const first = lines[0][index];
    return lines.every((line) => line[index] === first) ? first : null;
};

describe('single-line techniques (exhaustive up to 8 cells)', () => {
    it('generateCandidates returns exactly the lines that match hints and known cells', () => {
        for (const scenario of allScenarios()) {
            const actual = generateCandidates(context(scenario.hints, scenario.known)).map(key).sort();
            const expected = scenario.consistent.map(key).sort();

            if (key(actual) !== key(expected)) {
                expect.fail(`${describeScenario(scenario)}: got ${actual} expected ${expected}`);
            }
        }
    });

    it('generateCandidates returns nothing when the known cells contradict the hints', () => {
        expect(generateCandidates(context([2], [1, 0, 1]))).toEqual([]);
        expect(generateCandidates(context([0], [1, null]))).toEqual([]);
    });

    it.each([
        ['full-line-fill', applyFullLineFill],
        ['full-line-empty', applyFullLineEmpty],
        ['edge-overlap', applyEdgeOverlap],
        ['candidate-common', applyCandidateCommon],
        ['region-split', applyRegionSplit],
    ])('%s only deduces values that hold in every consistent line', (_name, technique) => {
        for (const scenario of allScenarios()) {
            for (const [index, value] of technique(context(scenario.hints, scenario.known)).updates) {
                if (scenario.known[index] !== null) {
                    expect.fail(`${describeScenario(scenario)}: updated already known cell ${index}`);
                }
                if (allSameAt(scenario.consistent, index) !== value) {
                    expect.fail(`${describeScenario(scenario)}: deduced ${value} at ${index}, not true in all lines`);
                }
            }
        }
    });

    it('candidate-common finds every cell that is the same in all consistent lines', () => {
        for (const scenario of allScenarios()) {
            const updates = new Map(applyCandidateCommon(context(scenario.hints, scenario.known)).updates);

            for (let index = 0; index < scenario.known.length; index += 1) {
                const forced = scenario.known[index] === null ? allSameAt(scenario.consistent, index) : null;
                if ((updates.get(index) ?? null) !== forced) {
                    expect.fail(`${describeScenario(scenario)}: cell ${index} forced=${forced} got=${updates.get(index)}`);
                }
            }
        }
    });

    it('edge-overlap finds every filled cell of an empty line', () => {
        for (let length = 1; length <= MAX_LENGTH; length += 1) {
            const known: Known = Array.from({ length }, () => null);
            for (let lineMask = 0; lineMask < 1 << length; lineMask += 1) {
                const hints = hintsOf(bitsOf(lineMask, length));
                const consistent = consistentLines(hints, known);
                const expected = known.flatMap((_, i) => (allSameAt(consistent, i) === 1 ? [i] : []));

                const actual = applyEdgeOverlap(context(hints, known))
                    .updates.map(([i]) => i)
                    .sort((a, b) => a - b);

                if (key(actual) !== key(expected)) {
                    expect.fail(`hints=[${hints}] length=${length}: got ${actual} expected ${expected}`);
                }
            }
        }
    });

    it('full-line-fill determines the whole line when hints plus gaps fill it exactly', () => {
        for (const scenario of allScenarios()) {
            const tight = scenario.hints.reduce((a, b) => a + b, 0) + scenario.hints.length - 1;
            if (scenario.hints[0] === 0 || tight !== scenario.known.length) {
                continue;
            }

            const updates = new Map(applyFullLineFill(context(scenario.hints, scenario.known)).updates);

            // Every filled cell of the only possible line is either already known or reported as filled.
            scenario.solution.forEach((cell, i) => {
                if (cell === 1 && scenario.known[i] !== 1 && updates.get(i) !== 1) {
                    expect.fail(`${describeScenario(scenario)}: cell ${i} should be filled`);
                }
            });
        }
    });

    it('full-line-empty clears the unknown cells once all filled cells are known', () => {
        for (const scenario of allScenarios()) {
            const knownFilled = scenario.known.filter((c) => c === 1).length;
            const updates = applyFullLineEmpty(context(scenario.hints, scenario.known)).updates;
            const remaining = scenario.known.filter((c) => c === null).length;
            const total = scenario.solution.filter((c) => c === 1).length;

            if (knownFilled === total) {
                expect(updates).toHaveLength(remaining);
                expect(updates.every(([, value]) => value === 0)).toBe(true);
            } else {
                expect(updates).toEqual([]);
            }
        }
    });

    it('full-line-empty does nothing when more cells are known filled than the hints allow', () => {
        expect(applyFullLineEmpty(context([1], [1, 1, null])).updates).toEqual([]);
        expect(applyFullLineEmpty(context([0], [1, null, null])).updates).toEqual([]);
    });

    it('region-split leaves everything alone when no unknown region is shorter than the smallest hint', () => {
        expect(applyRegionSplit(context([3], [null, null, null, 0, null, null, null])).updates).toEqual([]);
        expect(applyRegionSplit(context([0], [null, null])).updates).toEqual([]);
    });

    it('region-split empties a short region that is closed off by known empty cells', () => {
        const updates = applyRegionSplit(context([3], [null, 0, null, null, 0, null, null, null])).updates;

        expect(updates).toEqual([
            [0, 0],
            [2, 0],
            [3, 0],
        ]);
    });
});
