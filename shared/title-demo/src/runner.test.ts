import { describe, expect, it } from 'vitest';
import type { DemoGame } from './director';
import { TitleDemoRunner } from './runner';

interface Counter {
    played: number;
}

/** Three actions per run; the third finishes the round. */
const game: DemoGame<Counter, number, number> = {
    start: () => ({ played: 0 }),
    plan: () => [1, 2, 3],
    play: (state, action) => {
        state.played += 1;
        return { moved: true, roundDone: action === 3, detail: action };
    }
};

// the example of the README: stepMs 220, waitMs 500, fadeMs 300, one round per run
const options = { rounds: 1, timing: { stepMs: 220, waitMs: 500, fadeMs: 300 } };

const run = (runner: TitleDemoRunner<Counter, number, number>, until: number, delta = 1): [number, string][] => {
    const events: [number, string][] = [];

    while (runner.clock < until) {
        const event = runner.update(delta);

        if (event !== null) {
            events.push([runner.clock, event.kind]);
        }
    }

    return events;
};

describe('TitleDemoRunner', () => {
    it('plays the README timeline from the accumulated update deltas (500, 720, 940, fade-out 1440, fade-in 1740)', () => {
        const runner = new TitleDemoRunner(game, options);
        expect(run(runner, 2540)).toEqual([
            [500, 'action'],
            [720, 'action'],
            [940, 'action'],
            [1440, 'fade-out'],
            [1740, 'fade-in'],
            [2540, 'action']
        ]);
    });

    it('counts the clock from the deltas, whatever their size', () => {
        const runner = new TitleDemoRunner(game, options);
        runner.update(16.5);
        runner.update(33.5);
        expect(runner.clock).toBe(50);
    });

    it('ignores a negative delta (the clock never goes back)', () => {
        const runner = new TitleDemoRunner(game, options);
        runner.update(100);
        runner.update(-40);
        expect(runner.clock).toBe(100);
    });

    it('moves at most one step per update, even after a very long frame', () => {
        const runner = new TitleDemoRunner(game, options);
        expect(runner.update(5000)?.kind).toBe('action');
        expect(runner.state.played).toBe(1);
        // the next step is due `stepMs` after the one that was played, not caught up in a burst
        expect(runner.update(1)).toBeNull();
        expect(runner.state.played).toBe(1);
        expect(runner.update(220)?.kind).toBe('action');
    });

    it('is not leaving until a start is requested, and accepts only the first request', () => {
        const runner = new TitleDemoRunner(game, options);
        expect(runner.leaving).toBe(false);
        expect(runner.requestStart()).toBe(true);
        expect(runner.requestStart()).toBe(false);
        expect(runner.leaving).toBe(true);
    });

    it('stops ticking and freezes the clock once a start was accepted (an action due that frame is not played)', () => {
        const runner = new TitleDemoRunner(game, options);
        run(runner, 499);
        expect(runner.requestStart()).toBe(true);

        expect(runner.update(1)).toBeNull();
        expect(runner.update(1000)).toBeNull();
        expect(runner.clock).toBe(499);
        expect(runner.state.played).toBe(0);
    });

    it('opacity is 1 while playing, 0.5 half way through the fade-out, 0 when the run is rebuilt', () => {
        const runner = new TitleDemoRunner(game, options);
        run(runner, 1439);
        expect(runner.opacity()).toBe(1);

        run(runner, 1590);
        expect(runner.opacity()).toBeCloseTo(0.5, 5);

        run(runner, 1740);
        expect(runner.opacity()).toBe(0);
    });

    it('exposes the state of the current run, which is a new one after the rebuild', () => {
        const runner = new TitleDemoRunner(game, options);
        run(runner, 940);
        expect(runner.state.played).toBe(3);

        run(runner, 1740);
        expect(runner.state.played).toBe(0);
        expect(runner.state).toBe(runner.director.state);
    });
});
