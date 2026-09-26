import { describe, expect, it } from 'vitest';
import { createEnemy, sway, updateEnemy, type Enemy, type EnemyContext } from './enemy';

const S = { width: 1024, height: 768 };
const DT = 1 / 60;

function ctx(overrides: Partial<EnemyContext> = {}): EnemyContext {
    return { player: { x: 512, y: 650 }, elapsed: 0, rng: () => 0.5, screen: S, ...overrides };
}

/** Steps an enemy for `seconds`, returning how many volleys it fired. */
function run(e: Enemy, seconds: number, c: EnemyContext = ctx()): number {
    let fired = 0;
    const frames = Math.round(seconds / DT);
    for (let i = 0; i < frames; i++) if (updateEnemy(e, DT, c)) fired++;
    return fired;
}

/** Steps until `pred` holds, failing after `limit` seconds. Returns the elapsed seconds. */
function runUntil(e: Enemy, pred: (e: Enemy) => boolean, limit = 30, c: EnemyContext = ctx()): number {
    let t = 0;
    while (!pred(e)) {
        if (t > limit) expect.fail(`condition not reached within ${limit}s (state ${e.state})`);
        updateEnemy(e, DT, c);
        t += DT;
    }
    return t;
}

describe('createEnemy', () => {
    it('starts just above the screen inside the side margins with full HP', () => {
        const low = createEnemy('shooter', 1, () => 0, S);
        const high = createEnemy('shooter', 2, () => 0.999999, S);
        expect(low.x).toBe(40);
        expect(high.x).toBeCloseTo(984, 2);
        expect(low.y).toBe(-16);
        expect(low.hp).toBe(4);
        expect(low.state).toBe('enter');
    });

    it('gives grunts a station between 15% and 30% of the screen height', () => {
        expect(createEnemy('grunt', 1, () => 0, S).stationY).toBeCloseTo(768 * 0.15);
        expect(createEnemy('grunt', 1, () => 0.999999, S).stationY).toBeCloseTo(768 * 0.3, 2);
    });

    it('places the other stations at their fixed fractions of the screen height', () => {
        const tall = { width: 768, height: 1536 };
        expect(createEnemy('shooter', 1, () => 0.5, tall).stationY).toBeCloseTo(1536 * 0.2);
        expect(createEnemy('heavy', 1, () => 0.5, tall).stationY).toBeCloseTo(1536 * 0.15);
        expect(createEnemy('rammer', 1, () => 0.5, tall).stationY).toBeCloseTo(1536 * 0.15);
    });
});

describe('entering', () => {
    it('descends at 150 px/s and does not fire before reaching its station', () => {
        const e = createEnemy('shooter', 1, () => 0.5, S);
        const fired = run(e, 0.5);
        expect(e.y).toBeCloseTo(-16 + 75, 5);
        expect(e.state).toBe('enter');
        expect(fired).toBe(0);
    });

    it('fires its first volley half a fire interval after arriving', () => {
        const e = createEnemy('grunt', 1, () => 0, S); // station 15%, dive timer 5 s
        runUntil(e, (x) => x.state === 'sway');
        // grunt interval 1.6 s: nothing before 0.8 s, a volley right after
        expect(run(e, 0.78)).toBe(0);
        expect(run(e, 0.05)).toBe(1);
    });
});

describe('sway', () => {
    it('turns around 120 px from its center', () => {
        const e = createEnemy('grunt', 1, () => 0.5, S);
        e.x = 500;
        e.swayCenter = 500;
        e.swayDir = 1;
        sway(e, 2.5, S.width); // would overshoot to 650
        expect(e.x).toBe(620);
        expect(e.swayDir).toBe(-1);
        sway(e, 5, S.width);
        expect(e.x).toBe(380);
        expect(e.swayDir).toBe(1);
    });

    it('turns around at the 40 px edge margin before reaching the full range', () => {
        const e = createEnemy('grunt', 1, () => 0.5, S);
        e.x = 60;
        e.swayCenter = 60;
        e.swayDir = -1;
        sway(e, 1, S.width);
        expect(e.x).toBe(40);
        expect(e.swayDir).toBe(1);
        e.x = 1000;
        e.swayCenter = 1000;
        sway(e, 1, S.width);
        expect(e.x).toBe(984);
    });
});

describe('grunt', () => {
    // With rng 0 the first dive comes exactly 5 s after arriving.
    const early = ctx({ rng: () => 0 });

    function arrivedGrunt(): Enemy {
        const e = createEnemy('grunt', 1, () => 0, S);
        runUntil(e, (x) => x.state === 'sway', 30, early);
        return e;
    }

    it('warns 5–7 s after arriving, then dives after a 0.5 s warning', () => {
        const e = arrivedGrunt();
        run(e, 4.98, early);
        expect(e.state).toBe('sway');
        run(e, 0.05, early);
        expect(e.state).toBe('warn');
        run(e, 0.45, early);
        expect(e.state).toBe('warn');
        run(e, 0.1, early);
        expect(e.state).toBe('dive');
    });

    it('locks its dive direction on the player position at the end of the warning', () => {
        const e = arrivedGrunt();
        runUntil(e, (x) => x.state === 'warn');
        const c = ctx({ player: { x: e.x, y: 700 } });
        runUntil(e, (x) => x.state === 'dive', 2, c);
        expect(e.heading).toBeCloseTo(Math.PI / 2);
        // Moving the player afterwards no longer changes the heading.
        run(e, 0.2, ctx({ player: { x: 0, y: 700 } }));
        expect(e.heading).toBeCloseTo(Math.PI / 2);
    });

    it('weaves 40 px to the side of its dive line', () => {
        const e = arrivedGrunt();
        runUntil(e, (x) => x.state === 'warn');
        const c = ctx({ player: { x: e.x, y: 700 } });
        runUntil(e, (x) => x.state === 'dive', 2, c);
        const lineX = e.originX;
        let maxOffset = 0;
        for (let i = 0; i < 36; i++) {
            updateEnemy(e, DT, c);
            maxOffset = Math.max(maxOffset, Math.abs(e.x - lineX));
        }
        expect(maxOffset).toBeGreaterThan(39);
        expect(maxOffset).toBeLessThanOrEqual(40.0001);
    });

    it('never fires while warning or diving', () => {
        const e = arrivedGrunt();
        runUntil(e, (x) => x.state === 'warn');
        let fired = 0;
        while (e.state === 'warn' || e.state === 'dive') if (updateEnemy(e, DT, ctx())) fired++;
        expect(fired).toBe(0);
    });

    it('comes back from the top with the same HP after leaving the screen', () => {
        const e = arrivedGrunt();
        e.hp = 1;
        runUntil(e, (x) => x.state === 'dive');
        runUntil(e, (x) => x.state === 'enter');
        expect(e.y).toBe(-14);
        expect(e.hp).toBe(1);
        expect(e.removed).toBe(false);
    });

    it('can dive upward and re-enter when the player is above it', () => {
        const e = arrivedGrunt();
        runUntil(e, (x) => x.state === 'warn');
        const c = ctx({ player: { x: e.x, y: 60 } });
        runUntil(e, (x) => x.state === 'dive', 2, c);
        expect(e.heading).toBeCloseTo(-Math.PI / 2);
        runUntil(e, (x) => x.state === 'enter', 5, c);
        expect(e.removed).toBe(false);
    });
});

describe('shooter', () => {
    it('crosses to the far side at 65% height every 8 s and climbs back', () => {
        const e = createEnemy('shooter', 1, () => 0.2, S); // spawns left of center
        runUntil(e, (x) => x.state === 'sway');
        const swayTime = runUntil(e, (x) => x.state === 'cross-down');
        expect(swayTime).toBeCloseTo(8, 1);
        runUntil(e, (x) => x.state === 'cross-side');
        expect(e.y).toBeCloseTo(768 * 0.65);
        expect(e.crossTargetX).toBe(984);
        runUntil(e, (x) => x.state === 'cross-up');
        expect(e.x).toBe(984);
        runUntil(e, (x) => x.state === 'sway');
        expect(e.y).toBeCloseTo(768 * 0.2);
        expect(e.swayCenter).toBe(984);
    });

    it('crosses to the left edge when it starts right of center', () => {
        const e = createEnemy('shooter', 1, () => 0.8, S);
        runUntil(e, (x) => x.state === 'cross-side');
        expect(e.crossTargetX).toBe(40);
    });

    it('keeps firing while crossing', () => {
        const e = createEnemy('shooter', 1, () => 0.2, S);
        runUntil(e, (x) => x.state === 'cross-down');
        let fired = 0;
        while (e.state !== 'sway') if (updateEnemy(e, DT, ctx())) fired++;
        expect(fired).toBeGreaterThan(0);
    });

    it('bobs ±30 px around its station while swaying', () => {
        const e = createEnemy('shooter', 1, () => 0.5, S);
        runUntil(e, (x) => x.state === 'sway');
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < 120; i++) {
            updateEnemy(e, DT, ctx());
            lo = Math.min(lo, e.y);
            hi = Math.max(hi, e.y);
        }
        expect(hi - e.stationY).toBeCloseTo(30, 0);
        expect(e.stationY - lo).toBeCloseTo(30, 0);
    });
});

describe('heavy', () => {
    it('keeps sinking at 25 px/s after arriving and disappears below the screen', () => {
        const e = createEnemy('heavy', 1, () => 0.5, S);
        runUntil(e, (x) => x.state === 'drift');
        const y0 = e.y;
        run(e, 2);
        expect(e.y - y0).toBeCloseTo(50, 0);
        runUntil(e, (x) => x.removed, 60);
        expect(e.y - e.radius).toBeGreaterThan(768);
    });

    it('stops firing once its center has left the screen', () => {
        const e = createEnemy('heavy', 1, () => 0.5, S);
        runUntil(e, (x) => x.state === 'drift');
        e.y = 769;
        e.fireTimer = 0;
        expect(updateEnemy(e, DT, ctx())).toBe(false);
    });
});

describe('rammer', () => {
    function warningRammer(): Enemy {
        const e = createEnemy('rammer', 1, () => 0.5, S);
        runUntil(e, (x) => x.state === 'warn');
        return e;
    }

    it('holds still for 1.0 s of warning, then charges at 450 px/s', () => {
        const e = warningRammer();
        const { x, y } = e;
        run(e, 0.98);
        expect(e.state).toBe('warn');
        expect([e.x, e.y]).toEqual([x, y]);
        run(e, 0.05);
        expect(e.state).toBe('dash');
        const before = { x: e.x, y: e.y };
        updateEnemy(e, DT, ctx());
        expect(Math.hypot(e.x - before.x, e.y - before.y)).toBeCloseTo(450 * DT);
    });

    it('never fires', () => {
        const e = createEnemy('rammer', 1, () => 0.5, S);
        let fired = 0;
        for (let i = 0; i < 300; i++) if (updateEnemy(e, DT, ctx())) fired++;
        expect(fired).toBe(0);
    });

    it('charges in a straight line before 60 s even if the player moves', () => {
        const e = warningRammer();
        runUntil(e, (x) => x.state === 'dash', 2, ctx({ player: { x: e.x, y: 650 } }));
        run(e, 0.3, ctx({ player: { x: 0, y: 650 } }));
        expect(e.heading).toBeCloseTo(Math.PI / 2);
        expect(e.homingLeft).toBe(0);
    });

    it('homes on the player for only 0.8 s, at most 60°/s, from 60 s on', () => {
        const e = warningRammer();
        const late = { elapsed: 60 };
        runUntil(e, (x) => x.state === 'dash', 2, ctx({ ...late, player: { x: e.x, y: 650 } }));
        const h0 = e.heading;
        // Player far to the left: the rammer turns toward it at the capped rate.
        const left = ctx({ ...late, player: { x: 0, y: e.y } });
        run(e, 0.5, left);
        expect(e.heading - h0).toBeCloseTo((Math.PI / 3) * 0.5, 2);
        run(e, 0.35, left);
        const locked = e.heading;
        run(e, 0.3, left);
        expect(e.heading).toBe(locked);
        expect(locked - h0).toBeCloseTo((Math.PI / 3) * 0.8, 1);
    });

    it('is removed once it leaves the screen', () => {
        const e = warningRammer();
        runUntil(e, (x) => x.removed, 5);
        expect(e.y).toBeGreaterThan(768);
    });
});
