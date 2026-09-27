import { describe, expect, it } from 'vitest';
import {
    BONUS_LABEL, BREAKDOWN_KINDS, BREAKDOWN_LINES, BREAKDOWN_SHOWN_AT, bonusValue, emptyBreakdown, kindRows, lineAlpha,
    multiKillBonus, normalizeBreakdown, tallyKill, totalLabel
} from './breakdown';

// Expected values below are worked out by hand from the spec: rows in the order GRUNT, SHOOTER,
// HEAVY, RAMMER, SPLITTER, CARRIER, BOSS, then the bonus and the total; line k starts at k × 0.12 s and
// fades in over 0.2 s, so the total (line 8) starts at 0.96 s and everything is shown by 1.16 s.

describe('tallying kills', () => {
    it('starts every kind at 0 kills and 0 points', () => {
        const b = emptyBreakdown();
        for (const kind of BREAKDOWN_KINDS) expect(b[kind]).toEqual({ count: 0, points: 0 });
    });

    it('adds one kill and its base points to that kind only', () => {
        const b = emptyBreakdown();
        tallyKill(b, 'grunt', 100);
        tallyKill(b, 'grunt', 100);
        tallyKill(b, 'boss', 7500);
        expect(b.grunt).toEqual({ count: 2, points: 200 });
        expect(b.boss).toEqual({ count: 1, points: 7500 });
        expect(b.heavy).toEqual({ count: 0, points: 0 });
    });
});

describe('reading what the game-over screen received', () => {
    it('treats missing data as no kills at all', () => {
        expect(normalizeBreakdown(undefined)).toEqual(emptyBreakdown());
    });

    it('fills in missing kinds and fields with 0', () => {
        const b = normalizeBreakdown({ shooter: { count: 3, points: 1200 }, heavy: { count: 1 } });
        expect(b.shooter).toEqual({ count: 3, points: 1200 });
        expect(b.heavy).toEqual({ count: 1, points: 0 });
        expect(b.grunt).toEqual({ count: 0, points: 0 });
    });

    it('does not share objects with the data it was given', () => {
        const given = { grunt: { count: 1, points: 100 } };
        const b = normalizeBreakdown(given);
        b.grunt.count = 5;
        expect(given.grunt.count).toBe(1);
    });
});

describe('the multi-kill bonus', () => {
    it('is the final score beyond the base points: 2 grunts together score 300 on 200 base', () => {
        const b = emptyBreakdown();
        tallyKill(b, 'grunt', 100);
        tallyKill(b, 'grunt', 100);
        expect(multiKillBonus(300, b)).toBe(100);
    });

    it('is the whole score when no breakdown came with it', () => {
        expect(multiKillBonus(2500, normalizeBreakdown(undefined))).toBe(2500);
    });

    it('is the score beyond whatever part of the breakdown did come', () => {
        expect(multiKillBonus(2500, normalizeBreakdown({ shooter: { count: 3, points: 1200 } }))).toBe(1300);
    });
});

describe('breakdown wording', () => {
    it('lists the seven kinds in order, splitter and carrier between rammer and boss, as parts the screen can put in columns', () => {
        const b = emptyBreakdown();
        b.grunt = { count: 12, points: 1200 };
        expect(kindRows(b)).toEqual([
            { kind: 'grunt', name: 'GRUNT', count: '×12', points: '1200' },
            { kind: 'shooter', name: 'SHOOTER', count: '×0', points: '0' },
            { kind: 'heavy', name: 'HEAVY', count: '×0', points: '0' },
            { kind: 'rammer', name: 'RAMMER', count: '×0', points: '0' },
            { kind: 'splitter', name: 'SPLITTER', count: '×0', points: '0' },
            { kind: 'carrier', name: 'CARRIER', count: '×0', points: '0' },
            { kind: 'boss', name: 'BOSS', count: '×0', points: '0' }
        ]);
    });

    it('uses the multiplication sign U+00D7 and no thousands separators', () => {
        const b = emptyBreakdown();
        b.boss = { count: 2, points: 18750 };
        const boss = kindRows(b)[6];
        expect(boss.count.charCodeAt(0)).toBe(0x00d7);
        expect(boss.points).toBe('18750');
    });

    it('writes the bonus and total lines', () => {
        expect(BONUS_LABEL).toBe('MULTI-KILL BONUS');
        expect(bonusValue(2300)).toBe('+2300');
        expect(bonusValue(0)).toBe('+0');
        expect(totalLabel(10500)).toBe('SCORE 10500');
    });
});

describe('staggered fade-in', () => {
    it('has nine lines: seven kinds, the bonus, the total', () => {
        expect(BREAKDOWN_LINES).toBe(9);
    });

    it('keeps line 3 hidden until 0.36 s, half in at 0.46 s, fully in at 0.56 s', () => {
        expect(lineAlpha(0.35, 3)).toBe(0);
        expect(lineAlpha(0.36 - 1e-9, 3)).toBe(0);
        expect(lineAlpha(0.41, 3)).toBeCloseTo(0.25);
        expect(lineAlpha(0.46, 3)).toBeCloseTo(0.5);
        expect(lineAlpha(0.51, 3)).toBeCloseTo(0.75);
        expect(lineAlpha(0.56, 3)).toBe(1);
    });

    it('stays fully shown afterwards instead of disappearing', () => {
        expect(lineAlpha(1, 0)).toBe(1);
        expect(lineAlpha(5, 3)).toBe(1);
        expect(lineAlpha(60, 8)).toBe(1);
    });

    it('starts the first line at once and the total at 0.96 s', () => {
        expect(lineAlpha(0.1, 0)).toBeCloseTo(0.5);
        expect(lineAlpha(0.96 - 1e-9, 8)).toBe(0);
        expect(lineAlpha(1.06, 8)).toBeCloseTo(0.5);
    });

    it('ends every fade at exactly 1 even when the time is summed from frame deltas', () => {
        let t = 0;
        for (let i = 0; i < 70; i++) t += 1 / 60; // about 1.17 s of 60 fps frames, past the total's 1.16 s
        for (let i = 0; i < BREAKDOWN_LINES; i++) expect(lineAlpha(t, i)).toBe(1);
        // Line 3 ends its fade at 0.56 s, i.e. after 34 frames (33.6 frames' worth).
        let u = 0;
        for (let i = 0; i < 34; i++) u += 1 / 60;
        expect(lineAlpha(u, 3)).toBe(1);
    });

    it('has every line fully shown by 1.16 s', () => {
        expect(BREAKDOWN_SHOWN_AT).toBeCloseTo(1.16);
        for (let i = 0; i < BREAKDOWN_LINES; i++) expect(lineAlpha(BREAKDOWN_SHOWN_AT, i)).toBe(1);
    });
});
