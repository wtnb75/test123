import type { DemoGame, DemoOptions } from 'title-demo';
import { PARAMS } from '../params';

// How long a demo run lasts and when the Title rebuilds it, for the shared TitleDemoRunner. The runner's one
// "round" is a no-op that ends at the half-way point; a wait of the same length follows, so the curtain starts
// to close demoRunSeconds after the run began (docs/spec/title-demo.md "走りの作り直し").

export type RunState = null;
export type RunAction = 0;

export const DEMO_RUN_GAME: DemoGame<RunState, RunAction, null> = {
    start: () => null,
    plan: () => [0],
    play: () => ({ moved: true, roundDone: true, detail: null }),
};

export const DEMO_RUN_OPTIONS: DemoOptions = {
    rounds: 1,
    timing: { stepMs: 0, waitMs: (PARAMS.demoRunSeconds * 1000) / 2, fadeMs: PARAMS.demoFadeSeconds * 1000 },
};
