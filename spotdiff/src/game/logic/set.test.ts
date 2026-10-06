import { describe, expect, it } from 'vitest';
import { generateStage } from './generate';
import { mulberry32, seedFor } from './random';
import { firstSet, makeStageFor, setAfter } from './set';

describe('firstSet', () => {
    it('starts from set 1 of the date the Title fixed', () => {
        expect(firstSet(20261006)).toEqual({ date: 20261006, setNo: 1 });
    });
});

describe('setAfter', () => {
    it('moves on to the next set number after a clear, keeping the date', () => {
        expect(setAfter({ date: 20261006, setNo: 1, won: true })).toEqual({ date: 20261006, setNo: 2 });
        expect(setAfter({ date: 20270101, setNo: 9, won: true })).toEqual({ date: 20270101, setNo: 10 });
    });

    it('replays the same set number after a game over, keeping the date', () => {
        expect(setAfter({ date: 20261006, setNo: 1, won: false })).toEqual({ date: 20261006, setNo: 1 });
        expect(setAfter({ date: 20270101, setNo: 7, won: false })).toEqual({ date: 20270101, setNo: 7 });
    });

    it('goes 1 -> 2 -> 3 over consecutive clears and stays put on a failure in between', () => {
        let cur = firstSet(20261006);
        cur = setAfter({ ...cur, won: true });
        cur = setAfter({ ...cur, won: false });
        cur = setAfter({ ...cur, won: true });
        expect(cur).toEqual({ date: 20261006, setNo: 3 });
    });
});

describe('makeStageFor', () => {
    it('builds each stage from the seed of its (date, set, stage) triple', () => {
        const make = makeStageFor(20261006, 4);
        for (const stage of [1, 2, 3, 4, 5]) {
            expect(make(stage)).toEqual(generateStage(stage, mulberry32(seedFor(20261006, 4, stage))));
        }
    });

    it('gives the same pictures every time for the same date and set, whatever the call order', () => {
        const a = makeStageFor(20261006, 2);
        const b = makeStageFor(20261006, 2);
        const first = [1, 2, 3, 4, 5].map((s) => a(s));
        const reversed = [5, 4, 3, 2, 1].map((s) => b(s)).reverse();
        expect(reversed).toEqual(first);
    });

    it('gives other pictures for another set number or another date', () => {
        const base = makeStageFor(20261006, 1);
        for (const stage of [1, 2, 3, 4, 5]) {
            expect(makeStageFor(20261006, 2)(stage)).not.toEqual(base(stage));
            expect(makeStageFor(20261007, 1)(stage)).not.toEqual(base(stage));
        }
    });
});
