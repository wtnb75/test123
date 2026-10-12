import type { DemoGame, DemoOptions } from 'title-demo';
import { DEMO_FADE, DEMO_RUN_SECONDS } from './constants';

// How long a demo run lasts and when the title rebuilds it, expressed for the shared TitleDemoRunner.
// The runner's one "round" is a no-op that ends at the half-way point; a wait of the same length then
// follows, so the curtain starts to close DEMO_RUN_SECONDS after the run began (docs/spec/title-demo.md).

/** The demo has no state of its own: the Demo scene holds the world. */
export type RunState = null;
export type RunAction = 0;

export const DEMO_RUN_GAME: DemoGame<RunState, RunAction, null> = {
    start: () => null,
    plan: () => [0],
    play: () => ({ moved: true, roundDone: true, detail: null })
};

export const DEMO_RUN_OPTIONS: DemoOptions = {
    rounds: 1,
    timing: { stepMs: 0, waitMs: (DEMO_RUN_SECONDS * 1000) / 2, fadeMs: DEMO_FADE * 1000 }
};
