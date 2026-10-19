import { analyzePuzzle } from './solver';
import type { AnalysisResult, BinaryCell } from './types';

// Asynchronous analysis (docs/spec/analysis-async.md): requests, cancellation, stale results and the
// synchronous fallback live here, free of Phaser and of the real Worker.

/** The analysis timeout (ms), measured inside the worker (docs/spec/solver.md) */
export const ANALYSIS_TIMEOUT_MS = 3000;
/** No answer from the worker after this long (2x the timeout): stop it and run the request synchronously */
export const ANALYSIS_WATCHDOG_MS = 6000;

export type AnalysisRequest = {
    id: number;
    solution: BinaryCell[][];
    rowHints: number[][];
    colHints: number[][];
    maxMillis: number;
};

export type AnalysisResponse = {
    id: number;
    result: AnalysisResult;
};

export type AnalyzeFn = (
    solution: BinaryCell[][],
    rowHints: number[][],
    colHints: number[][],
    maxMillis: number,
) => AnalysisResult;

/** The part of `Worker` the runner uses (a fake in the tests) */
export interface WorkerLike {
    postMessage(message: AnalysisRequest): void;
    terminate(): void;
    onmessage: ((event: { data: AnalysisResponse }) => void) | null;
    onerror: ((event: unknown) => void) | null;
    onmessageerror: ((event: unknown) => void) | null;
}

export type Scheduler = {
    set: (callback: () => void, ms: number) => unknown;
    clear: (handle: unknown) => void;
};

/** What the worker does with one request: the same `analyzePuzzle` call the main thread would make */
export const handleAnalysisRequest = (request: AnalysisRequest, analyze: AnalyzeFn = analyzePuzzle): AnalysisResponse => ({
    id: request.id,
    result: analyze(request.solution, request.rowHints, request.colHints, request.maxMillis),
});

/** Wires a worker global scope: every message is answered with the result of its request */
export const attachAnalysisWorker = (
    scope: { onmessage: ((event: { data: AnalysisRequest }) => void) | null; postMessage: (message: AnalysisResponse) => void },
    analyze: AnalyzeFn = analyzePuzzle,
): void => {
    scope.onmessage = (event) => {
        scope.postMessage(handleAnalysisRequest(event.data, analyze));
    };
};

export type AnalysisRunnerOptions<Tag> = {
    /** Makes a worker; undefined (or a throw) means workers are not available */
    createWorker: () => WorkerLike | undefined;
    analyze?: AnalyzeFn;
    onResult: (result: AnalysisResult, tag: Tag) => void;
    scheduler?: Scheduler;
    watchdogMs?: number;
};

const defaultScheduler: Scheduler = {
    set: (callback, ms) => setTimeout(callback, ms),
    clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Runs analyses in a worker, one at a time: a new request stops the running one, only the latest
 * request's result is delivered, and when a worker is unavailable, fails or stops answering, requests
 * are run synchronously with the same function (same values).
 */
export class AnalysisRunner<Tag = undefined> {
    private readonly createWorker: () => WorkerLike | undefined;
    private readonly analyze: AnalyzeFn;
    private readonly onResult: (result: AnalysisResult, tag: Tag) => void;
    private readonly scheduler: Scheduler;
    private readonly watchdogMs: number;
    private worker: WorkerLike | undefined;
    private useSync = false;
    private lastId = 0;
    private current: { request: AnalysisRequest; tag: Tag } | null = null;
    private watchdog: unknown;

    constructor(options: AnalysisRunnerOptions<Tag>) {
        this.createWorker = options.createWorker;
        this.analyze = options.analyze ?? analyzePuzzle;
        this.onResult = options.onResult;
        this.scheduler = options.scheduler ?? defaultScheduler;
        this.watchdogMs = options.watchdogMs ?? ANALYSIS_WATCHDOG_MS;
    }

    /** True while a request is running and its result has not been delivered */
    get pending(): boolean {
        return this.current !== null;
    }

    /**
     * Starts an analysis of this board (stopping the running one). With a worker the result arrives later;
     * in the synchronous fallback it is delivered before this returns. Returns the request id.
     */
    request(solution: BinaryCell[][], rowHints: number[][], colHints: number[][], tag: Tag, maxMillis = ANALYSIS_TIMEOUT_MS): number {
        this.stopRunning();
        const request: AnalysisRequest = { id: ++this.lastId, solution, rowHints, colHints, maxMillis };
        this.current = { request, tag };
        if (this.useSync || !this.dispatch(request)) {
            this.runSync();
        }
        return request.id;
    }

    /** Drops the running request without delivering a result */
    cancel(): void {
        this.stopRunning();
        this.current = null;
    }

    /** Stops the worker and forgets the running request (Scene shutdown) */
    dispose(): void {
        this.cancel();
        this.worker?.terminate();
        this.worker = undefined;
    }

    private stopRunning(): void {
        if (this.watchdog !== undefined) {
            this.scheduler.clear(this.watchdog);
            this.watchdog = undefined;
        }
        if (this.current !== null && this.worker) {
            // a running analysis is stopped for good: the worker is terminated and made again when needed
            this.worker.terminate();
            this.worker = undefined;
        }
    }

    /** Sends the request to a worker; false when that is not possible (then the caller runs it synchronously) */
    private dispatch(request: AnalysisRequest): boolean {
        try {
            if (!this.worker) {
                this.worker = this.createWorker();
            }
            if (!this.worker) {
                this.useSync = true;
                return false;
            }
            const worker = this.worker;
            // events of a worker that has been stopped (or replaced) are not this request's
            worker.onmessage = (event) => this.handleMessage(event.data);
            worker.onerror = () => this.handleFailure(worker);
            worker.onmessageerror = () => this.handleFailure(worker);
            worker.postMessage(request);
            this.watchdog = this.scheduler.set(() => this.handleFailure(worker), this.watchdogMs);
            return true;
        } catch {
            this.useSync = true;
            this.worker?.terminate();
            this.worker = undefined;
            return false;
        }
    }

    private handleMessage(response: AnalysisResponse): void {
        if (this.current === null || response.id !== this.current.request.id) {
            return;
        }
        const { tag } = this.current;
        this.current = null;
        if (this.watchdog !== undefined) {
            this.scheduler.clear(this.watchdog);
            this.watchdog = undefined;
        }
        this.onResult(response.result, tag);
    }

    /** An error or silence from `worker`: ignored unless it is the current worker and a request is running */
    private handleFailure(worker: WorkerLike): void {
        if (this.worker !== worker) {
            return;
        }
        if (this.current === null) {
            // an idle worker that fails is just dropped; the next request makes a new one
            this.worker.terminate();
            this.worker = undefined;
            return;
        }
        this.fallBack();
    }

    /** The worker failed or stopped answering: use the synchronous call from now on, starting with this request */
    private fallBack(): void {
        this.useSync = true;
        if (this.watchdog !== undefined) {
            this.scheduler.clear(this.watchdog);
            this.watchdog = undefined;
        }
        this.worker?.terminate();
        this.worker = undefined;
        if (this.current !== null) {
            this.runSync();
        }
    }

    private runSync(): void {
        if (this.current === null) {
            return;
        }
        const { request, tag } = this.current;
        // released first: if `analyze` throws, the runner is not left pending forever
        this.current = null;
        const result = this.analyze(request.solution, request.rowHints, request.colHints, request.maxMillis);
        this.onResult(result, tag);
    }
}
