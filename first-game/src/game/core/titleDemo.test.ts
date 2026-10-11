import { describe, expect, it } from 'vitest';
import { DemoDirector, type DemoEvent } from 'title-demo';
import { generateStage } from './generator';
import { createRng } from './random';
import { DEMO_GRID_MAX, DEMO_STAGES } from './title';
import { DEMO_STEP_MS, DEMO_WAIT_MS, TITLE_DEMO_OPTIONS, createTitleDemoGame, type TitleDemoDetail } from './titleDemo';

// The flow itself is tested in the shared package; these tests pin how first-game maps onto it
// (docs/spec/title-demo.md "デモの進行").

type Seen = { t: number; event: DemoEvent<TitleDemoDetail>; stageNo: number; rounds: number };

const run = (seed: number, untilMs: number, frameMs = 10) => {
  const rng = createRng(seed);
  let calls = 0;
  const countingRng = () => {
    calls += 1;
    return rng();
  };
  const demo = new DemoDirector(createTitleDemoGame(countingRng), TITLE_DEMO_OPTIONS, 0);
  const seen: Seen[] = [];
  for (let t = 1; t <= untilMs; t += frameMs) {
    const event = demo.tick(t);
    if (event) {
      seen.push({ t, event, stageNo: demo.state.stage.stageNo, rounds: demo.rounds });
    }
  }
  return { demo, seen, rngCalls: () => calls };
};

describe('title demo flow for first-game', () => {
  it('plays stage 1, 2, 3 (advance after each goal), then fades out and rebuilds from stage 1', () => {
    const { seen } = run(7, 120000);
    const kinds = seen.map((s) => s.event.kind);
    const firstFadeOut = kinds.indexOf('fade-out');
    expect(firstFadeOut).toBeGreaterThan(0);

    const advances = seen.slice(0, firstFadeOut).filter((s) => s.event.kind === 'advance');
    expect(advances.map((s) => s.stageNo)).toEqual([2, 3]);

    const fadeIn = seen.find((s) => s.event.kind === 'fade-in');
    expect(fadeIn?.stageNo).toBe(1);
    expect(fadeIn?.rounds).toBe(0);
    expect(DEMO_STAGES).toBe(3);
    // the layout reserves room for DEMO_GRID_MAX cells: every demo stage must fit
    for (let n = 1; n <= DEMO_STAGES; n += 1) {
      const stage = generateStage(n, { seed: 1 });
      expect(Math.max(stage.width, stage.height)).toBeLessThanOrEqual(DEMO_GRID_MAX);
    }
    expect(generateStage(DEMO_STAGES, { seed: 1 }).width).toBe(DEMO_GRID_MAX);
  });

  it('waits waitMs before the first action and steps stepMs apart', () => {
    const { seen } = run(7, 20000, 1);
    const actions = seen.filter((s) => s.event.kind === 'action');
    expect(actions[0].t).toBe(DEMO_WAIT_MS);
    expect(actions[1].t - actions[0].t).toBe(DEMO_STEP_MS);
  });

  it('is reproducible from an injected rng', () => {
    const a = run(11, 60000);
    const b = run(11, 60000);
    expect(JSON.stringify(a.demo.state.stage.cells)).toBe(JSON.stringify(b.demo.state.stage.cells));
    expect(a.seen.map((s) => s.event.kind)).toEqual(b.seen.map((s) => s.event.kind));
  });

  it('draws the seed of each stage from the rng, one number per stage, as floor(value * 2^31)', () => {
    const values = [0.25, 0.5, 0.75];
    let next = 0;
    const game = createTitleDemoGame(() => values[next++]);
    const state = game.start();
    const sameStage = (a: { cells: unknown; width: number; goal: unknown }, b: { cells: unknown; width: number; goal: unknown }) =>
      JSON.stringify([a.cells, a.width, a.goal]) === JSON.stringify([b.cells, b.width, b.goal]);

    expect(next).toBe(1);
    expect(sameStage(state.stage, generateStage(1, { seed: Math.floor(0.25 * 2 ** 31) }))).toBe(true);
    game.advance?.(state);
    expect(next).toBe(2);
    expect(state.stage.stageNo).toBe(2);
    expect(sameStage(state.stage, generateStage(2, { seed: Math.floor(0.5 * 2 ** 31) }))).toBe(true);
    game.advance?.(state);
    expect(next).toBe(3);
    expect(state.stage.stageNo).toBe(3);
    expect(sameStage(state.stage, generateStage(3, { seed: Math.floor(0.75 * 2 ** 31) }))).toBe(true);
  });

  it('draws 3 numbers by the first fade-out and a 4th for the rebuilt stage 1, which differs from the first run', () => {
    const base = createRng(31);
    let calls = 0;
    const demo = new DemoDirector(
      createTitleDemoGame(() => {
        calls += 1;
        return base();
      }),
      TITLE_DEMO_OPTIONS,
      0
    );
    expect(calls).toBe(1);
    const firstStage1 = JSON.stringify(demo.state.stage.cells);
    let atFadeOut = -1;
    let atFadeIn = -1;
    for (let t = 1; t <= 120000 && atFadeIn < 0; t += 10) {
      const event = demo.tick(t);
      if (event?.kind === 'fade-out') {
        atFadeOut = calls;
      }
      if (event?.kind === 'fade-in') {
        atFadeIn = calls;
      }
    }
    expect(atFadeOut).toBe(3);
    expect(atFadeIn).toBe(4);
    expect(demo.state.stage.stageNo).toBe(1);
    expect(JSON.stringify(demo.state.stage.cells)).not.toBe(firstStage1);
  });

  it('leaves the game generator untouched: the same seed gives the same stage before and after a demo run', () => {
    const args = { seed: 424242, maxGenerationMs: 60000 };
    const before = generateStage(5, args);
    run(3, 60000);
    const after = generateStage(5, args);
    expect(JSON.stringify(after.cells)).toBe(JSON.stringify(before.cells));
    expect(after.goal).toEqual(before.goal);
    expect(after.start).toEqual(before.start);
  });

  it('refuses an action the rules reject, without changing the state (the director then re-plans)', () => {
    const game = createTitleDemoGame(createRng(5));
    const state = game.start();
    const before = JSON.stringify(state.stage);

    const onOpenCell = game.play(state, { kind: 'flag', pos: state.stage.player });
    expect(onOpenCell).toEqual({ moved: false, roundDone: false, detail: { changed: [] } });

    const bomb = state.stage.cells.findIndex((c) => c.hasBomb);
    const pos = { x: bomb % state.stage.width, y: Math.floor(bomb / state.stage.width) };
    const onBomb = game.play(state, { kind: 'move', pos });
    expect(onBomb.moved).toBe(false);
    expect(JSON.stringify(state.stage)).toBe(before);
  });

  it('never kills the bot and never asks for a re-plan (every action is played)', () => {
    const { seen } = run(23, 90000);
    expect(seen.filter((s) => s.event.kind === 'action').length).toBeGreaterThan(10);
    // a rebuild may only follow a run that cleared every stage (a re-plan or early fade-out would show a lower count)
    const fadeOuts = seen.filter((s) => s.event.kind === 'fade-out');
    expect(fadeOuts.length).toBeGreaterThan(0);
    expect(fadeOuts.every((s) => s.rounds === DEMO_STAGES)).toBe(true);
  });
});
