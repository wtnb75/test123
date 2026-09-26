import { describe, expect, it } from 'vitest';
import { bossMaxHp, bossScore, bossVolley, createBoss, updateBoss } from './boss';
import { fireIntervalOf, type Enemy, type EnemyContext } from './enemy';
import { computeScreenSize } from './screen';

const S = { width: 1024, height: 768 };
/** A power of two, so timers land exactly on the spec's boundaries without float drift. */
const DT = 1 / 16;
const DEG = Math.PI / 180;
/**
 * Station height 768 × 30% = 230.4, and the sway range 40 + 48 .. 1024 − 40 − 48. Kept as the
 * product because 768 * 0.3 is 230.39999999999998 in floating point, so a literal 230.4 would miss.
 */
const STATION_Y = 768 * 0.3;
const LO = 88;
const HI = 936;

function ctx(overrides: Partial<EnemyContext> = {}): EnemyContext {
    return { player: { x: 512, y: 650 }, elapsed: 0, rng: () => 0.5, screen: S, ...overrides };
}

/** Steps the boss for `frames` frames, returning how many volleys it fired. */
function run(e: Enemy, frames: number, c: EnemyContext = ctx()): number {
    let fired = 0;
    for (let i = 0; i < frames; i++) if (updateBoss(e, DT, c)) fired++;
    return fired;
}

/** Steps until the boss is in `state`, failing after `limit` seconds. Returns the frames taken. */
function runUntil(e: Enemy, state: Enemy['state'], c: EnemyContext = ctx(), limit = 30): number {
    let frames = 0;
    while (e.state !== state) {
        if (frames * DT > limit) expect.fail(`boss never reached ${state}`);
        updateBoss(e, DT, c);
        frames++;
    }
    return frames;
}

/** A first boss that has just arrived and started swaying. */
function swaying(c: EnemyContext = ctx()): Enemy {
    const e = createBoss(1, 1, S);
    runUntil(e, 'sway', c);
    return e;
}

describe('boss HP and score', () => {
    it('gives the n-th boss 60 + 30 × (n − 1) HP', () => {
        expect(bossMaxHp(1)).toBe(60);
        expect(bossMaxHp(2)).toBe(90);
        expect(bossMaxHp(3)).toBe(120);
    });

    it('scores 125 per max HP: 7500 for the first boss and 11250 for the second', () => {
        expect(bossScore(createBoss(1, 1, S))).toBe(7500);
        expect(bossScore(createBoss(2, 1, S))).toBe(11250);
    });

    it('bases the score on max HP, not on the HP left', () => {
        const e = createBoss(1, 1, S);
        e.hp = 3;
        expect(bossScore(e)).toBe(7500);
    });

    it('fires every 0.8 s, unlike the regular enemy intervals', () => {
        expect(fireIntervalOf('boss')).toBe(0.8);
        expect(fireIntervalOf('grunt')).toBe(1.0);
    });
});

describe('boss entry', () => {
    it('spawns at full HP, hidden just above the top edge at the horizontal center', () => {
        const e = createBoss(2, 7, S);
        expect(e).toMatchObject({ kind: 'boss', id: 7, x: 512, y: -48, hp: 90, maxHp: 90, radius: 48, state: 'enter' });
    });

    it('descends straight down at 100 px/s without firing', () => {
        const e = createBoss(1, 1, S);
        expect(run(e, 16)).toBe(0);
        expect(e.x).toBe(512);
        expect(e.y).toBeCloseTo(52);
    });

    it('starts swaying the moment it reaches 30% of the screen height', () => {
        const e = createBoss(1, 1, S);
        // 278.4 px at 6.25 px per frame: still entering after 44 frames, swaying on the 45th.
        run(e, 44);
        expect(e.state).toBe('enter');
        run(e, 1);
        expect(e.state).toBe('sway');
        expect(e.y).toBe(STATION_Y);
    });

    it('scales its station height with a portrait screen', () => {
        const tall = { width: 768, height: 1536 };
        const e = createBoss(1, 1, tall);
        runUntil(e, 'sway', ctx({ screen: tall }));
        expect(e.y).toBeCloseTo(1536 * 0.3);
        expect(e.x).toBe(384);
    });

    it('sways only within 88..680 on a 390×844 phone in portrait', () => {
        const tall = computeScreenSize(390, 844);
        expect(tall.width).toBe(768);
        const c = ctx({ screen: tall });
        const e = createBoss(1, 1, tall);
        runUntil(e, 'sway', c);
        e.actionTimer = Infinity;
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < 16 * 20; i++) {
            updateBoss(e, DT, c);
            min = Math.min(min, e.x);
            max = Math.max(max, e.x);
        }
        expect(min).toBe(88);
        expect(max).toBe(680);
    });
});

describe('boss sway', () => {
    it('first moves right at 80 px/s', () => {
        const e = swaying();
        const x0 = e.x;
        run(e, 16);
        expect(e.x - x0).toBeCloseTo(80);
        expect(e.y).toBe(STATION_Y);
    });

    it('turns back at the edge margin plus its radius on each side', () => {
        const e = swaying();
        e.actionTimer = Infinity;
        e.x = HI - 1;
        run(e, 1);
        expect(e.x).toBe(HI);
        expect(e.swayDir).toBe(-1);
        e.x = LO + 1;
        run(e, 1);
        expect(e.x).toBe(LO);
        expect(e.swayDir).toBe(1);
    });

    it('heads inward from beyond the left end without snapping onto it, then bounces as usual', () => {
        const e = swaying();
        e.actionTimer = Infinity;
        e.x = 20;
        e.swayDir = -1;
        run(e, 1);
        expect(e.x).toBe(25); // 20 + 5, not clamped to 88
        expect(e.swayDir).toBe(1);
        run(e, 16 * 12);
        expect(e.x).toBeGreaterThanOrEqual(LO);
        expect(e.x).toBeLessThanOrEqual(HI);
        run(e, 16 * 10);
        expect(e.swayDir).toBe(-1); // reached the right end and turned
    });

    it('heads inward from beyond the right end', () => {
        const e = swaying();
        e.actionTimer = Infinity;
        e.x = 1000;
        e.swayDir = 1;
        run(e, 1);
        expect(e.x).toBe(995);
        expect(e.swayDir).toBe(-1);
    });

    it('fires every 0.8 s while swaying, but not the moment it starts', () => {
        const e = swaying();
        expect(run(e, 12)).toBe(0); // 0.75 s
        expect(run(e, 1)).toBe(1); // crosses 0.8 s
        expect(run(e, 12)).toBe(0); // 1.5625 s total: the next is due at 1.6 s
        expect(run(e, 1)).toBe(1);
    });
});

describe('boss charge', () => {
    it('telegraphs 8 s after starting to sway, without firing on that frame', () => {
        const e = swaying();
        // Volleys at 0.8, 1.6, ... 7.2 s: nine before the warning at exactly 8 s.
        expect(run(e, 127)).toBe(9);
        expect(e.state).toBe('sway');
        expect(run(e, 1)).toBe(0);
        expect(e.state).toBe('warn');
    });

    it('does not fire when a volley falls due on the very frame the warning starts', () => {
        const e = swaying();
        e.actionTimer = 0.01;
        e.fireTimer = 0.01;
        expect(run(e, 1)).toBe(0);
        expect(e.state).toBe('warn');
    });

    it('holds still and silent for 1 s while warning, then locks onto the player', () => {
        const c = ctx();
        const e = swaying(c);
        runUntil(e, 'warn', c);
        const x = e.x;
        c.player.x = 300;
        c.player.y = 500;
        expect(run(e, 15, c)).toBe(0);
        expect(e.state).toBe('warn');
        expect(e.x).toBe(x);
        run(e, 1, c);
        expect(e.state).toBe('charge');
        expect(e.chargeX).toBe(300);
        expect(e.chargeY).toBe(500);
    });

    it('charges straight at 380 px/s, ignoring later player movement', () => {
        const c = ctx();
        const e = swaying(c);
        runUntil(e, 'charge', c);
        const x0 = e.x;
        const y0 = e.y;
        const tx = e.chargeX;
        const ty = e.chargeY;
        c.player.x = 50;
        c.player.y = 700;
        expect(run(e, 4, c)).toBe(0);
        const d = Math.hypot(e.x - x0, e.y - y0);
        expect(d).toBeCloseTo(95); // 380 × 0.25
        // Still on the line toward the locked point.
        const cross = (e.x - x0) * (ty - y0) - (e.y - y0) * (tx - x0);
        expect(Math.abs(cross)).toBeLessThan(1e-6);
    });

    it('stops exactly on the locked point, then pauses 0.5 s', () => {
        const c = ctx();
        const e = swaying(c);
        runUntil(e, 'pause', c);
        expect(e.x).toBe(e.chargeX);
        expect(e.y).toBe(e.chargeY);
        expect(run(e, 7, c)).toBe(0);
        expect(e.state).toBe('pause');
        expect(e.x).toBe(e.chargeX);
        run(e, 1, c);
        expect(e.state).toBe('return');
    });

    it('returns straight up at 200 px/s to the station height, then sways again in the same direction', () => {
        const c = ctx();
        const e = swaying(c);
        runUntil(e, 'return', c);
        const x = e.x;
        const y0 = e.y;
        const dir = e.swayDir;
        expect(run(e, 4, c)).toBe(0);
        expect(e.x).toBe(x);
        expect(y0 - e.y).toBeCloseTo(50);
        runUntil(e, 'sway', c);
        expect(e.y).toBe(STATION_Y);
        expect(e.swayDir).toBe(dir);
    });

    it('restarts both the fire and the charge clocks after returning', () => {
        const c = ctx();
        const e = swaying(c);
        runUntil(e, 'return', c);
        runUntil(e, 'sway', c);
        expect(run(e, 12, c)).toBe(0);
        expect(run(e, 1, c)).toBe(1);
        run(e, 127 - 13, c);
        expect(e.state).toBe('sway');
        run(e, 1, c);
        expect(e.state).toBe('warn');
    });

    it('never leaves the field, even charging at a point near the bottom', () => {
        const c = ctx({ player: { x: 1014, y: 758 } });
        const e = swaying(c);
        runUntil(e, 'pause', c);
        expect(e.removed).toBe(false);
        runUntil(e, 'sway', c);
        expect(e.x).toBeGreaterThan(HI); // beyond the sway range after the charge...
        run(e, 1, c);
        expect(e.swayDir).toBe(-1); // ...so it heads back in
    });
});

describe('boss volleys', () => {
    const target = { x: 512, y: 650 };

    function sorted(angles: number[]): number[] {
        return angles.map((a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).sort((a, b) => a - b);
    }

    it('opens with a 16-way ring, one bullet straight down', () => {
        const e = createBoss(1, 1, S);
        const angles = bossVolley(e, target);
        expect(angles).toHaveLength(16);
        const expected = Array.from({ length: 16 }, (_, i) => (90 + 22.5 * i) * DEG);
        expect(sorted(angles)).toEqual(sorted(expected).map((a) => expect.closeTo(a, 9)));
    });

    it('follows with a 5-bullet fan at 12° steps centered on the player', () => {
        const e = createBoss(1, 1, S);
        e.x = 212;
        e.y = 250;
        bossVolley(e, target);
        const angles = bossVolley(e, target);
        const aim = Math.atan2(650 - 250, 512 - 212);
        expect(angles).toHaveLength(5);
        const offsets = angles.map((a) => Math.round((a - aim) / DEG));
        expect(offsets).toEqual([-24, -12, 0, 12, 24]);
    });

    it('turns each ring clockwise by half a gap (11.25°) from the previous one', () => {
        const e = createBoss(1, 1, S);
        const first = bossVolley(e, target);
        bossVolley(e, target);
        const second = bossVolley(e, target);
        bossVolley(e, target);
        const third = bossVolley(e, target);
        // Clockwise on screen (y down) is an increasing angle.
        expect(second[0] - first[0]).toBeCloseTo(11.25 * DEG);
        expect(third[0] - first[0]).toBeCloseTo(22.5 * DEG);
        expect(bossVolley(e, target)).toHaveLength(5);
    });

    it('keeps alternating across a charge: the pattern does not reset when swaying resumes', () => {
        const c = ctx();
        const e = swaying(c);
        let volleys = 0;
        for (let i = 0; i < 127; i++) if (updateBoss(e, DT, c)) volleys++;
        for (let i = 0; i < volleys; i++) bossVolley(e, c.player);
        expect(volleys).toBe(9);
        runUntil(e, 'warn', c);
        runUntil(e, 'sway', c); // through charge, pause and return
        // Nine volleys so far (ring first), so the next one is a fan.
        expect(bossVolley(e, c.player)).toHaveLength(5);
    });
});
