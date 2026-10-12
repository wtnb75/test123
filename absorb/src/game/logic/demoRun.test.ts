import { describe, expect, it } from 'vitest';
import { TitleDemoRunner } from 'title-demo';
import { DEMO_RUN_GAME, DEMO_RUN_OPTIONS } from './demoRun';

describe('the demo run clock', () => {
    it('is one no-op round, waiting half the run before and after it', () => {
        expect(DEMO_RUN_OPTIONS).toEqual({ rounds: 1, timing: { stepMs: 0, waitMs: 20000, fadeMs: 500 } });
        expect(DEMO_RUN_GAME.start()).toBeNull();
        expect(DEMO_RUN_GAME.plan(null)).toEqual([0]);
        expect(DEMO_RUN_GAME.play(null, 0)).toMatchObject({ moved: true, roundDone: true });
    });

    it('closes the curtain at 40 s, rebuilds at 40.5 s and then repeats every 41 s', () => {
        const runner = new TitleDemoRunner(DEMO_RUN_GAME, DEMO_RUN_OPTIONS);
        const events: [number, string][] = [];
        const opacity: Record<number, number> = {};
        for (let t = 250; t <= 81000; t += 250) {
            const e = runner.update(250);
            if (e) events.push([t, e.kind]);
            if (t === 40250 || t === 40500 || t === 40750 || t === 41000) opacity[t] = runner.opacity();
        }
        expect(events).toEqual([
            [20000, 'action'], [40000, 'fade-out'], [40500, 'fade-in'], [61000, 'action'], [81000, 'fade-out']
        ]);
        expect(opacity).toEqual({ 40250: 0.5, 40500: 0, 40750: 0.5, 41000: 1 });
    });

    it('is fully visible from the start, so the curtain (1 - opacity) begins open', () => {
        const runner = new TitleDemoRunner(DEMO_RUN_GAME, DEMO_RUN_OPTIONS);
        expect(runner.opacity()).toBe(1);
    });
});
