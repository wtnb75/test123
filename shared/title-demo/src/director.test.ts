import { describe, expect, it } from 'vitest';
import { DemoDirector, type DemoEvent, type DemoGame, type DemoOptions, type Plan, type PlayResult } from './director';

/** A game made of numbers: the state counts what was played. Actions are plain numbers; `rounds` end on `endsRound`. */
interface Probe {
    runs: number;
    played: number[];
    advanced: number;
}

interface Script {
    plan?: (state: Probe, calls: number) => Plan<number>;
    /** Actions that end a round. */
    endsRound?: number[];
    /** Actions that cannot be played. */
    blocked?: number[];
    advance?: boolean;
}

const THREE = [1, 2, 3];

function makeGame(script: Script = {}) {
    const calls = { plan: 0, start: 0 };
    const game: DemoGame<Probe, number, string> = {
        start: () => {
            calls.start++;
            return { runs: calls.start, played: [], advanced: 0 };
        },
        plan: (state) => {
            calls.plan++;
            return script.plan ? script.plan(state, calls.plan) : THREE;
        },
        play: (state, action): PlayResult<string> => {
            if (script.blocked?.includes(action)) return { moved: false, roundDone: false, detail: `blocked ${action}` };
            state.played.push(action);
            return { moved: true, roundDone: (script.endsRound ?? [3]).includes(action), detail: `played ${action}` };
        },
        ...(script.advance ? { advance: (state: Probe) => void state.advanced++ } : {}),
    };
    return { game, calls };
}

const TIMING = { stepMs: 220, waitMs: 500, fadeMs: 300 };
const options = (rounds: number): DemoOptions => ({ rounds, timing: TIMING });
const kinds = (e: DemoEvent<string> | null): string | null => (e ? e.kind : null);

describe('DemoDirector timing', () => {
    it('plays the first action after the wait, then one action per step', () => {
        const { game } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        expect(d.tick(0)).toBeNull();
        expect(d.tick(499)).toBeNull();
        expect(d.tick(500)).toEqual({ kind: 'action', detail: 'played 1' });
        expect(d.phase).toBe('stepping');
        expect(d.tick(719)).toBeNull();
        expect(d.tick(720)).toEqual({ kind: 'action', detail: 'played 2' });
        expect(d.tick(939)).toBeNull();
        expect(d.tick(940)).toEqual({ kind: 'action', detail: 'played 3' });
        expect(d.rounds).toBe(1);
        expect(d.phase).toBe('waiting');
    });

    it('fades out one wait after the last round, swaps the run, fades in and waits again', () => {
        const { game, calls } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        d.tick(500);
        d.tick(720);
        d.tick(940);
        expect(d.tick(1439)).toBeNull();
        expect(d.tick(1440)).toEqual({ kind: 'fade-out' });
        expect(d.opacity(1440)).toBe(1);
        expect(d.opacity(1590)).toBe(0.5);
        expect(d.tick(1739)).toBeNull();
        expect(d.state.runs).toBe(1);
        expect(d.tick(1740)).toEqual({ kind: 'fade-in' });
        expect(d.state.runs).toBe(2);
        expect(calls.start).toBe(2);
        expect(d.rounds).toBe(0);
        expect(d.opacity(1740)).toBe(0);
        expect(d.opacity(1890)).toBe(0.5);
        expect(d.tick(2039)).toBeNull();
        expect(d.phase).toBe('fading-in');
        expect(d.tick(2040)).toBeNull();
        expect(d.phase).toBe('waiting');
        expect(d.opacity(2040)).toBe(1);
        expect(d.tick(2539)).toBeNull();
        expect(d.tick(2540)).toEqual({ kind: 'action', detail: 'played 1' });
    });

    it('makes at most one move per call and counts the next deadline from the move that was made', () => {
        const { game } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        expect(kinds(d.tick(5000))).toBe('action');
        expect(d.tick(5000)).toBeNull();
        expect(d.tick(5001)).toBeNull();
        expect(d.tick(5219)).toBeNull();
        expect(kinds(d.tick(5220))).toBe('action');
    });

    it('counts as many rounds as an action reports (a move that finishes two rounds at once)', () => {
        const { game } = makeGame();
        const twoAtOnce: typeof game = {
            ...game,
            play: (state, action) => {
                state.played.push(action);
                return { moved: true, roundDone: action === 3, roundsDone: action === 3 ? 2 : undefined, detail: 'x' };
            },
        };
        const d = new DemoDirector(twoAtOnce, options(2), 0);
        d.tick(500);
        d.tick(720);
        d.tick(940);
        expect(d.rounds).toBe(2);
        expect(d.tick(1440)).toEqual({ kind: 'fade-out' });
    });

    it('opacity is 1 outside the fades', () => {
        const { game } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        expect(d.opacity(0)).toBe(1);
        expect(d.opacity(-100)).toBe(1);
        d.tick(500);
        expect(d.opacity(600)).toBe(1);
    });

    it('clamps the opacity into 0..1 while fading, before the fade began and long after it should have ended', () => {
        const { game } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        [500, 720, 940].forEach((t) => d.tick(t));
        d.tick(1440); // fade-out begins
        expect(d.opacity(1000)).toBe(1); // before the fade began
        expect(d.opacity(1440 + 10 * 300)).toBe(0); // long after
        d.tick(1740); // fade-in begins
        expect(d.opacity(1740 - 100)).toBe(0);
        expect(d.opacity(1740 + 10 * 300)).toBe(1);
    });

    it('a fade of no length is over at once: the opacity is 0 / 1, never NaN', () => {
        const { game } = makeGame();
        const d = new DemoDirector(game, { rounds: 1, timing: { stepMs: 220, waitMs: 500, fadeMs: 0 } }, 0);
        [500, 720, 940].forEach((t) => d.tick(t));
        expect(d.tick(1440)).toEqual({ kind: 'fade-out' });
        expect(d.opacity(1440)).toBe(0);
        expect(d.tick(1440)).toEqual({ kind: 'fade-in' });
        expect(d.opacity(1440)).toBe(1);
    });

    it('counts waits and fades from the tick that changed the phase (a late tick does not shorten what follows)', () => {
        const { game } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        [500, 720, 940].forEach((t) => d.tick(t));
        expect(d.tick(1500)).toEqual({ kind: 'fade-out' }); // 60 ms late
        expect(d.tick(1799)).toBeNull();
        expect(d.tick(1800)).toEqual({ kind: 'fade-in' });
        expect(d.tick(2200)).toBeNull(); // 100 ms into the fade-in's end: the wait starts from here
        expect(d.phase).toBe('waiting');
        expect(d.tick(2699)).toBeNull();
        expect(kinds(d.tick(2700))).toBe('action');
    });
});

describe('DemoDirector planning', () => {
    it('asks for the plan on a frame after the wait began, once per wait', () => {
        const { game, calls } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        d.tick(0);
        expect(calls.plan).toBe(0);
        d.tick(1);
        expect(calls.plan).toBe(1);
        d.tick(2);
        d.tick(400);
        expect(calls.plan).toBe(1);
    });

    it('asks at the end of the wait when no frame came in between', () => {
        const { game, calls } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        expect(kinds(d.tick(500))).toBe('action');
        expect(calls.plan).toBe(1);
    });

    it('does not plan in the wait after the last round, and fades out even if a plan would be pending', () => {
        const { game, calls } = makeGame();
        const d = new DemoDirector(game, options(1), 0);
        d.tick(500);
        d.tick(720);
        d.tick(940);
        for (let t = 941; t < 1440; t += 13) expect(d.tick(t)).toBeNull();
        expect(calls.plan).toBe(1);
        expect(d.tick(1440)).toEqual({ kind: 'fade-out' });
    });

    it('fades out at the end of the wait when there is no plan, then plays after the next wait', () => {
        let first = true;
        const { game } = makeGame({
            plan: () => {
                if (!first) return THREE;
                first = false;
                return null;
            },
        });
        const d = new DemoDirector(game, options(2), 0);
        expect(d.tick(499)).toBeNull();
        expect(d.tick(500)).toEqual({ kind: 'fade-out' });
        expect(d.tick(800)).toEqual({ kind: 'fade-in' });
        expect(d.tick(1100)).toBeNull();
        expect(d.phase).toBe('waiting');
        expect(d.tick(1599)).toBeNull();
        expect(kinds(d.tick(1600))).toBe('action');
    });

    it('waits for a pending plan and moves as soon as it is ready (asked again each call)', () => {
        let ready = false;
        const { game, calls } = makeGame({ plan: () => (ready ? THREE : 'pending') });
        const d = new DemoDirector(game, options(1), 0);
        expect(d.tick(500)).toBeNull();
        expect(d.tick(600)).toBeNull();
        expect(calls.plan).toBe(2);
        expect(d.phase).toBe('waiting');
        ready = true;
        expect(kinds(d.tick(700))).toBe('action');
        expect(calls.plan).toBe(3);
    });

    it('uses a plan that finished before the end of the wait at the end of the wait', () => {
        let ready = false;
        const { game } = makeGame({ plan: () => (ready ? THREE : 'pending') });
        const d = new DemoDirector(game, options(1), 0);
        expect(d.tick(100)).toBeNull();
        ready = true;
        expect(d.tick(300)).toBeNull();
        expect(d.tick(499)).toBeNull();
        expect(kinds(d.tick(500))).toBe('action');
    });

    it('treats an empty plan as nothing to play and plans again after another wait (no fade-out)', () => {
        const { game, calls } = makeGame({ plan: () => [] });
        const d = new DemoDirector(game, options(1), 0);
        expect(d.tick(500)).toBeNull();
        expect(d.phase).toBe('waiting');
        expect(d.tick(1000)).toBeNull();
        expect(calls.plan).toBe(2);
    });

    it('plans again when a planned action cannot be played', () => {
        const { game, calls } = makeGame({ blocked: [1] });
        const d = new DemoDirector(game, options(1), 0);
        expect(d.tick(500)).toBeNull();
        expect(d.phase).toBe('waiting');
        expect(d.state.played).toEqual([]);
        expect(d.tick(1000)).toBeNull();
        expect(calls.plan).toBe(2);
    });

    it('plans again when a plan runs out without finishing the round', () => {
        const { game, calls } = makeGame({ plan: () => [1], endsRound: [] });
        const d = new DemoDirector(game, options(1), 0);
        expect(kinds(d.tick(500))).toBe('action');
        expect(d.phase).toBe('waiting');
        expect(d.rounds).toBe(0);
        expect(kinds(d.tick(1000))).toBe('action');
        expect(calls.plan).toBe(2);
    });

    it('plays an action that is 0 (falsy actions are real actions)', () => {
        const { game } = makeGame({ plan: () => [0, 1, 2], endsRound: [2] });
        const d = new DemoDirector(game, options(1), 0);
        d.tick(500);
        d.tick(720);
        d.tick(940);
        expect(d.state.played).toEqual([0, 1, 2]);
        expect(d.rounds).toBe(1);
    });
});

describe('DemoDirector with an advance step', () => {
    it('holds the finished round for a wait, advances without planning, waits again, then plans', () => {
        const { game, calls } = makeGame({ advance: true });
        const d = new DemoDirector(game, options(2), 0);
        d.tick(500);
        d.tick(720);
        d.tick(940); // round 1 done
        expect(calls.plan).toBe(1);
        for (let t = 941; t < 1440; t += 17) expect(d.tick(t)).toBeNull();
        expect(calls.plan).toBe(1); // not asked in the wait before advance
        expect(d.tick(1440)).toEqual({ kind: 'advance' });
        expect(d.state.advanced).toBe(1);
        expect(d.phase).toBe('waiting');
        expect(d.tick(1441)).toBeNull();
        expect(calls.plan).toBe(2);
        expect(d.tick(1939)).toBeNull();
        expect(kinds(d.tick(1940))).toBe('action');
        d.tick(2160);
        d.tick(2380); // round 2 done: the run is over, no advance
        expect(d.rounds).toBe(2);
        expect(d.tick(2880)).toEqual({ kind: 'fade-out' });
        expect(d.state.advanced).toBe(1);
    });

    it('does not advance after a wait that did not follow a finished round', () => {
        const { game } = makeGame({ advance: true, plan: () => [] });
        const d = new DemoDirector(game, options(2), 0);
        d.tick(500);
        d.tick(1000);
        expect(d.state.advanced).toBe(0);
    });
});
