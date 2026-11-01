import { describe, expect, it } from 'vitest';
import { pickLetter } from './letters';
import { Round } from './round';
import { bonusFor, scoreFor } from './scoring';
import { seeded, seq } from './testing';

const zero = seq(0); // targets CAT, DOG, SUN; replacements are the first words not on screen

const pickAll = (round: Round, letters: string) => [...letters].map((c) => round.pick(c));

describe('Round start', () => {
    it('begins with 3 targets, an empty tray, 60 seconds and no score', () => {
        const r = new Round(zero);
        expect(r.targets.map((t) => t.en)).toEqual(['CAT', 'DOG', 'SUN']);
        expect(r.appeared.map((t) => t.en)).toEqual(['CAT', 'DOG', 'SUN']);
        expect(r.tray).toEqual([]);
        expect(r.timeLeft).toBe(60);
        expect(r.timeShown).toBe(60);
        expect(r.score).toBe(0);
        expect(r.phase).toBe('playing');
        expect(r.isOver).toBe(false);
    });
});

describe('Round.pick', () => {
    it('puts a letter in the tray without completing anything', () => {
        const r = new Round(zero);
        expect(r.pick('C')).toEqual({ kind: 'picked', completed: [], rows: [] });
        expect(r.tray).toEqual(['C']);
    });

    it('completes CAT when its third letter arrives: +30 score, +3 seconds, a new target in the row', () => {
        const r = new Round(zero);
        pickAll(r, 'CA');
        const res = r.pick('T');
        expect(res.kind).toBe('picked');
        if (res.kind === 'picked') expect(res.completed.map((x) => x.en)).toEqual(['CAT']);
        expect(r.score).toBe(30);
        expect(r.timeLeft).toBe(63);
        expect(r.completedCount).toBe(1);
        expect(r.completedWords).toEqual(['CAT']);
        expect(r.tray).toEqual([]);
        expect(r.targets.map((t) => t.en)).toEqual(['SKY', 'DOG', 'SUN']);
        expect(r.appeared.map((t) => t.en)).toEqual(['CAT', 'DOG', 'SUN', 'SKY']);
    });

    it('hands on the row each completed word was in: SUN (third row) gives [2]; a chain in one row gives [0, 0]', () => {
        const a = new Round(zero);
        pickAll(a, 'NU');
        const sun = a.pick('S');
        expect(sun.kind === 'picked' && sun.rows).toEqual([2]);
        expect(sun.kind === 'picked' && sun.completed.map((x) => x.en)).toEqual(['SUN']);
        const b = new Round(zero);
        pickAll(b, 'SKYTA');
        const chain = b.pick('C'); // CAT (row 0) completes, its row becomes SKY, which the leftover S K Y spell
        expect(chain.kind === 'picked' && chain.rows).toEqual([0, 0]);
        expect(chain.kind === 'picked' && chain.completed.map((x) => x.en)).toEqual(['CAT', 'SKY']);
    });

    it('adds up several completions from one pick, and records the word drawn in between', () => {
        const r = new Round(zero);
        pickAll(r, 'SKYTA'); // S K Y T A: nothing completes yet
        expect(r.completedCount).toBe(0);
        r.pick('C'); // CAT completes, its row becomes SKY, which the leftover S K Y spell at once
        expect(r.completedWords).toEqual(['CAT', 'SKY']);
        expect(r.score).toBe(scoreFor(3) + scoreFor(3));
        expect(r.timeLeft).toBe(60 + bonusFor(3) + bonusFor(3));
        expect(r.completedCount).toBe(2);
        expect(r.appeared.map((t) => t.en)).toEqual(['CAT', 'DOG', 'SUN', 'SKY', 'CAT']);
    });

    it('scores longer words more: a completed 8-letter word gives 230 and 8 seconds', () => {
        const r = new Round(seq(0.999999, 0)); // first draws are the last words: TREASURE, ...
        const target = r.targets[0];
        expect(target.en).toBe('TREASURE');
        pickAll(r, target.en);
        expect(r.score).toBe(230);
        expect(r.timeLeft).toBe(68);
    });

    it('refuses a letter when the tray is full and changes nothing', () => {
        const r = new Round(zero);
        r.tray = [...'ZZZZZZZZZZ'];
        expect(r.pick('C')).toEqual({ kind: 'full' });
        expect(r.tray).toHaveLength(10);
        expect(r.score).toBe(0);
    });

    it('accepts the 10th letter (the tray holds 9)', () => {
        const r = new Round(zero);
        r.tray = [...'ZZZZZZZZZ'];
        expect(r.pick('Z').kind).toBe('picked');
        expect(r.tray).toHaveLength(10);
    });

    it('can complete a word at the 10th letter even though the tray is then full', () => {
        const r = new Round(zero);
        r.tray = [...'CAZZZZZZZ']; // 9 letters
        const res = r.pick('T');
        expect(res.kind).toBe('picked');
        expect(r.completedWords).toEqual(['CAT']);
        expect(r.tray).toEqual([...'ZZZZZZZ']);
    });

    it('is ignored once the play has ended', () => {
        const r = new Round(zero);
        r.tick(60);
        expect(r.pick('C')).toEqual({ kind: 'ignored' });
        expect(r.tray).toEqual([]);
    });
});

describe('Round discards', () => {
    it('removes the tray letter at an index and the later ones move forward', () => {
        const r = new Round(zero);
        pickAll(r, 'XYZ');
        expect(r.discardAt(1)).toBe(true);
        expect(r.tray).toEqual(['X', 'Z']);
    });

    it('discards the last picked letter with discardLast, and does nothing for an empty tray', () => {
        const r = new Round(zero);
        expect(r.discardLast()).toBe(false);
        pickAll(r, 'XY');
        expect(r.discardLast()).toBe(true);
        expect(r.tray).toEqual(['X']);
    });

    it('does nothing for an index with no letter, and costs no score or time', () => {
        const r = new Round(zero);
        r.pick('X');
        expect(r.discardAt(1)).toBe(false);
        expect(r.discardAt(-1)).toBe(false);
        r.discardAt(0);
        expect(r.score).toBe(0);
        expect(r.timeLeft).toBe(60);
    });

    it('does nothing after the play has ended', () => {
        const r = new Round(zero);
        r.pick('X');
        r.tick(60);
        expect(r.discardAt(0)).toBe(false);
        expect(r.tray).toEqual(['X']);
    });
});

describe('Round.tick (docs/spec.md "同じフレームの順序")', () => {
    it('counts the clock down and shows the seconds rounded up', () => {
        const r = new Round(zero);
        r.tick(0.4);
        expect(r.timeLeft).toBeCloseTo(59.6, 10);
        expect(r.timeShown).toBe(60);
        r.tick(59);
        expect(r.timeLeft).toBeCloseTo(0.6, 10);
        expect(r.timeShown).toBe(1);
        expect(r.phase).toBe('playing');
    });

    it('rounds the shown seconds up, not to the nearest: 59.4 s left shows 60, 0.4 s left shows 1', () => {
        const a = new Round(zero);
        a.tick(0.6);
        expect(a.timeLeft).toBeCloseTo(59.4, 10);
        expect(a.timeShown).toBe(60);
        const b = new Round(zero);
        b.tick(59.6);
        expect(b.timeLeft).toBeCloseTo(0.4, 10);
        expect(b.timeShown).toBe(1);
    });

    it('ends the play when the time reaches exactly 0, and shows 0', () => {
        const r = new Round(zero);
        r.tick(60);
        expect(r.phase).toBe('ending');
        expect(r.isOver).toBe(true);
        expect(r.timeLeft).toBe(0);
        expect(r.timeShown).toBe(0);
    });

    it('ends the play when a frame overshoots 0, with the time clamped to 0', () => {
        const r = new Round(zero);
        r.tick(75);
        expect(r.timeLeft).toBe(0);
        expect(r.phase).toBe('ending');
    });

    it('does nothing more after the end', () => {
        const r = new Round(zero);
        r.tick(60);
        r.tick(5);
        expect(r.elapsed).toBe(60);
        expect(r.timeLeft).toBe(0);
    });

    it('lets a completion in the last frame extend the play: the pick is applied before the clock', () => {
        const r = new Round(zero);
        r.tick(59.9); // 0.1 s left
        pickAll(r, 'CAT'); // +3 s, applied before this frame's tick
        r.tick(0.2);
        expect(r.phase).toBe('playing');
        expect(r.timeLeft).toBeCloseTo(2.9, 10);
    });

    it('speeds up the fall as play time passes (0.25, then 0.4 after 60 s)', () => {
        const r = new Round(zero);
        expect(r.fallSpeed).toBeCloseTo(0.25, 10);
        r.tick(30);
        r.tick(30); // timeLeft would be 0 at 60 s: the play ends, elapsed still counts
        expect(r.elapsed).toBe(60);
        expect(r.fallSpeed).toBeCloseTo(0.4, 10);
    });
});

describe('simulated plays keep the rules intact (seeded)', () => {
    it('never breaks the tray limit, the 3 distinct targets, or the score and clock books', () => {
        let plays = 0;
        let completions = 0;
        let fulls = 0;
        let discards = 0;
        for (let seed = 1; seed <= 60; seed++) {
            const rng = seeded(seed);
            const r = new Round(rng);
            let bonus = 0;
            let time = 0;
            for (let step = 0; step < 250 && !r.isOver; step++) {
                const roll = rng();
                if (roll < 0.15 && r.tray.length > 0) {
                    r.discardAt(Math.floor(rng() * r.tray.length));
                    discards++;
                } else {
                    const res = r.pick(pickLetter(rng, r.tray, r.targets));
                    if (res.kind === 'full') fulls++;
                    if (res.kind === 'picked') {
                        completions += res.completed.length;
                        for (const c of res.completed) bonus += bonusFor(c.en.length);
                    }
                }
                const dt = 0.1;
                time += dt;
                r.tick(dt);
                if (r.tray.length > 10) expect.fail(`tray over capacity (seed ${seed})`);
                if (new Set(r.targets.map((t) => t.en)).size !== 3) expect.fail(`duplicate targets (seed ${seed})`);
            }
            const expectedScore = r.completedWords.reduce((s, en) => s + scoreFor(en.length), 0);
            if (r.score !== expectedScore) expect.fail(`score books (seed ${seed})`);
            if (!r.isOver && Math.abs(r.timeLeft - (60 + bonus - time)) > 1e-6) expect.fail(`clock books (seed ${seed})`);
            if (r.completedCount !== r.completedWords.length) expect.fail(`count books (seed ${seed})`);
            plays++;
        }
        expect(plays).toBe(60);
        // the loop really exercised completions, full trays and discards
        expect(completions).toBeGreaterThan(0);
        expect(fulls).toBeGreaterThan(0);
        expect(discards).toBeGreaterThan(0);
    });
});
