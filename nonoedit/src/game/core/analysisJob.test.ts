import { describe, expect, it, vi } from 'vitest';
import {
    ANALYSIS_TIMEOUT_MS,
    ANALYSIS_WATCHDOG_MS,
    AnalysisRunner,
    attachAnalysisWorker,
    handleAnalysisRequest,
    type AnalysisRequest,
    type AnalysisResponse,
    type AnalyzeFn,
    type Scheduler,
    type WorkerLike,
} from './analysisJob';
import { analyzePuzzle } from './solver';
import { generateColHints, generateRowHints } from './hints';
import type { AnalysisResult, BinaryCell } from './types';

/** A hand-driven stand-in for a Worker */
class FakeWorker implements WorkerLike {
    onmessage: ((event: { data: AnalysisResponse }) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onmessageerror: ((event: unknown) => void) | null = null;
    terminated = false;
    readonly requests: AnalysisRequest[] = [];

    postMessage(message: AnalysisRequest): void {
        this.requests.push(message);
    }

    terminate(): void {
        this.terminated = true;
    }

    /** Answers a request as the real worker would (the same analyze function) */
    answer(request: AnalysisRequest, result: AnalysisResult): void {
        this.onmessage?.({ data: { id: request.id, result } });
    }
}

/** A scheduler whose timers fire only when the test says so */
const fakeScheduler = () => {
    let next = 1;
    const timers = new Map<number, { callback: () => void; ms: number }>();
    const scheduler: Scheduler = {
        set: (callback, ms) => {
            const handle = next++;
            timers.set(handle, { callback, ms });
            return handle;
        },
        clear: (handle) => {
            timers.delete(handle as number);
        },
    };
    return {
        scheduler,
        timers,
        /** fires every timer that is due after `ms` of waiting */
        advance(ms: number) {
            for (const [handle, timer] of [...timers]) {
                if (timer.ms <= ms) {
                    timers.delete(handle);
                    timer.callback();
                }
            }
        },
    };
};

const result = (overrides: Partial<AnalysisResult> = {}): AnalysisResult => ({
    solvable: true,
    unique: true,
    logical: true,
    remainingCells: 0,
    techniquesUsed: { 'full-line-fill': 1 },
    score: 1,
    difficulty: 'easy',
    timedOut: false,
    ...overrides,
});

const board = (rows: string[]): BinaryCell[][] => rows.map((r) => r.split('').map((c) => (c === '#' ? 1 : 0) as BinaryCell));

const boardA = board(['#.', '.#']);
const boardB = board(['##', '..']);

type Setup = {
    runner: AnalysisRunner<string>;
    workers: FakeWorker[];
    results: Array<{ result: AnalysisResult; tag: string }>;
    clock: ReturnType<typeof fakeScheduler>;
    analyze: ReturnType<typeof vi.fn<AnalyzeFn>>;
    factory: ReturnType<typeof vi.fn>;
};

const setup = (options: { factory?: () => WorkerLike | undefined } = {}): Setup => {
    const workers: FakeWorker[] = [];
    const results: Array<{ result: AnalysisResult; tag: string }> = [];
    const clock = fakeScheduler();
    const analyze = vi.fn<AnalyzeFn>(() => result({ score: 99 }));
    const factory = vi.fn(
        options.factory ??
            (() => {
                const worker = new FakeWorker();
                workers.push(worker);
                return worker;
            }),
    );
    const runner = new AnalysisRunner<string>({
        createWorker: factory,
        analyze,
        onResult: (res, tag) => results.push({ result: res, tag }),
        scheduler: clock.scheduler,
    });
    return { runner, workers, results, clock, analyze, factory };
};

const hintsOf = (b: BinaryCell[][]) => ({ rows: generateRowHints(b), cols: generateColHints(b) });

describe('constants', () => {
    it('the timeout is 3000 ms and the watchdog twice that', () => {
        expect(ANALYSIS_TIMEOUT_MS).toBe(3000);
        expect(ANALYSIS_WATCHDOG_MS).toBe(6000);
    });
});

describe('AnalysisRunner: requests and results', () => {
    it('a request is sent to the worker with an id, the board, the hints and maxMillis, and the runner is pending', () => {
        const { runner, workers } = setup();
        const { rows, cols } = hintsOf(boardA);
        const id = runner.request(boardA, rows, cols, 'edit');
        expect(workers).toHaveLength(1);
        expect(workers[0].requests).toEqual([{ id, solution: boardA, rowHints: rows, colHints: cols, maxMillis: 3000 }]);
        expect(runner.pending).toBe(true);
    });

    it('the result of the latest request is delivered once with its tag, and the runner is idle again', () => {
        const { runner, workers, results } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'edit');
        workers[0].answer(workers[0].requests[0], result({ score: 7 }));
        expect(results).toEqual([{ result: result({ score: 7 }), tag: 'edit' }]);
        expect(runner.pending).toBe(false);
    });

    it('request ids increase with every request', () => {
        const { runner } = setup();
        const { rows, cols } = hintsOf(boardA);
        const first = runner.request(boardA, rows, cols, 'a');
        const second = runner.request(boardA, rows, cols, 'b');
        const third = runner.request(boardA, rows, cols, 'c');
        expect(second).toBe(first + 1);
        expect(third).toBe(second + 1);
    });

    it('an idle worker is reused for the next request', () => {
        const { runner, workers, factory } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        workers[0].answer(workers[0].requests[0], result());
        runner.request(boardB, rows, cols, 'b');
        expect(factory).toHaveBeenCalledTimes(1);
        expect(workers[0].requests).toHaveLength(2);
        expect(workers[0].terminated).toBe(false);
    });

    it('a duplicate answer to a delivered request is ignored', () => {
        const { runner, workers, results } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        const request = workers[0].requests[0];
        workers[0].answer(request, result());
        workers[0].answer(request, result({ score: 5 }));
        expect(results).toHaveLength(1);
    });
});

describe('AnalysisRunner: a new request stops the running one', () => {
    it('terminates the running worker, starts a new one, and delivers only the second result', () => {
        const { runner, workers, results } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'first');
        runner.request(boardB, rows, cols, 'second');
        expect(workers).toHaveLength(2);
        expect(workers[0].terminated).toBe(true);
        expect(workers[1].terminated).toBe(false);
        // the first worker's late answer carries a stale id
        workers[0].answer(workers[0].requests[0], result({ score: 1 }));
        expect(results).toEqual([]);
        workers[1].answer(workers[1].requests[0], result({ score: 2 }));
        expect(results).toEqual([{ result: result({ score: 2 }), tag: 'second' }]);
    });

    it('a stale id answered by the current worker is ignored too', () => {
        const { runner, workers, results } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'only');
        workers[0].onmessage?.({ data: { id: 999, result: result() } });
        expect(results).toEqual([]);
        expect(runner.pending).toBe(true);
    });

    it('stays pending while the second request runs', () => {
        const { runner } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'first');
        runner.request(boardB, rows, cols, 'second');
        expect(runner.pending).toBe(true);
    });
});

describe('AnalysisRunner: cancel and dispose', () => {
    it('cancel stops the worker, drops the request, and a later answer is ignored', () => {
        const { runner, workers, results } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        runner.cancel();
        expect(workers[0].terminated).toBe(true);
        expect(runner.pending).toBe(false);
        workers[0].answer(workers[0].requests[0], result());
        expect(results).toEqual([]);
    });

    it('dispose stops the worker and nothing is delivered afterwards', () => {
        const { runner, workers, results, clock } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        runner.dispose();
        expect(workers[0].terminated).toBe(true);
        expect(runner.pending).toBe(false);
        expect(clock.timers.size).toBe(0);
        workers[0].answer(workers[0].requests[0], result());
        expect(results).toEqual([]);
    });

    it('dispose also stops an idle worker', () => {
        const { runner, workers } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        workers[0].answer(workers[0].requests[0], result());
        runner.dispose();
        expect(workers[0].terminated).toBe(true);
    });
});

describe('AnalysisRunner: synchronous fallback', () => {
    it('a factory that returns undefined (no Worker) runs the request synchronously, before request() returns', () => {
        const { runner, results, analyze } = setup({ factory: () => undefined });
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        expect(analyze).toHaveBeenCalledWith(boardA, rows, cols, 3000);
        expect(results).toEqual([{ result: result({ score: 99 }), tag: 'a' }]);
        expect(runner.pending).toBe(false);
    });

    it('a factory that throws also falls back, and later requests do not call the factory again', () => {
        const factory = vi.fn(() => {
            throw new Error('no workers here');
        });
        const { runner, results } = setup({ factory });
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        runner.request(boardB, rows, cols, 'b');
        expect(factory).toHaveBeenCalledTimes(1);
        expect(results.map((r) => r.tag)).toEqual(['a', 'b']);
    });

    it('a postMessage that throws falls back for that request', () => {
        const worker = new FakeWorker();
        worker.postMessage = () => {
            throw new Error('DataCloneError');
        };
        const { runner, results } = setup({ factory: () => worker });
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        expect(results).toHaveLength(1);
        expect(worker.terminated).toBe(true);
    });

    it('an error from the worker during a request runs that request synchronously, and later requests skip the worker', () => {
        const { runner, workers, results, factory } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        workers[0].onerror?.(new Error('boom'));
        expect(workers[0].terminated).toBe(true);
        expect(results).toEqual([{ result: result({ score: 99 }), tag: 'a' }]);
        runner.request(boardB, rows, cols, 'b');
        expect(factory).toHaveBeenCalledTimes(1);
        expect(results.map((r) => r.tag)).toEqual(['a', 'b']);
    });

    it('a messageerror falls back the same way', () => {
        const { runner, workers, results } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        workers[0].onmessageerror?.({});
        expect(results).toHaveLength(1);
    });

    it('if the synchronous analysis throws, the error comes out and the runner is not left pending', () => {
        const { runner, analyze } = setup({ factory: () => undefined });
        analyze.mockImplementation(() => {
            throw new Error('analysis failed');
        });
        const { rows, cols } = hintsOf(boardA);
        expect(() => runner.request(boardA, rows, cols, 'a')).toThrow('analysis failed');
        expect(runner.pending).toBe(false);
    });

    it('the synchronous call gets the same arguments as the worker request', () => {
        const { runner, workers, analyze } = setup();
        const { rows, cols } = hintsOf(boardB);
        runner.request(boardB, rows, cols, 'a', 1234);
        const sent = workers[0].requests[0];
        workers[0].onerror?.(null);
        expect(analyze).toHaveBeenCalledWith(sent.solution, sent.rowHints, sent.colHints, sent.maxMillis);
        expect(sent.maxMillis).toBe(1234);
    });

    it('an error from a worker that has been replaced is ignored (no fallback, still pending)', () => {
        const { runner, workers, results, factory } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'first');
        runner.request(boardB, rows, cols, 'second');
        workers[0].onerror?.(new Error('late error from the stopped worker'));
        expect(results).toEqual([]);
        expect(runner.pending).toBe(true);
        expect(workers[1].terminated).toBe(false);
        // and the worker is still used for the next request
        workers[1].answer(workers[1].requests[0], result());
        runner.request(boardA, rows, cols, 'third');
        expect(factory).toHaveBeenCalledTimes(2);
    });

    it('an error from an idle worker only drops it; the next request makes a new worker', () => {
        const { runner, workers, results, factory } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        workers[0].answer(workers[0].requests[0], result());
        workers[0].onerror?.(new Error('idle failure'));
        expect(workers[0].terminated).toBe(true);
        runner.request(boardB, rows, cols, 'b');
        expect(factory).toHaveBeenCalledTimes(2);
        expect(workers[1].requests).toHaveLength(1);
        expect(results).toHaveLength(1);
    });
});

describe('AnalysisRunner: a worker that never answers', () => {
    it('stays pending until the watchdog time and falls back exactly at 6000 ms', () => {
        const { runner, workers, results, clock } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        clock.advance(5999);
        expect(runner.pending).toBe(true);
        expect(results).toEqual([]);
        clock.advance(6000);
        expect(workers[0].terminated).toBe(true);
        expect(results).toEqual([{ result: result({ score: 99 }), tag: 'a' }]);
        expect(runner.pending).toBe(false);
    });

    it('after a watchdog fallback, later requests are synchronous without making a worker', () => {
        const { runner, results, clock, factory } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        clock.advance(6000);
        runner.request(boardB, rows, cols, 'b');
        expect(factory).toHaveBeenCalledTimes(1);
        expect(results.map((r) => r.tag)).toEqual(['a', 'b']);
    });

    it('an answer before the watchdog cancels it', () => {
        const { runner, workers, clock, results } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        workers[0].answer(workers[0].requests[0], result());
        expect(clock.timers.size).toBe(0);
        clock.advance(10000);
        expect(results).toHaveLength(1);
    });

    it('a new request replaces the watchdog of the one it stopped', () => {
        const { runner, clock } = setup();
        const { rows, cols } = hintsOf(boardA);
        runner.request(boardA, rows, cols, 'a');
        runner.request(boardB, rows, cols, 'b');
        expect(clock.timers.size).toBe(1);
    });
});

describe('AnalysisRunner: default scheduler and the worker entry', () => {
    it('without an injected scheduler the real timers drive the 6000 ms watchdog', () => {
        vi.useFakeTimers();
        try {
            const worker = new FakeWorker();
            const results: AnalysisResult[] = [];
            const analyze = vi.fn<AnalyzeFn>(() => result({ score: 3 }));
            const runner = new AnalysisRunner<undefined>({
                createWorker: () => worker,
                analyze,
                onResult: (res) => results.push(res),
            });
            const { rows, cols } = hintsOf(boardA);
            runner.request(boardA, rows, cols, undefined);
            vi.advanceTimersByTime(5999);
            expect(results).toEqual([]);
            vi.advanceTimersByTime(1);
            expect(results).toEqual([result({ score: 3 })]);
            expect(worker.terminated).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('an answer cancels the real watchdog timer', () => {
        vi.useFakeTimers();
        try {
            const worker = new FakeWorker();
            const results: AnalysisResult[] = [];
            const runner = new AnalysisRunner<undefined>({
                createWorker: () => worker,
                analyze: vi.fn<AnalyzeFn>(() => result()),
                onResult: (res) => results.push(res),
            });
            const { rows, cols } = hintsOf(boardA);
            runner.request(boardA, rows, cols, undefined);
            worker.answer(worker.requests[0], result({ score: 8 }));
            vi.advanceTimersByTime(60000);
            expect(results).toEqual([result({ score: 8 })]);
        } finally {
            vi.useRealTimers();
        }
    });

    it('the worker entry file wires the global scope so that a message is answered with its result', async () => {
        const posted: AnalysisResponse[] = [];
        const scope = {
            onmessage: null as ((event: { data: AnalysisRequest }) => void) | null,
            postMessage: (message: AnalysisResponse) => void posted.push(message),
        };
        vi.stubGlobal('self', scope);
        try {
            await import('./analysis.worker');
            const { rows, cols } = hintsOf(boardA);
            scope.onmessage?.({ data: { id: 5, solution: boardA, rowHints: rows, colHints: cols, maxMillis: 3000 } });
            expect(posted).toHaveLength(1);
            expect(posted[0].id).toBe(5);
            expect(posted[0].result).toEqual(analyzePuzzle(boardA, rows, cols, 3000));
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

describe('handleAnalysisRequest and attachAnalysisWorker (what runs inside the worker)', () => {
    it('answers with the request id and the result of the analyze function on the same arguments', () => {
        const analyze = vi.fn<AnalyzeFn>(() => result({ score: 42 }));
        const { rows, cols } = hintsOf(boardA);
        const response = handleAnalysisRequest({ id: 7, solution: boardA, rowHints: rows, colHints: cols, maxMillis: 500 }, analyze);
        expect(response).toEqual({ id: 7, result: result({ score: 42 }) });
        expect(analyze).toHaveBeenCalledWith(boardA, rows, cols, 500);
    });

    it('a worker scope answers every message with a response', () => {
        const posted: AnalysisResponse[] = [];
        const scope = {
            onmessage: null as ((event: { data: AnalysisRequest }) => void) | null,
            postMessage: (message: AnalysisResponse) => void posted.push(message),
        };
        const analyze = vi.fn<AnalyzeFn>(() => result());
        attachAnalysisWorker(scope, analyze);
        const { rows, cols } = hintsOf(boardA);
        scope.onmessage?.({ data: { id: 1, solution: boardA, rowHints: rows, colHints: cols, maxMillis: 3000 } });
        scope.onmessage?.({ data: { id: 2, solution: boardB, rowHints: rows, colHints: cols, maxMillis: 3000 } });
        expect(posted.map((p) => p.id)).toEqual([1, 2]);
    });
});

describe('async result equals the synchronous analyzePuzzle (the worker runs the same function)', () => {
    const seeded = (seed: number) => () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const random76 = (): BinaryCell[][] => {
        const rng = seeded(31);
        return Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => (rng() < 0.5 ? 1 : 0) as BinaryCell));
    };

    const cases: Array<[string, BinaryCell[][], number[][] | undefined, number[][] | undefined]> = [
        ['an empty 5 x 5 board', board(['.....', '.....', '.....', '.....', '.....']), undefined, undefined],
        ['a plus sign (unique)', board(['..#..', '..#..', '#####', '..#..', '..#..']), undefined, undefined],
        ['a diagonal 2 x 2 (two solutions)', boardA, undefined, undefined],
        ['hints with no solution', board(['..', '..']), [[2], [0]], [[1], [0]]],
        ['a seeded random 7 x 6 board', random76(), undefined, undefined],
    ];

    const outcomes = cases.map(([name, grid, rowHints, colHints]) => {
        const rows = rowHints ?? generateRowHints(grid);
        const cols = colHints ?? generateColHints(grid);
        const viaWorker = handleAnalysisRequest({ id: 1, solution: grid, rowHints: rows, colHints: cols, maxMillis: 3000 });
        const direct = analyzePuzzle(grid, rows, cols, 3000);
        return { name, viaWorker, direct };
    });

    it.each(outcomes.map((o) => [o.name, o] as const))('%s: the worker function returns the same values', (_name, outcome) => {
        expect(outcome.viaWorker.result).toEqual(outcome.direct);
        expect(outcome.viaWorker.id).toBe(1);
        expect(outcome.direct.timedOut).toBe(false);
    });

    it('the hand-made boards are what their names say (plus sign unique, diagonal 2 x 2 not, no-solution hints unsolvable)', () => {
        const byName = (name: string) => outcomes.find((o) => o.name.startsWith(name))!.direct;
        expect(byName('a plus sign').unique).toBe(true);
        expect(byName('a diagonal').unique).toBe(false);
        expect(byName('hints with no solution').solvable).toBe(false);
    });

    it('the cases cover unique and non-unique, solvable and unsolvable results and used techniques (so the equality is not vacuous)', () => {
        const direct = outcomes.map((o) => o.direct);
        expect(direct.some((r) => r.unique)).toBe(true);
        expect(direct.some((r) => !r.unique)).toBe(true);
        expect(direct.some((r) => r.solvable)).toBe(true);
        expect(direct.some((r) => !r.solvable)).toBe(true);
        expect(direct.some((r) => Object.values(r.techniquesUsed).some((n) => (n ?? 0) > 0))).toBe(true);
    });
});
