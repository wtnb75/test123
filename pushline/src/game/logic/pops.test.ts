import { describe, expect, it } from 'vitest';
import { stalePopKeys } from './pops';
import { board, EMPTY_ROWS } from './testkit';
import { FIXED, MOVABLE, type Cell } from './types';

const pops = (kinds: Record<string, Cell>) =>
    new Map(Object.entries(kinds).map(([k, kind]) => [k, { kind }] as const));

describe('stalePopKeys', () => {
    it('reports nothing while every popping cell still holds the block that appeared', () => {
        const s = board(['o....', '.x...', '.....', '.....', '.....', '..@..']);
        expect(stalePopKeys(pops({ '0,0': MOVABLE, '1,1': FIXED }), s.grid)).toEqual([]);
    });

    it('reports a popping cell whose block was pushed away', () => {
        const s = board(EMPTY_ROWS); // (2, 3) is empty now
        expect(stalePopKeys(pops({ '2,3': MOVABLE }), s.grid)).toEqual(['2,3']);
    });

    it('reports a popping cell that now holds a different kind', () => {
        const s = board(['x....', '.....', '.....', '.....', '.....', '..@..']);
        expect(stalePopKeys(pops({ '0,0': MOVABLE }), s.grid)).toEqual(['0,0']);
    });

    it('reports only the stale ones among several', () => {
        const s = board(['o....', '.....', '..o..', '.....', '.....', '..@..']);
        const stale = stalePopKeys(pops({ '0,0': MOVABLE, '1,1': MOVABLE, '2,2': MOVABLE }), s.grid);
        expect(stale).toEqual(['1,1']);
    });

    it('is empty for no pops', () => {
        expect(stalePopKeys(new Map(), board(EMPTY_ROWS).grid)).toEqual([]);
    });
});
