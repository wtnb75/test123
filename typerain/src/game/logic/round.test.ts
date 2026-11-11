import { describe, expect, it } from 'vitest';
import { Round, type Word } from './round';
import { SPAWN_GAP, WORD_H } from '../params';
import { fallSpeedAt } from './difficulty';
import { seededRng } from './testing';

const D = 136; // fall distance at the smallest logical height (240)

const word = (id: number, text: string, p = 0.5): Word => ({ id, text, x: 10, p, typed: 0 });

/** A round with the given words already on screen (lives and the rest at their starting values). */
function roundWith(...words: Word[]): Round {
    const r = new Round(() => 0);
    r.words.push(...words);
    return r;
}

/** Steps in small exact-binary slices; returns every word spawned. */
function run(r: Round, seconds: number, dt = 0.0625): Word[] {
    const spawned: Word[] = [];
    for (let t = 0; t < seconds; t += dt) {
        const s = r.step(dt, D);
        if (s.spawned) spawned.push(s.spawned);
    }
    return spawned;
}

describe('starting a round', () => {
    it('starts playing with 3 lives, no score, no combo and no words', () => {
        const r = new Round(() => 0);
        expect(r.phase).toBe('playing');
        expect(r.ended).toBe(false);
        expect([r.lives, r.score, r.combo, r.cleared, r.elapsed]).toEqual([3, 0, 0, 0, 0]);
        expect(r.words).toHaveLength(0);
        expect(r.targetId).toBeNull();
    });
});

describe('spawning', () => {
    it('brings the first word between 0.375 s and 0.4375 s (0.4 s) after the start', () => {
        const r = new Round(() => 0);
        for (let i = 0; i < 6; i++) expect(r.step(0.0625, D).spawned).toBeNull(); // up to 0.375 s
        expect(r.step(0.0625, D).spawned).not.toBeNull(); // 0.4375 s
        expect(r.words).toHaveLength(1);
    });

    it('spawns at the top of the field using the injected random numbers ("cat" at the left margin)', () => {
        const r = new Round(() => 0);
        let first: Word | null = null;
        for (let i = 0; i < 20 && !first; i++) first = r.step(0.0625, D).spawned;
        expect(first?.text).toBe('cat');
        expect(first?.x).toBe(8);
        expect(first?.typed).toBe(0);
        // It appeared at the top and has fallen only for the rest of that step: speed x dt.
        expect(first?.p).toBeCloseTo(fallSpeedAt(0.4375) * 0.0625, 10);
    });

    it('does not spawn while 6 words are on screen, and spawns as soon as there is room', () => {
        const six = ['cat', 'dog', 'sun', 'sky', 'red', 'box'].map((t, i) => word(i + 1, t, 0.4));
        const r = roundWith(...six);
        for (let i = 0; i < 40; i++) r.step(0.0625, D); // 2.5 s: the timer is far past the first spawn time
        expect(r.words).toHaveLength(6);
        r.words.pop();
        expect(r.step(0.0625, D).spawned).not.toBeNull();
    });

    it('waits until the previous word has dropped WORD_H + SPAWN_GAP = 30 px (0.25 at fall distance 120)', () => {
        const r = new Round(() => 0);
        run(r, 0.5); // the first word is out
        const first = r.words[0];
        for (let i = 0; i < 40; i++) {
            first.p = 0.24; // 28.8 px at D = 120: not yet
            expect(r.step(0.0625, 120).spawned).toBeNull();
        }
        first.p = 0.25; // exactly 30 px
        expect(r.step(0.0625, 120).spawned).not.toBeNull();
    });

    it('does not spawn at 29.9 px below the field top (just short of the 30 px gap) at fall distance 120', () => {
        const r = new Round(() => 0);
        run(r, 0.5);
        const first = r.words[0];
        for (let i = 0; i < 40; i++) {
            first.p = 29.9 / 120;
            expect(r.step(0.0625, 120).spawned).toBeNull();
        }
    });

    // The first word is held at p = 0.5 (68 px: far enough that the gap rule never blocks), so only the interval matters.
    function stepsToNextSpawn(r: Round, limit: number): number {
        const first = r.words[0];
        for (let k = 1; k <= limit; k++) {
            first.p = 0.5;
            if (r.step(0.0625, D).spawned) return k;
        }
        return -1;
    }

    it('spawns the second word at 38 steps (2.375 s) after the first at the start, not at 37 steps (2.3125 s)', () => {
        const r = new Round(() => 0);
        run(r, 0.4375); // 7 steps: the first word appears in the last one
        expect(r.words).toHaveLength(1);
        // Needs timer >= 2.4 - 0.02 x (0.4375 + timer): not at 37 steps (2.3125 s), yes at 38 (2.375 s).
        expect(stepsToNextSpawn(r, 100)).toBe(38);
    });

    it('spawns at 26 steps (1.625 s), not 25 (1.5625 s), around 40 s into the run (the interval shrinks with time)', () => {
        const r = new Round(() => 0);
        run(r, 0.4375);
        r.elapsed = 40;
        // timer >= 2.4 - 0.02 x (40 + timer): not at 25 steps (1.5625 s), yes at 26 (1.625 s).
        expect(stepsToNextSpawn(r, 100)).toBe(26);
    });

    it('restarts the interval after each spawn (a third word is not due right after the second)', () => {
        const r = new Round(() => 0);
        run(r, 0.4375);
        stepsToNextSpawn(r, 100); // the second word
        const second = r.words[1];
        let steps = 0;
        for (let k = 1; k <= 20; k++) {
            r.words[0].p = 0.5;
            second.p = 0.5;
            if (r.step(0.0625, D).spawned) steps = k;
        }
        expect(steps).toBe(0);
    });

    it('spawns again at once when the previous word is gone (landed or typed)', () => {
        const r = new Round(() => 0);
        run(r, 0.5);
        r.words.length = 0;
        let spawned = null;
        for (let i = 0; i < 80 && !spawned; i++) spawned = r.step(0.0625, D).spawned;
        expect(spawned).not.toBeNull();
    });
});

describe('falling', () => {
    it('moves every word down by speed x dt, with the speed of the elapsed time', () => {
        const r = roundWith(word(1, 'cat', 0.2));
        r.step(0.0625, D);
        const speed = fallSpeedAt(0.0625);
        expect(r.words[0].p).toBeCloseTo(0.2 + speed * 0.0625, 10);
    });

    it('caps one step at 0.1 s however long the frame was', () => {
        const r = roundWith(word(1, 'cat', 0.2));
        r.step(5, D);
        expect(r.elapsed).toBeCloseTo(0.1, 10);
        expect(r.words[0].p).toBeCloseTo(0.2 + fallSpeedAt(0.1) * 0.1, 10);
    });
});

describe('the same pace on every screen height', () => {
    // A word that appeared at the start reaches the floor after the time found by hand from
    // speed(t) = 0.084 + 0.0014 t:  0.084 t + 0.0007 t^2 = 1  ->  t = 10.91 s. It does not depend on the fall distance.
    function secondsToLand(fallDistance: number): number {
        const r = roundWith(word(1, 'cat', 0));
        for (let i = 1; i <= 400; i++) {
            if (r.step(0.0625, fallDistance).floorHits > 0) return i * 0.0625;
        }
        return -1;
    }

    it('lands a word after about 10.9 s whether the fall distance is 136 or 675', () => {
        const small = secondsToLand(136);
        const tall = secondsToLand(675);
        expect(small).toBeGreaterThan(10.8);
        expect(small).toBeLessThan(11.0);
        expect(tall).toBe(small);
    });

    it('moves a word by the same share of the way whatever the fall distance given to the step', () => {
        const a = roundWith(word(1, 'cat', 0.3));
        const b = roundWith(word(1, 'cat', 0.3));
        a.step(0.0625, 200);
        b.step(0.0625, 100);
        expect(a.words[0].p).toBe(b.words[0].p);
        expect(a.words[0].p).toBeCloseTo(0.3 + fallSpeedAt(0.0625) * 0.0625, 10);
    });
});

describe('words reaching the floor', () => {
    it('costs a life, resets the combo and removes the word once its bottom meets the floor (p >= 1)', () => {
        const r = roundWith(word(1, 'cat', 0.99), word(2, 'dog', 0.995));
        r.combo = 4;
        const s = r.step(0.1, D); // moves p by about 0.0084
        expect(s.floorHits).toBe(1);
        expect(s.landed.map((w) => w.text)).toEqual(['dog']);
        // The other word (not yet at the floor) is cleared by the board wipe, not left on screen.
        expect(s.wiped.map((w) => w.text)).toEqual(['cat']);
        expect(r.words).toHaveLength(0);
        expect(r.lives).toBe(2);
        expect(r.combo).toBe(0);
    });

    it('counts a word whose bottom lands exactly on the floor (p becomes exactly 1)', () => {
        const dt = 0.0625;
        const move = fallSpeedAt(dt) * dt;
        // Find a start position from which one step ends at exactly 1 (floating point: try a few neighbours).
        let p0: number | null = null;
        for (let k = -8; k <= 8 && p0 === null; k++) {
            const candidate = 1 - move + k * Number.EPSILON;
            if (candidate + move === 1) p0 = candidate;
        }
        expect(p0).not.toBeNull();
        const r = roundWith(word(1, 'cat', p0 ?? 0));
        const s = r.step(dt, D);
        expect(s.floorHits).toBe(1);
        expect(r.lives).toBe(2);
    });

    it('does not count a word whose bottom is still one pixel above the floor', () => {
        const dt = 0.0625;
        const move = fallSpeedAt(dt) * dt;
        const r = roundWith(word(1, 'cat', 1 - 1 / D - move)); // ends the step at p = 1 - 1/136
        const s = r.step(dt, D);
        expect(r.words[0].p).toBeLessThan(1);
        expect(s.floorHits).toBe(0);
        expect(r.lives).toBe(3);
    });

    it('lets a word that has not reached the floor stay and keep falling', () => {
        const r = roundWith(word(1, 'cat', 0.9));
        expect(r.step(0.1, D).floorHits).toBe(0);
        expect(r.lives).toBe(3);
        expect(r.words).toHaveLength(1);
    });

    it('drops the lock-on when the locked word lands', () => {
        const r = roundWith(word(1, 'cat', 0.995));
        r.typeChar('c');
        expect(r.targetId).toBe(1);
        r.step(0.1, D);
        expect(r.targetId).toBeNull();
        expect(r.words).toHaveLength(0);
    });

    it('reports the counted words that landed, lowest first, and none when nothing landed', () => {
        const none = roundWith(word(1, 'cat', 0.5));
        expect(none.step(0.0625, D).landed).toEqual([]);
        const r = roundWith(word(1, 'cat', 1.1), word(2, 'dog', 1.3), word(3, 'sun', 0.4));
        const s = r.step(0.0625, D);
        expect(s.landed.map((w) => w.text)).toEqual(['dog', 'cat']);
        expect(s.floorHits).toBe(2);
        expect(s.wiped.map((w) => w.text)).toEqual(['sun']); // the word still falling is wiped, not landed
        expect(r.words).toHaveLength(0);
    });

    it('does not list a word that landed after the last life was lost (it is ignored)', () => {
        const r = roundWith(word(1, 'cat', 1.5), word(2, 'dog', 1.2));
        r.lives = 1;
        const s = r.step(0.0625, D);
        expect(s.landed.map((w) => w.text)).toEqual(['cat']);
    });

    it('counts two words landing in the same frame as two lost lives', () => {
        const r = roundWith(word(1, 'cat', 1.2), word(2, 'dog', 1.1));
        const s = r.step(0.0625, D);
        expect(s.floorHits).toBe(2);
        expect(r.lives).toBe(1);
        expect(r.phase).toBe('playing');
    });

    it('ends the round when the last life goes and ignores the other words landing in that frame', () => {
        const r = roundWith(word(1, 'cat', 1.5), word(2, 'dog', 1.2));
        r.lives = 1;
        const s = r.step(0.0625, D);
        expect(r.lives).toBe(0); // never below 0
        expect(r.ended).toBe(true);
        expect(r.phase).toBe('ending');
        expect(s.floorHits).toBe(1);
        expect(r.words.map((w) => w.text)).toEqual(['dog']); // the lower word was removed first; the other stays
    });
});

describe('after the round has ended', () => {
    it('does not move, spawn or count anything, and ignores typing', () => {
        const r = roundWith(word(1, 'cat', 1.5));
        r.lives = 1;
        r.step(0.0625, D);
        const elapsed = r.elapsed;
        const s = r.step(0.0625, D);
        expect(s).toEqual({ spawned: null, floorHits: 0, landed: [], wiped: [] });
        expect(r.elapsed).toBe(elapsed);
        expect(r.typeChar('c')).toEqual({ kind: 'ignored' });
    });
});

describe('board wipe (a landing with lives left clears the board)', () => {
    it('clears every other word, drops the lock-on and keeps score and cleared count', () => {
        const r = roundWith(word(1, 'cat', 1.2), word(2, 'dog', 0.5), word(3, 'sun', 0.3));
        r.typeChar('d'); // lock on to dog, which is not the word that lands
        r.score = 120;
        r.cleared = 7;
        const s = r.step(0.0625, D);
        expect(s.landed.map((w) => w.text)).toEqual(['cat']);
        expect(s.wiped.map((w) => w.text).sort()).toEqual(['dog', 'sun']);
        expect(r.words).toHaveLength(0);
        expect(r.targetId).toBeNull();
        expect(r.lives).toBe(2);
        expect([r.score, r.cleared]).toEqual([120, 7]);
        expect(r.phase).toBe('playing');
    });

    it('does not wipe when no word reached the floor (and wiped is empty)', () => {
        const r = roundWith(word(1, 'cat', 0.5), word(2, 'dog', 0.3));
        const s = r.step(0.0625, D);
        expect(s.wiped).toEqual([]);
        expect(r.words).toHaveLength(2);
    });

    it('does not wipe on the landing that costs the last life: the board stays and nothing is wiped', () => {
        const r = roundWith(word(1, 'cat', 1.2), word(2, 'dog', 0.5));
        r.lives = 1;
        const s = r.step(0.0625, D);
        expect(r.ended).toBe(true);
        expect(s.wiped).toEqual([]);
        expect(r.words.map((w) => w.text)).toEqual(['dog']);
    });

    it('wipes once when two words land together with lives left (3 -> 1), losing two lives', () => {
        const r = roundWith(word(1, 'cat', 1.2), word(2, 'dog', 1.1), word(3, 'sun', 0.4));
        const s = r.step(0.0625, D);
        expect(s.floorHits).toBe(2);
        expect(r.lives).toBe(1);
        expect(s.wiped.map((w) => w.text)).toEqual(['sun']);
        expect(r.phase).toBe('playing');
    });

    it('does not wipe when two words land together and the lives run out (2 -> 0)', () => {
        const r = roundWith(word(1, 'cat', 1.2), word(2, 'dog', 1.1), word(3, 'sun', 0.4));
        r.lives = 2;
        const s = r.step(0.0625, D);
        expect(r.ended).toBe(true);
        expect(s.wiped).toEqual([]);
        expect(r.words.map((w) => w.text)).toEqual(['sun']);
    });

    it('also wipes the word that spawned in the same step as the landing, and still reports it as spawned', () => {
        const r = new Round(() => 0);
        for (let i = 0; i < 6; i++) r.step(0.0625, D); // 0.375 s: the first word is due on the next step
        r.words.push(word(99, 'zzz', 1.5));
        const s = r.step(0.0625, D);
        expect(s.spawned?.text).toBe('cat');
        expect(s.landed.map((w) => w.text)).toEqual(['zzz']);
        expect(s.wiped).toEqual([s.spawned]); // the same word object, wiped on the step it appeared
        expect(r.words).toHaveLength(0);
    });

    it('spawns nothing for WIPE_PAUSE_SEC (1.2 s) even though the spawn interval has long passed', () => {
        const r = roundWith(word(1, 'cat', 1.2));
        r.step(0.0625, D); // the wipe step (counts as 0 s)
        for (let i = 0; i < 19; i++) expect(r.step(0.0625, D).spawned).toBeNull(); // up to 1.1875 s
        expect(r.step(0.0625, D).spawned).not.toBeNull(); // 1.25 s: the pause is over
    });

    it('keeps the pause at 1.2 s with dt = 0.1: nothing after 11 steps (1.1 s), a word within the next 2 (float slack)', () => {
        const r = roundWith(word(1, 'cat', 1.2));
        r.step(0.1, D); // the wipe step
        for (let i = 0; i < 11; i++) expect(r.step(0.1, D).spawned).toBeNull();
        const next = [r.step(0.1, D).spawned, r.step(0.1, D).spawned];
        expect(next.some((w) => w !== null)).toBe(true);
    });

    it('counts the pause with dt capped at DT_MAX_SEC: one 5 s frame only takes 0.1 s off it', () => {
        const r = roundWith(word(1, 'cat', 1.2));
        r.step(0.1, D); // the wipe step
        expect(r.step(5, D).spawned).toBeNull(); // 1.1 s left, not 0
        for (let i = 0; i < 9; i++) expect(r.step(0.1, D).spawned).toBeNull(); // about 0.2 s left
        const next = [r.step(0.1, D).spawned, r.step(0.1, D).spawned, r.step(0.1, D).spawned];
        expect(next.some((w) => w !== null)).toBe(true);
    });

    it('ends the pause on time even when the spawn timer was nearly empty at the wipe (interval 2.1 s at t = 15)', () => {
        const r = new Round(() => 0);
        for (let i = 0; i < 7 && r.words.length === 0; i++) r.step(0.0625, D); // the first word spawns
        expect(r.words).toHaveLength(1);
        r.elapsed = 15; // the spawn interval is 2.1 s, far above the 1.2 s pause
        r.words.push(word(99, 'zzz', 1.5));
        r.step(0.0625, D); // the wipe step: the spawn timer is only about 0.06 s
        expect(r.words).toHaveLength(0);
        for (let i = 0; i < 19; i++) expect(r.step(0.0625, D).spawned).toBeNull(); // up to 1.1875 s
        expect(r.step(0.0625, D).spawned).not.toBeNull(); // 1.25 s, not 2.1 s
    });

    it('does not wipe on a miss or a clear: the other words stay', () => {
        const r = roundWith(word(1, 'cat', 0.5), word(2, 'dog', 0.4));
        expect(r.typeChar('x')).toEqual({ kind: 'miss' });
        expect(r.words).toHaveLength(2);
        'cat'.split('').forEach((c) => r.typeChar(c));
        expect(r.words.map((w) => w.text)).toEqual(['dog']);
    });

    it('leaves the elapsed time (difficulty) as it was when it wipes', () => {
        const r = roundWith(word(7, 'sun', 1.2));
        const before = r.elapsed;
        r.step(0.0625, D);
        expect(r.elapsed).toBe(before + 0.0625);
        expect(r.words).toHaveLength(0);
    });

    it('does not let the shrinking spawn interval shorten the pause (the pause is its own countdown)', () => {
        const r = roundWith(word(1, 'cat', 1.2));
        r.elapsed = 200; // the spawn interval is at its 0.8 s floor
        r.step(0.0625, D);
        for (let i = 0; i < 12; i++) expect(r.step(0.0625, D).spawned).toBeNull(); // 0.75 s: under the 0.8 s interval
        for (let i = 0; i < 7; i++) expect(r.step(0.0625, D).spawned).toBeNull(); // 1.1875 s
        expect(r.step(0.0625, D).spawned).not.toBeNull();
    });

    it('goes back to the normal spawn interval after the first word following the pause', () => {
        const r = roundWith(word(1, 'cat', 1.2));
        r.elapsed = 200; // interval 0.8 s
        r.step(0.0625, D);
        let first = false;
        for (let i = 0; i < 100 && !first; i++) first = r.step(0.0625, D).spawned !== null;
        expect(first).toBe(true);
        r.words[0].p = 0.5; // lower than the spawn gap so the next word is limited by the interval only
        let steps = 0;
        let next = false;
        while (!next && steps < 100) {
            next = r.step(0.0625, D).spawned !== null;
            steps += 1;
        }
        expect(steps).toBeGreaterThanOrEqual(12); // 0.75 s still under 0.8 s
        expect(steps).toBeLessThanOrEqual(13); // 0.8125 s
    });

    it('treats typing on the emptied board as a miss, and wiping gives no score or combo', () => {
        const r = roundWith(word(1, 'cat', 1.2), word(2, 'dog', 0.4));
        r.combo = 3;
        r.step(0.0625, D);
        expect(r.combo).toBe(0);
        expect(r.typeChar('d')).toEqual({ kind: 'miss' });
        expect(r.score).toBe(0);
    });

    it('wipes again on a later landing, even within the pause (every life lost with lives left wipes)', () => {
        const r = roundWith(word(1, 'cat', 1.2));
        r.step(0.0625, D);
        r.words.push(word(5, 'dog', 1.2), word(6, 'sun', 0.2));
        const s = r.step(0.0625, D);
        expect(s.wiped.map((w) => w.text)).toEqual(['sun']);
        expect(r.lives).toBe(1);
    });
});

describe('typing', () => {
    it('locks on to the lowest word that starts with the letter (larger p)', () => {
        const r = roundWith(word(1, 'cat', 0.2), word(2, 'cup', 0.6));
        expect(r.typeChar('c')).toEqual({ kind: 'hit' });
        expect(r.targetId).toBe(2);
        expect(r.words[1].typed).toBe(1);
        expect(r.words[0].typed).toBe(0);
    });

    it('locks on to the earlier word when two start with the letter at the same height', () => {
        const r = roundWith(word(1, 'cat', 0.5), word(2, 'cup', 0.5));
        r.typeChar('c');
        expect(r.targetId).toBe(1);
    });

    it('is a miss when no word starts with the letter: combo resets, nothing is locked', () => {
        const r = roundWith(word(1, 'cat'));
        r.combo = 5;
        expect(r.typeChar('x')).toEqual({ kind: 'miss' });
        expect(r.combo).toBe(0);
        expect(r.targetId).toBeNull();
        expect(r.lives).toBe(3);
        expect(r.score).toBe(0);
    });

    it('advances the locked word on the next letter and treats a wrong letter as a miss without moving it', () => {
        const r = roundWith(word(1, 'cup'));
        r.typeChar('c');
        r.combo = 3;
        expect(r.typeChar('x')).toEqual({ kind: 'miss' });
        expect(r.combo).toBe(0);
        expect(r.words[0].typed).toBe(1);
        expect(r.typeChar('u')).toEqual({ kind: 'hit' });
        expect(r.words[0].typed).toBe(2);
    });

    it('keeps the lock when the first letter of another word is typed (that is a miss)', () => {
        const r = roundWith(word(1, 'cup', 0.2), word(2, 'dog', 0.6));
        r.typeChar('c');
        expect(r.typeChar('d')).toEqual({ kind: 'miss' });
        expect(r.targetId).toBe(1);
        expect(r.words[1].typed).toBe(0);
    });

    it('clears the word on its last letter: score, combo, count, removal and unlock', () => {
        const r = roundWith(word(1, 'cat'), word(2, 'dog'));
        r.typeChar('c');
        r.typeChar('a');
        const out = r.typeChar('t');
        expect(out).toMatchObject({ kind: 'clear', points: 30 });
        expect(r.score).toBe(30);
        expect(r.combo).toBe(1);
        expect(r.cleared).toBe(1);
        expect(r.targetId).toBeNull();
        expect(r.words.map((w) => w.text)).toEqual(['dog']);
    });

    it('scores the next clear with the combo before it (3 letters at combo 1 -> 33)', () => {
        const r = roundWith(word(1, 'cat'), word(2, 'dog'));
        'cat'.split('').forEach((c) => r.typeChar(c));
        const out = 'dog'.split('').map((c) => r.typeChar(c));
        expect(out[2]).toMatchObject({ kind: 'clear', points: 33 });
        expect(r.score).toBe(63);
        expect(r.combo).toBe(2);
    });

    it('lets a miss cut the combo between two clears', () => {
        const r = roundWith(word(1, 'cat'), word(2, 'dog'));
        'cat'.split('').forEach((c) => r.typeChar(c));
        r.typeChar('x');
        const out = 'dog'.split('').map((c) => r.typeChar(c));
        expect(out[2]).toMatchObject({ kind: 'clear', points: 30 });
    });
});

describe('a whole seeded run', () => {
    // Invariants over a long random run, with a bot that types the lowest word perfectly or never types.
    function play(seed: number, typist: boolean) {
        const r = new Round(seededRng(seed));
        let spawns = 0;
        let initialClashes = 0;
        let minGap = Infinity;
        let maxOnScreen = 0;
        let duplicateTexts = 0;
        for (let i = 0; i < 60 * 150 && !r.ended; i++) {
            const s = r.step(1 / 60, D);
            if (s.spawned) {
                spawns += 1;
                const others = r.words.filter((w) => w.id !== s.spawned?.id);
                if (others.some((w) => w.text[0] === s.spawned?.text[0])) initialClashes += 1;
            }
            const ps = r.words.map((w) => w.p).sort((a, b) => a - b);
            for (let k = 1; k < ps.length; k++) minGap = Math.min(minGap, (ps[k] - ps[k - 1]) * D);
            maxOnScreen = Math.max(maxOnScreen, r.words.length);
            if (new Set(r.words.map((w) => w.text)).size !== r.words.length) duplicateTexts += 1;
            if (typist && i % 6 === 0 && r.words.length > 0) {
                const lowest = r.words.reduce((a, b) => (b.p > a.p ? b : a));
                for (const c of lowest.text.slice(lowest.typed)) r.typeChar(c);
            }
        }
        return { r, spawns, initialClashes, minGap, maxOnScreen, duplicateTexts };
    }

    it('keeps words apart, distinct and under the cap; an idle player loses all lives', () => {
        for (const seed of [1, 2, 3]) {
            const { r, spawns, initialClashes, minGap, maxOnScreen, duplicateTexts } = play(seed, false);
            expect(spawns).toBeGreaterThan(2); // not a vacuous run
            expect(r.ended).toBe(true);
            expect(r.lives).toBe(0);
            expect(initialClashes).toBe(0);
            expect(duplicateTexts).toBe(0);
            expect(maxOnScreen).toBeLessThanOrEqual(6);
            // A word only appears once the previous one is WORD_H + SPAWN_GAP below the top, and all fall together.
            expect(minGap).toBeGreaterThanOrEqual(WORD_H + SPAWN_GAP - 1e-6);
        }
    });

    it('lets a flawless typist survive the whole run while scoring', () => {
        const { r, spawns } = play(4, true);
        expect(spawns).toBeGreaterThan(20);
        expect(r.cleared).toBeGreaterThan(20);
        expect(r.score).toBeGreaterThan(0);
        expect(r.lives).toBe(3);
    });
});
