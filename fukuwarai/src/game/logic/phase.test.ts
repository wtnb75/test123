import { describe, it, expect } from 'vitest';
import { beginPlacement, beginScoring } from './phase';

describe('beginPlacement', () => {
    it('moves from reveal to placement', () => {
        expect(beginPlacement('reveal')).toBe('placement');
    });

    it('is a no-op when not in reveal', () => {
        expect(beginPlacement('placement')).toBe('placement');
        expect(beginPlacement('scoring')).toBe('scoring');
    });
});

describe('beginScoring', () => {
    it('moves from placement to scoring', () => {
        expect(beginScoring('placement')).toBe('scoring');
    });

    it('is a no-op when not in placement', () => {
        expect(beginScoring('reveal')).toBe('reveal');
        expect(beginScoring('scoring')).toBe('scoring');
    });
});
