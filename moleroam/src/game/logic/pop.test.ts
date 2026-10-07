import { describe, expect, it } from 'vitest';
import { applyStrike, changeLabel, judgeStrike, popState, type Pop } from './pop';

const pop = (hole: number, spawnedAt = 0, kind: Pop['kind'] = 'mole'): Pop => ({ hole, kind, spawnedAt });

describe('popState', () => {
    const p = pop(0, 1000);

    it('telegraphs for 800 ms from the spawn time', () => {
        expect(popState(p, 1000)).toBe('telegraph');
        expect(popState(p, 1799.999)).toBe('telegraph');
    });

    it('is up from exactly telegraphMs after the spawn', () => {
        expect(popState(p, 1800)).toBe('up');
    });

    it('stays up for 3000 ms and is gone at exactly the end', () => {
        expect(popState(p, 4799.999)).toBe('up');
        expect(popState(p, 4800)).toBe('gone');
        expect(popState(p, 99999)).toBe('gone');
    });
});

describe('judgeStrike', () => {
    // hole 0 is centered at (160, 160)
    const up = pop(0, 0);
    const now = 800;

    it('hits a pop that is up when the strike lands on its hole center', () => {
        expect(judgeStrike({ x: 160, y: 160 }, [up], now)).toBe(up);
    });

    it('hits at exactly hitRadius (70 px) and misses just beyond', () => {
        expect(judgeStrike({ x: 230, y: 160 }, [up], now)).toBe(up);
        expect(judgeStrike({ x: 230.01, y: 160 }, [up], now)).toBeNull();
        expect(judgeStrike({ x: 160, y: 90 }, [up], now)).toBe(up);
    });

    it('measures the straight-line distance (42-56-70 triangle hits, 43-56 misses)', () => {
        expect(judgeStrike({ x: 202, y: 216 }, [up], now)).toBe(up);
        expect(judgeStrike({ x: 203, y: 216 }, [up], now)).toBeNull();
    });

    it('cannot hit a pop that is still telegraphing', () => {
        expect(judgeStrike({ x: 160, y: 160 }, [up], 799.999)).toBeNull();
    });

    it('can hit from the first instant it is up, and not after it is gone', () => {
        expect(judgeStrike({ x: 160, y: 160 }, [up], 800)).toBe(up);
        expect(judgeStrike({ x: 160, y: 160 }, [up], 3799.999)).toBe(up);
        expect(judgeStrike({ x: 160, y: 160 }, [up], 3800)).toBeNull();
    });

    it('misses when there are no pops', () => {
        expect(judgeStrike({ x: 160, y: 160 }, [], now)).toBeNull();
    });

    it('ignores pops in other holes and finds the right one', () => {
        const other = pop(1, 0); // center (480, 160)
        expect(judgeStrike({ x: 480, y: 160 }, [up, other], now)).toBe(other);
        expect(judgeStrike({ x: 320, y: 160 }, [up, other], now)).toBeNull();
    });

    it('hits a cat the same way as a mole', () => {
        const cat = pop(9, 0, 'cat'); // center (480, 480)
        expect(judgeStrike({ x: 480, y: 480 }, [cat], now)).toBe(cat);
    });
});

describe('applyStrike', () => {
    it('adds 10 for a mole', () => {
        expect(applyStrike(0, 'mole')).toEqual({ score: 10, applied: 10 });
        expect(applyStrike(35, 'mole')).toEqual({ score: 45, applied: 10 });
    });

    it('subtracts 20 for a cat', () => {
        expect(applyStrike(50, 'cat')).toEqual({ score: 30, applied: -20 });
        expect(applyStrike(20, 'cat')).toEqual({ score: 0, applied: -20 });
    });

    it('never drops below 0: 5 points lose only 5', () => {
        expect(applyStrike(5, 'cat')).toEqual({ score: 0, applied: -5 });
    });

    it('stays at 0 with no change when a cat is hit at score 0', () => {
        expect(applyStrike(0, 'cat')).toEqual({ score: 0, applied: 0 });
    });
});

describe('changeLabel', () => {
    it('shows a plus sign for a gain', () => {
        expect(changeLabel(10)).toBe('+10');
    });

    it('shows the actual loss, which can be less than 20', () => {
        expect(changeLabel(-20)).toBe('-20');
        expect(changeLabel(-5)).toBe('-5');
    });

    it('shows a plain 0 when nothing changed', () => {
        expect(changeLabel(0)).toBe('0');
    });
});
