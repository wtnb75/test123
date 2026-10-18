import { describe, expect, it } from 'vitest';
import {
    browserBackend, createDailyRound, createDailyStorage, DAILY_STORAGE_KEY, dailyAnswer, dailyDateKey, dailySeed,
    digitLabel, dropsDailyResultRepeat, fnv1a32, getDailyStorage, loadDailyResults, loadDailyRound, parseDailySave, replayGuesses,
    type DailyBackend
} from './daily';
import { getSharedPrimeMap } from './primes';

const PRIMES = getSharedPrimeMap();
const DAY = '2026-10-18';

/** A backend that keeps the value in a plain variable; `failGet` / `failSet` make that call throw. */
const fakeBackend = (initial: string | null = null, failGet = false, failSet = false) => {
    const state = { value: initial, writes: 0 };
    const backend: DailyBackend = {
        getItem: (key) => {
            if (failGet) {
                throw new Error('blocked');
            }
            return key === DAILY_STORAGE_KEY ? state.value : null;
        },
        setItem: (key, value) => {
            if (failSet) {
                throw new Error('quota');
            }
            if (key === DAILY_STORAGE_KEY) {
                state.value = value;
                state.writes += 1;
            }
        }
    };

    return { state, backend };
};

describe('dailyDateKey', () => {
    it('uses the local date: 23:59:59 is still the same day, 00:00:00 is the next', () => {
        expect(dailyDateKey(new Date(2026, 9, 18, 23, 59, 59))).toBe('2026-10-18');
        expect(dailyDateKey(new Date(2026, 9, 19, 0, 0, 0))).toBe('2026-10-19');
    });

    it('zero-pads the month and the day', () => {
        expect(dailyDateKey(new Date(2026, 0, 1, 12))).toBe('2026-01-01');
        expect(dailyDateKey(new Date(2026, 11, 31, 12))).toBe('2026-12-31');
    });
});

describe('fnv1a32', () => {
    it('matches the published FNV-1a 32-bit test vectors', () => {
        expect(fnv1a32('')).toBe(0x811c9dc5);
        expect(fnv1a32('a')).toBe(0xe40c292c);
        expect(fnv1a32('foobar')).toBe(0xbf9cf968);
    });
});

describe('dailySeed and dailyAnswer (values computed outside the implementation)', () => {
    // date, digits, seed, list length, index, answer: from an independent Python FNV-1a + mulberry32.
    const TABLE: [string, number, number, number, number, string][] = [
        ['2026-10-18', 2, 891030754, 21, 3, '19'],
        ['2026-10-18', 3, 907808373, 143, 12, '163'],
        ['2026-10-18', 4, 790365040, 1061, 583, '5711'],
        ['2026-10-18', 5, 807142659, 8363, 4842, '60139'],
        ['2026-10-18', 6, 823920278, 68906, 51294, '758819'],
        ['2026-10-19', 2, 752045921, 21, 6, '31'],
        ['2026-10-19', 3, 735268302, 143, 118, '827'],
        ['2026-10-19', 4, 785601159, 1061, 252, '2909'],
        ['2026-10-19', 5, 768823540, 8363, 4126, '52433'],
        ['2026-10-19', 6, 819156397, 68906, 68422, '993287'],
        ['2026-01-01', 2, 1425266298, 21, 9, '43'],
        ['2026-01-01', 3, 1442043917, 143, 126, '881'],
        ['2026-01-01', 4, 1324600584, 1061, 601, '5857'],
        ['2026-01-01', 5, 1341378203, 8363, 912, '18773'],
        ['2026-01-01', 6, 1358155822, 68906, 30294, '478453']
    ];

    it.each(TABLE)('%s with %i digits: seed %i, prime list of %i, index %i -> %s', (date, digits, seed, length, index, answer) => {
        expect(dailySeed(date, digits)).toBe(seed);
        expect(PRIMES[digits]).toHaveLength(length);
        expect(PRIMES[digits][index]).toBe(answer);
        expect(dailyAnswer(PRIMES, date, digits)).toBe(answer);
    });

    it('gives the same answer on every call and a different one for another date or digit count', () => {
        expect(dailyAnswer(PRIMES, DAY, 4)).toBe(dailyAnswer(PRIMES, DAY, 4));
        expect(dailyAnswer(PRIMES, '2026-10-19', 4)).not.toBe(dailyAnswer(PRIMES, DAY, 4));
        expect(dailyAnswer(PRIMES, DAY, 5)).not.toBe(dailyAnswer(PRIMES, DAY, 4));
    });

    it('fails loudly when there is no prime list for the digit count', () => {
        expect(() => dailyAnswer({}, DAY, 4)).toThrow('missing prime candidates for digits: 4');
        expect(() => dailyAnswer({ 4: [] }, DAY, 4)).toThrow('missing prime candidates for digits: 4');
    });
});

describe('parseDailySave', () => {
    it('reads the guesses of the same day', () => {
        const raw = JSON.stringify({ date: DAY, rounds: { 3: ['101', '103'], 5: ['60139'] } });

        expect(parseDailySave(raw, DAY)).toEqual({ date: DAY, rounds: { 3: ['101', '103'], 5: ['60139'] } });
    });

    it('treats a save of another day as empty', () => {
        const raw = JSON.stringify({ date: '2026-10-17', rounds: { 3: ['101'] } });

        expect(parseDailySave(raw, DAY)).toEqual({ date: DAY, rounds: {} });
    });

    it.each([
        ['nothing stored', null],
        ['broken JSON', '{not json'],
        ['a JSON array', '[]'],
        ['a JSON null', 'null'],
        ['a date that is not a string', JSON.stringify({ date: 20261018, rounds: {} })],
        ['rounds that is not an object', JSON.stringify({ date: DAY, rounds: [] })],
        ['rounds missing', JSON.stringify({ date: DAY })],
        ['a value that is not an array', JSON.stringify({ date: DAY, rounds: { 3: '101' } })],
        ['a value with a non-string guess', JSON.stringify({ date: DAY, rounds: { 3: ['101', 103] } })]
    ])('treats %s as an empty save', (_label, raw) => {
        expect(parseDailySave(raw, DAY)).toEqual({ date: DAY, rounds: {} });
    });

    it('drops digit counts outside 2-6 and keeps the valid ones', () => {
        const raw = JSON.stringify({ date: DAY, rounds: { 7: ['1234567'], abc: ['x'], 2: ['11'] } });

        expect(parseDailySave(raw, DAY)).toEqual({ date: DAY, rounds: { 2: ['11'] } });
    });
});

describe('replayGuesses', () => {
    const fresh = () => createDailyRound(PRIMES, DAY, 2); // answer 19, 3 attempts

    it('plays accepted guesses in order and reports the result', () => {
        expect(replayGuesses(fresh(), [])?.status).toBe('playing');
        expect(replayGuesses(fresh(), ['11', '13'])).toMatchObject({ status: 'playing', attemptsUsed: 2 });
        expect(replayGuesses(fresh(), ['11', '19'])).toMatchObject({ status: 'won', attemptsUsed: 2 });
        expect(replayGuesses(fresh(), ['11', '13', '17'])).toMatchObject({ status: 'lost', attemptsUsed: 3 });
    });

    it('rejects a guess of the wrong length (the rest of the input is valid)', () => {
        expect(replayGuesses(fresh(), ['11', '131'])).toBeNull();
    });

    it('rejects a guess that is not prime (the rest of the input is valid)', () => {
        expect(replayGuesses(fresh(), ['11', '15'])).toBeNull();
    });

    it('rejects a guess that follows a win', () => {
        expect(replayGuesses(fresh(), ['19', '11'])).toBeNull();
    });

    it('rejects a guess that follows a loss (the attempt limit is reached)', () => {
        expect(replayGuesses(fresh(), ['11', '13', '17', '23'])).toBeNull();
    });
});

describe('createDailyRound', () => {
    it('is a normal-mode round with the daily answer and the attempt limit of the digit count', () => {
        expect(createDailyRound(PRIMES, DAY, 3)).toEqual({
            n: 3,
            mode: 'normal',
            attemptLimit: 4,
            answer: '163',
            attemptsUsed: 0,
            status: 'playing',
            history: []
        });
    });
});

describe('createDailyStorage', () => {
    it('gives back what was saved, keeps other digit counts and replaces a count on a new save', () => {
        const { backend } = fakeBackend();
        const storage = createDailyStorage(backend);

        storage.saveGuesses(DAY, 3, ['101']);
        storage.saveGuesses(DAY, 5, ['60139']);
        storage.saveGuesses(DAY, 3, ['101', '103']);

        expect(storage.load(DAY)).toEqual({ date: DAY, rounds: { 3: ['101', '103'], 5: ['60139'] } });
    });

    it('writes JSON under the documented key', () => {
        const { backend, state } = fakeBackend();

        createDailyStorage(backend).saveGuesses(DAY, 2, ['11']);

        expect(DAILY_STORAGE_KEY).toBe('digdle.daily');
        expect(JSON.parse(state.value ?? '')).toEqual({ date: DAY, rounds: { 2: ['11'] } });
    });

    it('reads a save that an earlier page left in the backend', () => {
        const { backend } = fakeBackend(JSON.stringify({ date: DAY, rounds: { 4: ['5711'] } }));

        expect(createDailyStorage(backend).load(DAY).rounds).toEqual({ 4: ['5711'] });
    });

    it('does not write digit counts outside 2-6 back, and an out-of-range key holding a bad value empties the whole save', () => {
        const stale = fakeBackend(JSON.stringify({ date: DAY, rounds: { 7: ['1234567'], 2: ['11'] } }));
        createDailyStorage(stale.backend).saveGuesses(DAY, 3, ['101']);
        expect(JSON.parse(stale.state.value ?? '')).toEqual({ date: DAY, rounds: { 2: ['11'], 3: ['101'] } });

        const broken = fakeBackend(JSON.stringify({ date: DAY, rounds: { 7: 123, 2: ['11'] } }));
        expect(createDailyStorage(broken.backend).load(DAY).rounds).toEqual({});
    });

    it('replaces the whole save when it is written for another day (other counts of the old day are gone)', () => {
        const { backend, state } = fakeBackend(JSON.stringify({ date: '2026-10-17', rounds: { 3: ['101'] } }));
        const storage = createDailyStorage(backend);

        storage.saveGuesses(DAY, 2, ['11']);

        expect(JSON.parse(state.value ?? '')).toEqual({ date: DAY, rounds: { 2: ['11'] } });
    });

    it('keeps working from memory when the backend refuses writes, without throwing', () => {
        const { backend, state } = fakeBackend(null, false, true);
        const storage = createDailyStorage(backend);

        expect(() => storage.saveGuesses(DAY, 2, ['11'])).not.toThrow();
        expect(state.value).toBeNull();
        expect(storage.load(DAY).rounds).toEqual({ 2: ['11'] });
    });

    it('treats a backend that throws on reads as empty and still keeps what it saved in memory', () => {
        const { backend } = fakeBackend(null, true, false);
        const storage = createDailyStorage(backend);

        expect(storage.load(DAY).rounds).toEqual({});
        storage.saveGuesses(DAY, 6, ['758819']);
        expect(storage.load(DAY).rounds).toEqual({ 6: ['758819'] });
    });

    it('works with no backend at all (storage unavailable)', () => {
        const storage = createDailyStorage(null);

        expect(storage.load(DAY).rounds).toEqual({});
        storage.saveGuesses(DAY, 3, ['101']);
        expect(storage.load(DAY).rounds).toEqual({ 3: ['101'] });
    });

    it('reads the backend while it works, so a save another tab wrote is seen and merged', () => {
        const { backend, state } = fakeBackend();
        const storage = createDailyStorage(backend);

        storage.saveGuesses(DAY, 2, ['11']);
        state.value = JSON.stringify({ date: DAY, rounds: { 2: ['11'], 3: ['163'] } });

        expect(storage.load(DAY).rounds).toEqual({ 2: ['11'], 3: ['163'] });
        storage.saveGuesses(DAY, 4, ['1009']);
        expect(JSON.parse(state.value ?? '')).toEqual({ date: DAY, rounds: { 2: ['11'], 3: ['163'], 4: ['1009'] } });
    });

    it('falls back to the memory copy for good once a write fails', () => {
        const { backend, state } = fakeBackend(null, false, true);
        const storage = createDailyStorage(backend);

        storage.saveGuesses(DAY, 2, ['11']);
        state.value = JSON.stringify({ date: DAY, rounds: { 2: ['13'] } });

        expect(storage.load(DAY).rounds).toEqual({ 2: ['11'] });
    });
});

describe('loadDailyRound', () => {
    const storageWith = (rounds: Record<string, string[]>) =>
        createDailyStorage(fakeBackend(JSON.stringify({ date: DAY, rounds })).backend);

    it('starts a fresh round when nothing is saved', () => {
        expect(loadDailyRound(createDailyStorage(null), PRIMES, DAY, 3)).toEqual(createDailyRound(PRIMES, DAY, 3));
    });

    it('plays the saved guesses back so the round resumes where it stopped', () => {
        const round = loadDailyRound(storageWith({ 3: ['101', '103'] }), PRIMES, DAY, 3);

        expect(round).toMatchObject({ status: 'playing', attemptsUsed: 2, answer: '163' });
        expect(round.history.map((entry) => entry.guess)).toEqual(['101', '103']);
    });

    it('opens a finished round as won or lost', () => {
        expect(loadDailyRound(storageWith({ 3: ['163'] }), PRIMES, DAY, 3).status).toBe('won');
        expect(loadDailyRound(storageWith({ 3: ['101', '103', '107', '109'] }), PRIMES, DAY, 3).status).toBe('lost');
    });

    it('ignores a save that does not replay (not prime) and starts fresh, leaving other counts alone', () => {
        const storage = storageWith({ 3: ['102'], 2: ['19'] });

        expect(loadDailyRound(storage, PRIMES, DAY, 3)).toEqual(createDailyRound(PRIMES, DAY, 3));
        expect(loadDailyRound(storage, PRIMES, DAY, 2).status).toBe('won');
    });

    it('ignores a save of another day', () => {
        const storage = createDailyStorage(fakeBackend(JSON.stringify({ date: '2026-10-17', rounds: { 3: ['163'] } })).backend);

        expect(loadDailyRound(storage, PRIMES, DAY, 3).status).toBe('playing');
    });
});

describe('dropsDailyResultRepeat', () => {
    it('drops an auto-repeat only while a daily result (won or lost) is shown', () => {
        expect(dropsDailyResultRepeat(true, true, 'won')).toBe(true);
        expect(dropsDailyResultRepeat(true, true, 'lost')).toBe(true);
    });

    it('keeps a first key-down on a daily result, a held key while playing, and any key outside the daily', () => {
        expect(dropsDailyResultRepeat(false, true, 'won')).toBe(false);
        expect(dropsDailyResultRepeat(true, true, 'playing')).toBe(false);
        expect(dropsDailyResultRepeat(true, false, 'won')).toBe(false);
    });
});

describe('loadDailyResults and digitLabel', () => {
    it('lists only the finished counts: cleared, failed, and nothing for in-progress or untouched ones', () => {
        const storage = createDailyStorage(fakeBackend(JSON.stringify({
            date: DAY,
            rounds: { 2: ['19'], 3: ['101', '103', '107', '109'], 4: ['1009'] }
        })).backend);

        expect(loadDailyResults(storage, PRIMES, DAY)).toEqual({ 2: 'won', 3: 'lost' });
    });

    it('labels a digit count with ✓ for a win, ✗ for a loss and the bare digit otherwise', () => {
        expect(digitLabel(3, 'won')).toBe('3✓');
        expect(digitLabel(3, 'lost')).toBe('3✗');
        expect(digitLabel(3, undefined)).toBe('3');
    });
});

describe('browserBackend and getDailyStorage', () => {
    it('has no backend without a window', () => {
        expect(browserBackend()).toBeNull();
    });

    it('uses window.localStorage when there is one, and none when reaching it throws', () => {
        const store = fakeBackend().backend;

        const withStorage = globalThis as { window?: unknown };
        try {
            withStorage.window = { localStorage: store };
            expect(browserBackend()).toBe(store);

            withStorage.window = {
                get localStorage(): never {
                    throw new Error('SecurityError');
                }
            };
            expect(browserBackend()).toBeNull();
        } finally {
            delete withStorage.window;
        }
    });

    it('hands out one shared storage', () => {
        expect(getDailyStorage()).toBe(getDailyStorage());
    });
});
