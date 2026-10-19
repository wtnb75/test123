import type { WorkerLike } from '../core/analysisJob';

/** Makes the analysis worker, or undefined when this environment has no Workers (the runner then runs synchronously) */
export const createAnalysisWorker = (): WorkerLike | undefined => {
    if (typeof Worker === 'undefined') {
        return undefined;
    }
    return new Worker(new URL('../core/analysis.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
};
