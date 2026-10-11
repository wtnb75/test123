import { describe, expect, it } from 'vitest';
import { PARAMS } from './params';

describe('Title regression (docs/spec.md 完了条件: the demo must not change these)', () => {
    it('leaves the Start pulse and the scene fade as they were before the demo existed', () => {
        expect(PARAMS.startPulseMs).toBe(1200);
        expect(PARAMS.startPulseScale).toBe(1.05);
        expect(PARAMS.sceneFadeMs).toBe(150);
    });
});
