import { attachAnalysisWorker, type AnalysisRequest, type AnalysisResponse } from './analysisJob';

// Worker entry: answers every analysis request with the result of `analyzePuzzle`.
attachAnalysisWorker(self as unknown as {
    onmessage: ((event: { data: AnalysisRequest }) => void) | null;
    postMessage: (message: AnalysisResponse) => void;
});
