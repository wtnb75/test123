import { describe, expect, it } from 'vitest';
import { StartGate } from './gate';

describe('StartGate', () => {
    it('is not leaving until a start request is made', () => {
        expect(new StartGate().leaving).toBe(false);
    });

    it('accepts only the first of several start requests in one frame', () => {
        const gate = new StartGate();
        expect(gate.start()).toBe(true);
        expect(gate.start()).toBe(false);
        expect(gate.start()).toBe(false);
        expect(gate.leaving).toBe(true);
    });
});
