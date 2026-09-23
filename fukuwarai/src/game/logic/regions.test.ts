import { describe, it, expect } from 'vitest';
import { regionForY } from './regions';

describe('regionForY', () => {
    it('classifies a point just above the boundary as the placement area', () => {
        expect(regionForY(699, 700)).toBe('placement');
    });

    it('classifies a point exactly at the boundary as the tray', () => {
        expect(regionForY(700, 700)).toBe('tray');
    });

    it('classifies a point just below the boundary as the tray', () => {
        expect(regionForY(701, 700)).toBe('tray');
    });
});
