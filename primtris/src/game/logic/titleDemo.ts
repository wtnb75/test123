// The Title demo (docs/spec/title-demo.md): a bot that sorts numbers into the boxes. Pure and deterministic:
// randomness is injected, time is passed in.
import type { DemoGame, DemoOptions } from 'title-demo';

import {
    advanceQueue,
    boxCapacityFor,
    createDistributionState,
    createEmptyBoxes,
    createQueue,
    getBoxOrder,
    getValidBoxes,
    resolvePlacement,
    type BoxKey,
    type DistributionState,
    type QueueState
} from './primtris';

export const DEMO_ROUNDS = 8;
export const DEMO_WAIT_MS = 700;
export const DEMO_SLIDE_MS = 250;
export const DEMO_DROP_MS = 200;
export const DEMO_FADE_MS = 400;
export const DEMO_MISS_RATE = 0.2;
export const DEMO_HESITATE_RATE = 0.35;
export const DEMO_HESITATE_LEAD_MS = 500;
export const DEMO_HESITATE_SLIDE_MS = 150;
export const DEMO_BOX_HEIGHT = 140;
export const DEMO_REGION_GAP = 12;
export const DEMO_HINT_Y_RATIO = 0.92;

// The Title's own element positions the demo sits between (docs/spec.md "Title"): ratios of the screen height.
export const SELECTOR_Y_RATIO = 0.38;
export const START_Y_RATIO = 0.84;
export const SELECTOR_HEIGHT = 72;
export const START_HEIGHT = 72;

/** `stepMs` is not used (one action per round); it is set to the wait. */
export const TITLE_DEMO_OPTIONS: DemoOptions = {
    rounds: DEMO_ROUNDS,
    timing: { stepMs: DEMO_WAIT_MS, waitMs: DEMO_WAIT_MS, fadeMs: DEMO_FADE_MS }
};

/** What the bot decided for the number on screen: the box, and a box it wanders to first (null = no hesitation). */
export interface DemoIntent {
    box: BoxKey;
    decoy: BoxKey | null;
}

export interface TitleDemoState {
    digitCount: number;
    capacity: number;
    boxes: Record<BoxKey, number[]>;
    distribution: DistributionState;
    queue: QueueState;
    /** Set by `plan`, cleared by `play`. The Scene reads it to animate the hesitation before the action. */
    intent: DemoIntent | null;
}

export interface TitleDemoDetail {
    value: number;
    box: BoxKey;
    decoy: BoxKey | null;
    boxes: Record<BoxKey, number[]>;
    clearedDigits: number[];
    isCorrect: boolean;
}

const pick = <T>(items: readonly T[], unit: number): T => items[Math.min(items.length - 1, Math.floor(unit * items.length))];

/**
 * The bot's move for `value` (docs/spec/title-demo.md "ボットの手"). `rng` is drawn 3 times (4 when it hesitates):
 * r1 miss, r2 pick, r3 hesitate, [r4 decoy]. r3 / r4 never change the chosen box.
 */
export const chooseDemoMove = (
    value: number,
    digitCount: number,
    boxes: Record<BoxKey, number[]>,
    capacity: number,
    rng: () => number,
    missRate: number = DEMO_MISS_RATE,
    hesitateRate: number = DEMO_HESITATE_RATE
): DemoIntent => {
    const active = getBoxOrder(digitCount);
    const validSet = new Set(getValidBoxes(value));
    const correct = active.filter((box) => validSet.has(box));
    const wrong = active.filter((box) => !validSet.has(box));

    const miss = rng() < missRate;
    const candidates = miss && wrong.length > 0 ? wrong : correct;
    const pool = candidates.length > 0 ? candidates : active;
    const r2 = rng();

    let box = pick(pool, r2);
    if (!validSet.has(box) && resolvePlacement(value, box, boxes, capacity).gameOver && correct.length > 0) {
        box = pick(correct, r2);
    }

    const hesitate = rng() < hesitateRate;
    let decoy: BoxKey | null = null;
    if (hesitate) {
        const others = active.filter((candidate) => candidate !== box);
        decoy = others.length > 0 ? pick(others, rng()) : null;
    }

    return { box, decoy };
};

export const createTitleDemoGame = (
    digitCount: number,
    rng: () => number = Math.random
): DemoGame<TitleDemoState, DemoIntent, TitleDemoDetail> => {
    const boxCapacity = boxCapacityFor(digitCount);
    const difficulty = { digitCount, boxCapacity };

    return {
        start: () => {
            const distribution = createDistributionState();
            return {
                digitCount,
                capacity: boxCapacity,
                boxes: createEmptyBoxes(),
                distribution,
                queue: createQueue(difficulty, rng, distribution),
                intent: null
            };
        },
        plan: (state) => {
            const intent = chooseDemoMove(state.queue.current, state.digitCount, state.boxes, state.capacity, rng);
            state.intent = intent;
            return [intent];
        },
        play: (state, action) => {
            const value = state.queue.current;
            const result = resolvePlacement(value, action.box, state.boxes, state.capacity);
            state.boxes = result.boxes;
            state.intent = null;
            return {
                moved: true,
                roundDone: true,
                detail: {
                    value,
                    box: action.box,
                    decoy: action.decoy,
                    boxes: result.boxes,
                    clearedDigits: result.clearedDigits,
                    isCorrect: result.isCorrect
                }
            };
        },
        advance: (state) => {
            state.queue = advanceQueue(state.queue, difficulty, rng, state.distribution);
        }
    };
};

// --- Layout ---------------------------------------------------------------------------------------------

export interface DemoBoxRect {
    key: BoxKey;
    left: number;
    width: number;
    centerX: number;
}

export interface DemoLayout {
    regionTop: number;
    regionBottom: number;
    boxRowTop: number;
    boxes: DemoBoxRect[];
    /** Where a number tile waits: horizontal centre of the screen, and the top y. */
    tileX: number;
    tileTop: number;
    hintY: number;
}

export const demoLayout = (width: number, height: number, digitCount: number): DemoLayout => {
    const regionTop = Math.round(SELECTOR_Y_RATIO * height + SELECTOR_HEIGHT / 2 + DEMO_REGION_GAP);
    const regionBottom = Math.round(START_Y_RATIO * height - START_HEIGHT / 2 - DEMO_REGION_GAP);
    const keys = getBoxOrder(digitCount);
    const boxWidth = width / keys.length;

    return {
        regionTop,
        regionBottom,
        boxRowTop: regionBottom - DEMO_BOX_HEIGHT,
        boxes: keys.map((key, index) => ({
            key,
            left: index * boxWidth,
            width: boxWidth,
            centerX: index * boxWidth + boxWidth / 2
        })),
        tileX: width / 2,
        tileTop: regionTop,
        hintY: Math.round(DEMO_HINT_Y_RATIO * height)
    };
};

// --- Timeline of one number ----------------------------------------------------------------------------

export interface DemoSchedule {
    /** When the action happens (`waiting` start + wait). */
    actAt: number;
    /** When the detour starts, or null when the bot does not hesitate (or it is too late for it). */
    hesitateAt: number | null;
    startX: number;
    decoyX: number | null;
    targetX: number;
    tileTop: number;
    tileHeight: number;
    landBottom: number;
    box: BoxKey;
    decoy: BoxKey | null;
}

/**
 * When the detour starts. `knownAt` is when the move became known; a late start (later than
 * `actAt - hesitateSlideMs`) means no detour.
 */
export const hesitationStart = (
    actAt: number,
    knownAt: number,
    hesitating: boolean,
    leadMs: number = DEMO_HESITATE_LEAD_MS,
    slideMs: number = DEMO_HESITATE_SLIDE_MS
): number | null => {
    if (!hesitating) {
        return null;
    }
    const start = Math.max(actAt - leadMs, knownAt);
    return start > actAt - slideMs ? null : start;
};

export interface TileState {
    x: number;
    top: number;
    highlight: BoxKey | null;
    landed: boolean;
}

const lerp = (from: number, to: number, unit: number): number => from + (to - from) * Math.min(1, Math.max(0, unit));

/** Position of the tile and the highlighted box at time `t` (linear motion). */
export const tileStateAt = (t: number, s: DemoSchedule): TileState => {
    const landAt = s.actAt + DEMO_SLIDE_MS + DEMO_DROP_MS;
    const landedTop = s.landBottom - s.tileHeight;

    if (t < s.actAt) {
        if (s.hesitateAt !== null && s.decoyX !== null && t >= s.hesitateAt) {
            const x = lerp(s.startX, s.decoyX, (t - s.hesitateAt) / DEMO_HESITATE_SLIDE_MS);
            return { x, top: s.tileTop, highlight: s.decoy, landed: false };
        }
        return { x: s.startX, top: s.tileTop, highlight: null, landed: false };
    }

    const fromX = s.hesitateAt !== null && s.decoyX !== null ? s.decoyX : s.startX;
    if (t < landAt) {
        const slide = (t - s.actAt) / DEMO_SLIDE_MS;
        const drop = (t - s.actAt - DEMO_SLIDE_MS) / DEMO_DROP_MS;
        return {
            x: lerp(fromX, s.targetX, slide),
            top: lerp(s.tileTop, landedTop, drop),
            highlight: s.box,
            landed: false
        };
    }

    return { x: s.targetX, top: landedTop, highlight: null, landed: true };
};

// --- Fade when the digit count changes ---------------------------------------------------------------------

/**
 * The Scene's own opacity ramp for a digit-count change (docs/spec/title-demo.md "デモの繰り返し"): fade the
 * current run out, swap once at 0, fade the new run in. Linear: 1 per `fadeMs`.
 */
export class SelectionFade {
    private phase: 'idle' | 'out' | 'in' = 'idle';
    private value = 1;
    private target = 0;

    constructor (private readonly fadeMs: number = DEMO_FADE_MS) {}

    get opacity (): number
    {
        return this.value;
    }

    get active (): boolean
    {
        return this.phase !== 'idle';
    }

    /** True while the current run is fading out (the demo is held still). */
    get fadingOut (): boolean
    {
        return this.phase === 'out';
    }

    /**
     * The digit count changed: fade out from the current opacity; the last change wins. `from` is the opacity the
     * demo has now when this fade is idle (the demo's own end-of-run fade may be running); it is ignored while
     * this fade is already running.
     */
    change (digitCount: number, from: number = 1): void
    {
        if (this.phase === 'idle') {
            this.value = Math.min(1, Math.max(0, from));
        }
        this.target = digitCount;
        this.phase = 'out';
    }

    /** Advances by `deltaMs`. Returns the digit count to swap to when the fade-out just finished, else null. */
    update (deltaMs: number): number | null
    {
        let remaining = deltaMs;
        let swapTo: number | null = null;

        if (this.phase === 'out') {
            const needed = this.value * this.fadeMs;
            if (remaining + 1e-9 < needed) {
                this.value -= remaining / this.fadeMs;
                return null;
            }
            remaining -= needed;
            this.value = 0;
            this.phase = 'in';
            swapTo = this.target;
        }

        if (this.phase === 'in') {
            this.value = Math.min(1, this.value + remaining / this.fadeMs);
            if (this.value >= 1) {
                this.value = 1;
                this.phase = 'idle';
            }
        }

        return swapTo;
    }
}
