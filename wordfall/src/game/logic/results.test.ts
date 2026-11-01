import { describe, expect, it } from 'vitest';
import { buildResultList, clampScroll, isDragLive, maxScroll, resultInputBlocked, wheelStep } from './results';

const w = (en: string, ja: string) => ({ en, ja });

describe('buildResultList', () => {
    it('lists words in order of first appearance and marks the completed ones', () => {
        const rows = buildResultList([w('CAT', 'ねこ'), w('DOG', 'いぬ'), w('SUN', '太陽')], ['DOG']);
        expect(rows).toEqual([
            { en: 'CAT', ja: 'ねこ', done: false },
            { en: 'DOG', ja: 'いぬ', done: true },
            { en: 'SUN', ja: '太陽', done: false },
        ]);
    });

    it('merges a word that appeared twice into one row at its first position, done if completed once', () => {
        const appeared = [w('CAT', 'ねこ'), w('DOG', 'いぬ'), w('CAT', 'ねこ')];
        expect(buildResultList(appeared, ['CAT'])).toEqual([
            { en: 'CAT', ja: 'ねこ', done: true },
            { en: 'DOG', ja: 'いぬ', done: false },
        ]);
    });

    it('is empty when nothing appeared', () => {
        expect(buildResultList([], [])).toEqual([]);
    });
});

describe('scroll limits', () => {
    it('cannot scroll when the list fits the region', () => {
        expect(maxScroll(200, 326)).toBe(0);
        expect(maxScroll(326, 326)).toBe(0);
        expect(clampScroll(50, 200, 326)).toBe(0);
    });

    it('scrolls from 0 to content minus region when the list is longer', () => {
        expect(maxScroll(520, 326)).toBe(194);
        expect(clampScroll(-10, 520, 326)).toBe(0);
        expect(clampScroll(100, 520, 326)).toBe(100);
        expect(clampScroll(194, 520, 326)).toBe(194);
        expect(clampScroll(195, 520, 326)).toBe(194);
    });
});

describe('isDragLive (a drag whose finger vanished must not lock the list)', () => {
    it('is live while the dragging pointer is still down', () => {
        expect(isDragLive(2, [{ id: 1, isDown: false }, { id: 2, isDown: true }])).toBe(true);
    });

    it('is stale when the dragging pointer is up (touch cancelled, no pointerup seen)', () => {
        expect(isDragLive(2, [{ id: 1, isDown: true }, { id: 2, isDown: false }])).toBe(false);
    });

    it('is stale when no pointer has that id any more', () => {
        expect(isDragLive(5, [{ id: 1, isDown: true }])).toBe(false);
        expect(isDragLive(5, [])).toBe(false);
    });
});

describe('wheelStep', () => {
    it('scrolls 2 rows per notch in the wheel direction, whatever size the browser reports', () => {
        expect(wheelStep(100)).toBe(52); // Chrome: pixels
        expect(wheelStep(3)).toBe(52); // Firefox: lines
        expect(wheelStep(1)).toBe(52);
        expect(wheelStep(-100)).toBe(-52);
        expect(wheelStep(-3)).toBe(-52);
    });

    it('does not move for a wheel event with no vertical delta', () => {
        expect(wheelStep(0)).toBe(0);
    });
});

describe('resultInputBlocked', () => {
    it('ignores input for 500 ms and accepts it from exactly 500 ms', () => {
        expect(resultInputBlocked(0, 500)).toBe(true);
        expect(resultInputBlocked(499, 500)).toBe(true);
        expect(resultInputBlocked(500, 500)).toBe(false);
    });
});
