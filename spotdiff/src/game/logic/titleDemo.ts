// The Title demo (docs/spec.md "Title" > "デモ"): a bot finds the differences of a picture one by one.
// The flow (waits, one tap per call, the fade between demo games) is the shared `title-demo` package; this file
// supplies the game: which pictures, which taps, what a tap finds. Phaser-free; time and randomness are injected.
import { DemoDirector, type DemoGame } from 'title-demo';
import { PARAMS } from '../params';
import { generateStage, type Stage } from './generate';
import { judgeClick } from './judge';
import { mulberry32, seedFor, type Rng } from './random';

export interface DemoState {
    /** Date-like number the pictures of this demo game are made from (random; not the real date). */
    date: number;
    /** 1-based stage shown. */
    stageNo: number;
    stage: Stage;
    /** Differences found so far (indices into `stage.diffs`). */
    found: Set<number>;
}

/** What one bot tap did, for the Scene to play its effects. Positions are panel-local. */
export interface DemoTap {
    diff: number;
    /** The panel the bot tapped (always the first). */
    panel: number;
    x: number;
    y: number;
}

export type TitleDemo = DemoDirector<DemoState, number, DemoTap>;
export type StageMaker = (date: number, stageNo: number) => Stage;

/** A date-like number in [0, 2^31) from one random draw. */
export const demoDateFrom = (rng: Rng): number => Math.floor(rng() * 2 ** 31);

/** The demo's picture of a stage: set number `demoSeedSet` (0), which no real set (1 and up) uses. */
export const demoStage: StageMaker = (date, stageNo) =>
    generateStage(stageNo, mulberry32(seedFor(date, PARAMS.demoSeedSet, stageNo)));

/** The bot's plan for a picture: tap every difference not yet found in index order, or no plan when none is left. */
export const botPlan = (stage: Stage, found: ReadonlySet<number> = new Set()): number[] | null => {
    const todo = stage.diffs.map((_, i) => i).filter((i) => !found.has(i));
    return todo.length === 0 ? null : todo;
};

const newState = (date: number, stageNo: number, makeStage: StageMaker): DemoState => ({
    date,
    stageNo,
    stage: makeStage(date, stageNo),
    found: new Set<number>(),
});

export function createTitleDemo(rng: Rng, now: number, makeStage: StageMaker = demoStage): TitleDemo {
    const game: DemoGame<DemoState, number, DemoTap> = {
        start: () => newState(demoDateFrom(rng), 1, makeStage),
        plan: (state) => botPlan(state.stage, state.found),
        play: (state, index) => {
            const diff = state.stage.diffs[index];
            // The bot taps the centre of the difference's hit circle, on the first panel, like a player would.
            const hit = judgeClick(state.stage.diffs, state.found, diff.x, diff.y);
            if (hit < 0) return { moved: false, roundDone: false, detail: { diff: index, panel: 0, x: diff.x, y: diff.y } };
            state.found.add(hit);
            return {
                moved: true,
                roundDone: state.found.size === state.stage.diffs.length,
                detail: { diff: hit, panel: 0, x: diff.x, y: diff.y },
            };
        },
        advance: (state) => {
            const next = newState(state.date, state.stageNo + 1, makeStage);
            state.stageNo = next.stageNo;
            state.stage = next.stage;
            state.found = next.found;
        },
    };
    const timing = { stepMs: PARAMS.demoTapMs, waitMs: PARAMS.demoWaitMs, fadeMs: PARAMS.demoFadeMs };
    return new DemoDirector(game, { rounds: PARAMS.demoStages, timing }, now);
}
