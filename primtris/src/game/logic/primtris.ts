export const BOX_ORDER = ['x2', 'x3', 'x5', 'x7', 'xN', 'P'] as const;

export type BoxKey = (typeof BOX_ORDER)[number];

export const getBoxOrder = (digitCount: number): BoxKey[] => {
    if (digitCount <= 2) {
        return ['x2', 'x3', 'x5', 'x7', 'P'];
    }

    return [...BOX_ORDER];
};

export interface Difficulty {
    digitCount: number;
    boxCapacity: number;
}

export interface QueueState {
    current: number;
    next: [number, number];
}

export interface DistributionState {
    counts: Record<BoxKey, number>;
    generated: number;
}

export interface PlacementResult {
    boxes: Record<BoxKey, number[]>;
    clearedDigits: number[];
    scoreDelta: number;
    gameOver: boolean;
    isCorrect: boolean;
}

export const createEmptyBoxes = (): Record<BoxKey, number[]> => ({
    x2: [],
    x3: [],
    x5: [],
    x7: [],
    xN: [],
    P: []
});

export const createDistributionState = (): DistributionState => ({
    counts: {
        x2: 0,
        x3: 0,
        x5: 0,
        x7: 0,
        xN: 0,
        P: 0
    },
    generated: 0
});

export const splitDigits = (value: number): number[] => {
    return String(value).split('').map((digit) => Number(digit));
};

export const isPrime = (value: number): boolean => {
    if (value < 2) {
        return false;
    }

    if (value === 2) {
        return true;
    }

    if (value % 2 === 0) {
        return false;
    }

    const limit = Math.floor(Math.sqrt(value));

    for (let divisor = 3; divisor <= limit; divisor += 2) {
        if (value % divisor === 0) {
            return false;
        }
    }

    return true;
};

export const getValidBoxes = (value: number): BoxKey[] => {
    if (isPrime(value)) {
        return ['P'];
    }

    const factorBoxes: BoxKey[] = [];

    if (value % 2 === 0) {
        factorBoxes.push('x2');
    }

    if (value % 3 === 0) {
        factorBoxes.push('x3');
    }

    if (value % 5 === 0) {
        factorBoxes.push('x5');
    }

    if (value % 7 === 0) {
        factorBoxes.push('x7');
    }

    return factorBoxes.length > 0 ? factorBoxes : ['xN'];
};

export const isCorrectPlacement = (value: number, box: BoxKey): boolean => {
    return getValidBoxes(value).includes(box);
};

export const generateNumber = (digitCount: number, rng: () => number = Math.random): number => {
    const lowerBound = 10 ** (digitCount - 1);
    const span = 9 * lowerBound;

    return lowerBound + Math.floor(rng() * span);
};

const updateDistributionState = (state: DistributionState, value: number): void => {
    for (const box of getValidBoxes(value)) {
        state.counts[box] += 1;
    }
    state.generated += 1;
};

const selectTargetBox = (digitCount: number, state: DistributionState, rng: () => number): BoxKey => {
    const activeBoxes = getBoxOrder(digitCount);
    const counts = activeBoxes.map((box) => state.counts[box]);
    const minimum = Math.min(...counts);
    const deficitBoxes = activeBoxes.filter((box) => state.counts[box] === minimum);

    return deficitBoxes[Math.floor(rng() * deficitBoxes.length)];
};

const generateForTargetBox = (digitCount: number, target: BoxKey, rng: () => number): number => {
    const lowerBound = 10 ** (digitCount - 1);
    const upperBound = (10 ** digitCount) - 1;

    if (target === 'P') {
        for (let attempt = 0; attempt < 300; attempt += 1) {
            let value = generateNumber(digitCount, rng);
            if (value % 2 === 0) {
                value += 1;
            }
            while (value <= upperBound) {
                if (isPrime(value)) {
                    return value;
                }
                value += 2;
            }
        }
        // Deterministic fallback: scan from lowerBound for the first prime in range
        let primeFallback = lowerBound % 2 === 0 ? lowerBound + 1 : lowerBound;
        while (primeFallback <= upperBound) {
            if (isPrime(primeFallback)) {
                return primeFallback;
            }
            primeFallback += 2;
        }

        return lowerBound;
    }

    if (target === 'xN') {
        const candidates = [11, 13, 17, 19, 23, 29, 31, 37];
        for (let attempt = 0; attempt < 300; attempt += 1) {
            const left = candidates[Math.floor(rng() * candidates.length)];
            const right = candidates[Math.floor(rng() * candidates.length)];
            const value = left * right;
            if (value >= lowerBound && value <= upperBound && getValidBoxes(value)[0] === 'xN') {
                return value;
            }
        }
        // Deterministic fallback: scan from lowerBound for the first xN-routed value in range
        for (let xnFallback = lowerBound; xnFallback <= upperBound; xnFallback += 1) {
            if (getValidBoxes(xnFallback)[0] === 'xN') {
                return xnFallback;
            }
        }

        return lowerBound;
    }

    const divisor = Number(target.slice(1));
    const minK = Math.ceil(lowerBound / divisor);
    const maxK = Math.floor(upperBound / divisor);

    for (let attempt = 0; attempt < 300; attempt += 1) {
        const k = minK + Math.floor(rng() * (maxK - minK + 1));
        const value = k * divisor;
        if (getValidBoxes(value).includes(target)) {
            return value;
        }
    }

    return divisor * minK;
};

const generateBalancedNumber = (
    digitCount: number,
    distributionState: DistributionState,
    rng: () => number
): number => {
    const targetBox = selectTargetBox(digitCount, distributionState, rng);

    for (let attempt = 0; attempt < 120; attempt += 1) {
        const value = generateNumber(digitCount, rng);
        if (isCorrectPlacement(value, targetBox)) {
            updateDistributionState(distributionState, value);
            return value;
        }
    }

    const fallback = generateForTargetBox(digitCount, targetBox, rng);
    updateDistributionState(distributionState, fallback);
    return fallback;
};

const generatePlayableNumber = (
    digitCount: number,
    rng: () => number,
    distributionState?: DistributionState
): number => {
    if (!distributionState) {
        return generateNumber(digitCount, rng);
    }

    return generateBalancedNumber(digitCount, distributionState, rng);
};

export const createQueue = (
    difficulty: Difficulty,
    rng: () => number = Math.random,
    distributionState?: DistributionState
): QueueState => ({
    current: generatePlayableNumber(difficulty.digitCount, rng, distributionState),
    next: [
        generatePlayableNumber(difficulty.digitCount, rng, distributionState),
        generatePlayableNumber(difficulty.digitCount, rng, distributionState)
    ]
});

export const advanceQueue = (
    queue: QueueState,
    difficulty: Difficulty,
    rng: () => number = Math.random,
    distributionState?: DistributionState
): QueueState => ({
    current: queue.next[0],
    next: [queue.next[1], generatePlayableNumber(difficulty.digitCount, rng, distributionState)]
});

const removeNewestMatchingDigit = (digits: number[], target: number): { nextDigits: number[]; cleared: boolean } => {
    for (let index = digits.length - 1; index >= 0; index -= 1) {
        if (digits[index] === target) {
            return {
                nextDigits: [...digits.slice(0, index), ...digits.slice(index + 1)],
                cleared: true
            };
        }
    }

    return { nextDigits: digits, cleared: false };
};

export const resolvePlacement = (
    value: number,
    box: BoxKey,
    boxes: Record<BoxKey, number[]>,
    boxCapacity: number
): PlacementResult => {
    const nextBoxes = Object.fromEntries(
        BOX_ORDER.map((boxKey) => [boxKey, [...boxes[boxKey]]])
    ) as Record<BoxKey, number[]>;
    const digits = splitDigits(value);
    const isCorrect = isCorrectPlacement(value, box);

    if (isCorrect) {
        const clearedDigits: number[] = [];
        let targetDigits = nextBoxes[box];

        for (const digit of digits) {
            const { nextDigits, cleared } = removeNewestMatchingDigit(targetDigits, digit);
            targetDigits = nextDigits;
            if (cleared) {
                clearedDigits.push(digit);
            }
        }

        nextBoxes[box] = targetDigits;

        return {
            boxes: nextBoxes,
            clearedDigits,
            scoreDelta: 1,
            gameOver: false,
            isCorrect: true
        };
    }

    nextBoxes[box].push(...digits);

    return {
        boxes: nextBoxes,
        clearedDigits: [],
        scoreDelta: 1,
        gameOver: nextBoxes[box].length > boxCapacity,
        isCorrect: false
    };
};
