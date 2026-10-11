// The Title demo as a `DemoGame` for the shared `title-demo` package (docs/spec/title-demo.md).
import type { DemoGame, DemoOptions } from 'title-demo';
import { applyDemoAction, planDemo, type DemoAction } from './demoBot';
import { generateStage } from './generator';
import { DEMO_STAGES } from './title';
import type { Stage } from './types';

export const DEMO_STEP_MS = 250;
export const DEMO_WAIT_MS = 700;
export const DEMO_FADE_MS = 400;

export const TITLE_DEMO_OPTIONS: DemoOptions = {
  rounds: DEMO_STAGES,
  timing: { stepMs: DEMO_STEP_MS, waitMs: DEMO_WAIT_MS, fadeMs: DEMO_FADE_MS }
};

export type TitleDemoState = { stage: Stage };

/** What the Scene needs to redraw after one action. */
export type TitleDemoDetail = { changed: number[] };

const SEED_RANGE = 2 ** 31;

/**
 * `rng` returns a number in [0, 1); one call picks the seed of each generated stage, so a run is reproducible
 * from an injected `rng`. It reads no storage and does not look at the start stage.
 */
export const createTitleDemoGame = (rng: () => number = Math.random): DemoGame<TitleDemoState, DemoAction, TitleDemoDetail> => {
  const stageFor = (stageNo: number): Stage => generateStage(stageNo, { seed: Math.floor(rng() * SEED_RANGE) });

  return {
    start: () => ({ stage: stageFor(1) }),
    plan: (state) => planDemo(state.stage),
    play: (state, action) => {
      const out = applyDemoAction(state.stage, action);
      if (out.status === 'invalid' || out.status === 'dead') {
        return { moved: false, roundDone: false, detail: { changed: [] } };
      }
      state.stage = out.stage;
      return { moved: true, roundDone: out.status === 'goal', detail: { changed: out.changed } };
    },
    advance: (state) => {
      state.stage = stageFor(state.stage.stageNo + 1);
    }
  };
};
