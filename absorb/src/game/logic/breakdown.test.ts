import { describe, expect, it } from 'vitest';
import {
    BONUS_LABEL, BREAKDOWN_KINDS, BREAKDOWN_LINES, BREAKDOWN_SHOWN_AT, NO_KILLS_LABEL, bonusValue, emptyBreakdown, kindRows, lineAlpha,
    multiKillBonus, normalizeBreakdown, tableLines, tallyKill, totalLabel
} from './breakdown';

// Expected values below are worked out by hand from the spec: rows for the kinds defeated this run in the
// order GRUNT, SHOOTER, HEAVY, RAMMER, SPLITTER, CARRIER, BOSS (or one NO KILLS row), then the bonus and the
// total; line k starts at k × 0.12 s and fades in over 0.2 s. With all seven kinds shown (n = 8 table lines)
// the total (line 8) starts at 0.96 s and everything is shown by 1.16 s; a shorter table starts it at n × 0.12 s.

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

    it('drops the points of a kind that came without kills, so the bonus takes them (score 500, 0 grunts worth 200 → +500)', () => {
        const b = normalizeBreakdown({ grunt: { count: 0, points: 200 } });
        expect(b.grunt).toEqual({ count: 0, points: 0 });
        expect(kindRows(b)).toEqual([]);
        expect(multiKillBonus(500, b)).toBe(500);
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
    it('lists all seven kinds in order, splitter and carrier between rammer and boss, when each was defeated', () => {
        const b = emptyBreakdown();
        b.grunt = { count: 12, points: 1200 };
        b.shooter = { count: 1, points: 400 };
        b.heavy = { count: 1, points: 1600 };
        b.rammer = { count: 2, points: 600 };
        b.splitter = { count: 3, points: 900 };
        b.carrier = { count: 1, points: 2000 };
        b.boss = { count: 1, points: 7500 };
        expect(kindRows(b)).toEqual([
            { kind: 'grunt', name: 'GRUNT', count: '×12', points: '1200' },
            { kind: 'shooter', name: 'SHOOTER', count: '×1', points: '400' },
            { kind: 'heavy', name: 'HEAVY', count: '×1', points: '1600' },
            { kind: 'rammer', name: 'RAMMER', count: '×2', points: '600' },
            { kind: 'splitter', name: 'SPLITTER', count: '×3', points: '900' },
            { kind: 'carrier', name: 'CARRIER', count: '×1', points: '2000' },
            { kind: 'boss', name: 'BOSS', count: '×1', points: '7500' }
        ]);
    });

    it('leaves out kinds not defeated, packing the rest in order (3 grunts and a boss → GRUNT, BOSS)', () => {
        const b = emptyBreakdown();
        b.grunt = { count: 3, points: 300 };
        b.boss = { count: 1, points: 7500 };
        expect(kindRows(b).map((r) => r.name)).toEqual(['GRUNT', 'BOSS']);
    });

    it('has no kind rows when nothing was defeated, and a NO KILLS label for that case', () => {
        expect(kindRows(emptyBreakdown())).toEqual([]);
        expect(NO_KILLS_LABEL).toBe('NO KILLS');
    });

    it('shows a kind from its first kill', () => {
        const b = emptyBreakdown();
        tallyKill(b, 'heavy', 1600);
        expect(kindRows(b)).toEqual([{ kind: 'heavy', name: 'HEAVY', count: '×1', points: '1600' }]);
    });

    it('uses the multiplication sign U+00D7 and no thousands separators', () => {
        const b = emptyBreakdown();
        b.boss = { count: 2, points: 18750 };
        const [boss] = kindRows(b);
        expect(boss.count.charCodeAt(0)).toBe(0x00d7);
        expect(boss.points).toBe('18750');
    });

    it('builds a 2-line table for one kind: the kind, then the bonus (so the total is line 2)', () => {
        const b = emptyBreakdown();
        tallyKill(b, 'grunt', 100);
        tallyKill(b, 'grunt', 100);
        expect(tableLines(300, b)).toEqual([
            { type: 'kind', row: { kind: 'grunt', name: 'GRUNT', count: '×2', points: '200' } },
            { type: 'bonus', value: '+100' }
        ]);
    });

    it('builds an 8-line table when all seven kinds were defeated', () => {
        const b = emptyBreakdown();
        for (const kind of BREAKDOWN_KINDS) tallyKill(b, kind, 100);
        const lines = tableLines(700, b);
        expect(lines).toHaveLength(8);
        expect(lines.map((l) => l.type)).toEqual(['kind', 'kind', 'kind', 'kind', 'kind', 'kind', 'kind', 'bonus']);
        expect(lines[7]).toEqual({ type: 'bonus', value: '+0' });
    });

    it('builds a 2-line table with NO KILLS and a +0 bonus when nothing was defeated', () => {
        expect(tableLines(0, emptyBreakdown())).toEqual([{ type: 'noKills' }, { type: 'bonus', value: '+0' }]);
    });

    it('never shows NO KILLS next to kind rows', () => {
        const b = emptyBreakdown();
        tallyKill(b, 'boss', 7500);
        expect(tableLines(7500, b).map((l) => l.type)).toEqual(['kind', 'bonus']);
    });

    it('writes the bonus and total lines', () => {
        expect(BONUS_LABEL).toBe('MULTI-KILL BONUS');
        expect(bonusValue(2300)).toBe('+2300');
        expect(bonusValue(0)).toBe('+0');
        expect(totalLabel(10500)).toBe('SCORE 10500');
    });
});

describe('staggered fade-in', () => {
    it('has at most nine lines: all seven kinds, the bonus, the total', () => {
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

    it('brings a short table in early: with one kind (n = 2) the total, line 2, starts at 0.24 s and is in by 0.44 s', () => {
        expect(lineAlpha(0.24, 2)).toBe(0);
        expect(lineAlpha(0.34, 2)).toBeCloseTo(0.5);
        expect(lineAlpha(0.44, 2)).toBe(1);
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
