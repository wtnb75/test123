import { describe, expect, it } from 'vitest';
import { IDENTITY, isHiddenSide } from './math';
import { pickSpawn, tickSpawnTimer } from './spawn';
import { SHAPE, seeded, sequence } from './testing';

// With the identity pose only +Z (holes 36-44) is seen; the other 45 holes are on the hidden side.
const VISIBLE_IDS = [36, 37, 38, 39, 40, 41, 42, 43, 44];
const hiddenIds = SHAPE.holes.filter((h) => isHiddenSide(IDENTITY, h)).map((h) => h.id);

describe('pickSpawn', () => {
    it('sanity: the identity pose splits the holes 9 seen / 45 hidden', () => {
        expect(hiddenIds).toHaveLength(45);
        expect(hiddenIds).not.toContain(36);
    });

    it('draws below the back ratio (0.59) → a hidden-side hole, below the cat ratio (0.1999) → a cat, below the decoy ratio (0.4999) → a decoy', () => {
        const { rng, calls } = sequence([0.59, 0, 0.1999, 0.4999]);
        const pick = pickSpawn(SHAPE.holes, new Set(), IDENTITY, rng);
        expect(pick?.hole.id).toBe(hiddenIds[0]);
        expect(pick?.kind).toBe('cat');
        expect(pick?.decoy).toBe(true);
        expect(calls()).toBe(4);
    });

    it('draws exactly the decoy ratio (0.5) → a plain cat (still four draws)', () => {
        const { rng, calls } = sequence([0.59, 0, 0.1999, 0.5]);
        const pick = pickSpawn(SHAPE.holes, new Set(), IDENTITY, rng);
        expect(pick?.kind).toBe('cat');
        expect(pick?.decoy).toBe(false);
        expect(calls()).toBe(4);
    });

    it('draws exactly the back ratio (0.6) → a seen-side hole, and exactly the cat ratio (0.2) → a mole with only three draws', () => {
        const { rng, calls } = sequence([0.6, 0, 0.2]);
        const pick = pickSpawn(SHAPE.holes, new Set(), IDENTITY, rng);
        expect(pick?.hole.id).toBe(VISIBLE_IDS[0]);
        expect(pick?.kind).toBe('mole');
        expect(pick?.decoy).toBe(false);
        expect(calls()).toBe(3);
    });

    it('over many seeded picks, decoys are about half of the cats and never moles', () => {
        const rng = seeded(7);
        let cats = 0;
        let decoys = 0;
        for (let i = 0; i < 4000; i++) {
            const pick = pickSpawn(SHAPE.holes, new Set(), IDENTITY, rng);
            if (!pick) expect.fail('no pick with all holes free');
            if (pick.kind === 'mole' && pick.decoy) expect.fail('a mole was a decoy');
            if (pick.kind === 'cat') {
                cats++;
                if (pick.decoy) decoys++;
            }
        }
        expect(cats).toBeGreaterThan(600);
        expect(decoys / cats).toBeGreaterThan(0.4);
        expect(decoys / cats).toBeLessThan(0.6);
    });

    it('picks the (draw × candidates, rounded down)-th candidate', () => {
        const { rng } = sequence([0, 0.999999, 0.5]);
        expect(pickSpawn(SHAPE.holes, new Set(), IDENTITY, rng)?.hole.id).toBe(53);
        const mid = sequence([0.6, 0.5, 0.5]);
        expect(pickSpawn(SHAPE.holes, new Set(), IDENTITY, mid.rng)?.hole.id).toBe(VISIBLE_IDS[4]);
    });

    it('never picks a hole in use', () => {
        const { rng } = sequence([0.6, 0, 0.5]);
        const pick = pickSpawn(SHAPE.holes, new Set([36, 37]), IDENTITY, rng);
        expect(pick?.hole.id).toBe(38);
    });

    it('falls back to every free hole when the wanted side has none', () => {
        const { rng } = sequence([0, 0, 0.5]); // wants the hidden side
        const pick = pickSpawn(SHAPE.holes, new Set(hiddenIds), IDENTITY, rng);
        expect(pick?.hole.id).toBe(36);
    });

    it('takes the only free hole', () => {
        const occupied = new Set(SHAPE.holes.map((h) => h.id).filter((id) => id !== 20));
        const { rng } = sequence([0.9, 0.9, 0.9]);
        expect(pickSpawn(SHAPE.holes, occupied, IDENTITY, rng)?.hole.id).toBe(20);
    });

    it('returns null without drawing any random number when no hole is free', () => {
        const { rng, calls } = sequence([]);
        const occupied = new Set(SHAPE.holes.map((h) => h.id));
        expect(pickSpawn(SHAPE.holes, occupied, IDENTITY, rng)).toBeNull();
        expect(calls()).toBe(0);
    });
});

describe('tickSpawnTimer', () => {
    it('spawns when the timer reaches exactly 0 and restarts it at 0.9', () => {
        expect(tickSpawnTimer(0.1, 0.1, 0)).toEqual({ timer: 0.9, spawn: true });
    });

    it('waits while the timer is still above 0', () => {
        const t = tickSpawnTimer(0.1, 0.05, 0);
        expect(t.spawn).toBe(false);
        expect(t.timer).toBeCloseTo(0.05, 9);
    });

    it('spawns with 3 Pops out but not with 4 (the limit), keeping the timer at or below 0', () => {
        expect(tickSpawnTimer(0, 0.016, 3).spawn).toBe(true);
        const full = tickSpawnTimer(0, 0.016, 4);
        expect(full.spawn).toBe(false);
        expect(full.timer).toBeLessThanOrEqual(0);
        // The slot frees up later: the very next update spawns, however small dt is.
        expect(tickSpawnTimer(full.timer, 0.001, 3).spawn).toBe(true);
    });
});
