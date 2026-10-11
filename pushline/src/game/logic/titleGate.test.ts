import { describe, expect, it } from 'vitest';
import { isStartKey, TitleGate } from './titleGate';

describe('isStartKey', () => {
    it.each(['Space', 'Enter'])('starts on %s', (code) => {
        expect(isStartKey(code, false)).toBe(true);
    });

    it.each(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'Backspace', 'KeyR'])(
        'ignores %s (a Game-only key)',
        (code) => {
            expect(isStartKey(code, false)).toBe(false);
        },
    );

    it('ignores the auto-repeat of a held Space or Enter', () => {
        expect(isStartKey('Space', true)).toBe(false);
        expect(isStartKey('Enter', true)).toBe(false);
    });
});

describe('TitleGate', () => {
    it('is not leaving until a start request is made', () => {
        expect(new TitleGate().leaving).toBe(false);
    });

    it('accepts only the first of two start requests in one frame', () => {
        const gate = new TitleGate();
        expect(gate.start()).toBe(true);
        expect(gate.start()).toBe(false);
        expect(gate.leaving).toBe(true);
    });
});
