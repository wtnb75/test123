import { describe, expect, it } from 'vitest';
import { Crumble } from './crumble';

describe('Crumble.followRise (docs/spec/stuck-crumble.md: the cell follows a rise)', () => {
    it('moves the blinking cell up one row and keeps its column and time', () => {
        const crumble = new Crumble();
        crumble.target = { c: 4, r: 10, t: 0.75 };
        crumble.sealedFor = 0;
        crumble.followRise();
        expect(crumble.target).toEqual({ c: 4, r: 9, t: 0.75 });
        expect(crumble.sealedFor).toBe(0);
    });

    it('does nothing while no cell is blinking', () => {
        const crumble = new Crumble();
        crumble.sealedFor = 0.4;
        crumble.followRise();
        expect(crumble.target).toBeNull();
        expect(crumble.sealedFor).toBe(0.4);
    });
});
