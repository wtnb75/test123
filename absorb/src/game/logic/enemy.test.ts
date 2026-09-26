import { describe, expect, it } from 'vitest';
import {
    assignHeavySlots, createEnemy, heavyPhase, pickSpawnEdge, sway, updateEnemy, type Enemy, type EnemyContext
} from './enemy';

const S = { width: 1024, height: 768 };
const TALL = { width: 768, height: 1536 };
const DT = 1 / 60;

/** An rng that returns the given values in order, then repeats the last one. */
function seq(...values: number[]): () => number {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
}

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

describe('pickSpawnEdge', () => {
    it('splits a landscape screen 70 / 15 / 15 between top, left and right', () => {
        expect(pickSpawnEdge(() => 0.6999, S)).toBe('top');
        expect(pickSpawnEdge(() => 0.7, S)).toBe('left');
        expect(pickSpawnEdge(() => 0.8499, S)).toBe('left');
        expect(pickSpawnEdge(() => 0.85, S)).toBe('right');
    });

    it('splits a portrait screen 50 / 25 / 25', () => {
        expect(pickSpawnEdge(() => 0.4999, TALL)).toBe('top');
        expect(pickSpawnEdge(() => 0.5, TALL)).toBe('left');
        expect(pickSpawnEdge(() => 0.7499, TALL)).toBe('left');
        expect(pickSpawnEdge(() => 0.75, TALL)).toBe('right');
    });

    it('treats a square screen as landscape', () => {
        expect(pickSpawnEdge(() => 0.6, { width: 800, height: 800 })).toBe('top');
    });

    it('falls back to the top if the rng returns exactly 1', () => {
        expect(pickSpawnEdge(() => 1, S)).toBe('top');
    });
});

describe('createEnemy', () => {
    it('puts a top spawn just above the screen inside the side margins with full HP', () => {
        const low = createEnemy('shooter', 1, seq(0, 0), S);
        const high = createEnemy('shooter', 2, seq(0, 0.999999), S);
        expect(low.entry).toBe('top');
        expect(low.x).toBe(40);
        expect(high.x).toBeCloseTo(984, 2);
        expect(low.y).toBe(-16);
        expect(low.hp).toBe(4);
        expect(low.state).toBe('enter');
    });

    it('gives top-spawned grunts a station between 15% and 30% of the screen height', () => {
        expect(createEnemy('grunt', 1, seq(0, 0.5, 0), S).stationY).toBeCloseTo(768 * 0.15);
        expect(createEnemy('grunt', 1, seq(0, 0.5, 0.999999), S).stationY).toBeCloseTo(768 * 0.3, 2);
    });

    it('places the other top stations at their fixed fractions of the screen height', () => {
        expect(createEnemy('shooter', 1, () => 0.1, TALL).stationY).toBeCloseTo(1536 * 0.2);
        expect(createEnemy('heavy', 1, () => 0.1, TALL).stationY).toBeCloseTo(1536 * 0.15);
        expect(createEnemy('rammer', 1, () => 0.1, TALL).stationY).toBeCloseTo(1536 * 0.15);
    });

    it('starts a left spawn off the left edge at 15–45% height, stopping 20–35% of the width in', () => {
        const lo = createEnemy('grunt', 1, seq(0.75, 0, 0), S);
        expect(lo.entry).toBe('left');
        expect([lo.x, lo.y]).toEqual([-14, 768 * 0.15]);
        expect([lo.stationX, lo.stationY]).toEqual([1024 * 0.2, 768 * 0.15]);
        const hi = createEnemy('grunt', 1, seq(0.75, 0.999999, 0.999999), S);
        expect(hi.y).toBeCloseTo(768 * 0.45, 2);
        expect(hi.stationX).toBeCloseTo(1024 * 0.35, 2);
    });

    it('starts a right spawn off the right edge, stopping the same distance in from that edge', () => {
        const e = createEnemy('heavy', 1, seq(0.9, 0.5, 0), S);
        expect(e.entry).toBe('right');
        expect(e.x).toBe(1024 + 28);
        expect(e.stationX).toBeCloseTo(1024 - 1024 * 0.2);
        expect(e.stationY).toBeCloseTo(768 * 0.3);
    });
});

describe('entering', () => {
    it('descends from the top at 150 px/s and does not fire before reaching its station', () => {
        const e = createEnemy('shooter', 1, seq(0, 0.5), S);
        const fired = run(e, 0.5);
        expect(e.y).toBeCloseTo(-16 + 75, 5);
        expect(e.state).toBe('enter');
        expect(fired).toBe(0);
    });

    it('slides in from a side at 150 px/s at a fixed height and arrives on its station', () => {
        const e = createEnemy('shooter', 1, seq(0.75, 0, 0), S);
        run(e, 0.5);
        expect(e.x).toBeCloseTo(-16 + 75, 5);
        expect(e.y).toBe(768 * 0.15);
        runUntil(e, (x) => x.state !== 'enter');
        expect(e.state).toBe('sway');
        expect(e.x).toBe(1024 * 0.2);
        expect(e.swayCenter).toBe(1024 * 0.2);
    });

    it('slides in from the right edge toward the left', () => {
        const e = createEnemy('grunt', 1, seq(0.9, 0.5, 0), S);
        run(e, 0.5);
        expect(e.x).toBeCloseTo(1024 + 14 - 75, 5);
    });

    it('fires its first volley half a fire interval after arriving', () => {
        const e = createEnemy('grunt', 1, () => 0, S);
        runUntil(e, (x) => x.state === 'sway', 30, ctx({ rng: () => 0 }));
        // grunt interval 1.0 s: nothing before 0.5 s, a volley right after
        expect(run(e, 0.48)).toBe(0);
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
    // With rng 0 the grunt spawns from the top and its first dive comes exactly 5 s after arriving.
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

    it('re-enters with the same HP from a freshly chosen edge after leaving the screen', () => {
        const e = arrivedGrunt();
        e.hp = 1;
        runUntil(e, (x) => x.state === 'dive');
        // rng 0.9 picks the right edge for the comeback.
        runUntil(e, (x) => x.state === 'enter', 5, ctx({ rng: () => 0.9 }));
        expect(e.entry).toBe('right');
        expect(e.x).toBe(1024 + 14);
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
    function arrivedShooter(x: number): Enemy {
        const e = createEnemy('shooter', 1, seq(0, 0.5), S);
        e.x = x;
        e.stationX = x;
        runUntil(e, (s) => s.state === 'sway');
        return e;
    }

    it('starts a sweep warning 6 s after arriving', () => {
        const e = arrivedShooter(300);
        const t = runUntil(e, (s) => s.state === 'sweep-warn');
        expect(t).toBeCloseTo(6, 1);
    });

    it('locks the player height at the end of the 0.6 s warning and sweeps toward the far edge', () => {
        const e = arrivedShooter(300);
        runUntil(e, (s) => s.state === 'sweep-warn');
        const c = ctx({ player: { x: 700, y: 500 } });
        const warn = runUntil(e, (s) => s.state === 'sweep-align', 2, c);
        expect(warn).toBeCloseTo(0.6, 1);
        expect(e.sweepY).toBe(500);
        expect(e.sweepTargetX).toBe(984);
        // The player moving afterwards doesn't change the locked height.
        runUntil(e, (s) => s.state === 'sweep', 5, ctx({ player: { x: 700, y: 100 } }));
        expect(e.y).toBe(500);
    });

    it('aligns at 300 px/s, charges at 360 px/s and returns at 200 px/s', () => {
        const e = arrivedShooter(300);
        runUntil(e, (s) => s.state === 'sweep-warn');
        const c = ctx({ player: { x: 700, y: 500 } });
        runUntil(e, (s) => s.state === 'sweep-align', 2, c);
        const y0 = e.y;
        updateEnemy(e, DT, c);
        expect(e.y - y0).toBeCloseTo(300 * DT);
        runUntil(e, (s) => s.state === 'sweep', 5, c);
        const x0 = e.x;
        updateEnemy(e, DT, c);
        expect(e.x - x0).toBeCloseTo(360 * DT);
        runUntil(e, (s) => s.state === 'sweep-return', 5, c);
        expect(e.x).toBe(984);
        const y1 = e.y;
        updateEnemy(e, DT, c);
        expect(y1 - e.y).toBeCloseTo(200 * DT);
        runUntil(e, (s) => s.state === 'sway', 5, c);
        expect(e.y).toBeCloseTo(768 * 0.2);
        expect(e.swayCenter).toBe(984);
    });

    it('sweeps toward the left edge when it starts right of center', () => {
        const e = arrivedShooter(800);
        runUntil(e, (s) => s.state === 'sweep-align');
        expect(e.sweepTargetX).toBe(40);
    });

    it('keeps firing through the whole sweep', () => {
        const e = arrivedShooter(300);
        runUntil(e, (s) => s.state === 'sweep-warn');
        let fired = 0;
        while (e.state !== 'sway') if (updateEnemy(e, DT, ctx())) fired++;
        expect(fired).toBeGreaterThan(0);
    });

    it('bobs ±30 px around its station while swaying', () => {
        const e = arrivedShooter(500);
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

    it('stops firing once its center has left the screen', () => {
        const e = arrivedShooter(500);
        // Mid-sweep the height stays where it is (swaying would bob it back on screen).
        e.state = 'sweep';
        e.sweepTargetX = 900;
        e.y = -1;
        e.fireTimer = 0;
        expect(updateEnemy(e, DT, ctx())).toBe(false);
    });
});

describe('heavyPhase', () => {
    it.each([
        [0, 'surround'], [2.99, 'surround'], [3, 'warn'], [3.49, 'warn'],
        [3.5, 'charge'], [4.99, 'charge'], [5, 'surround'], [8.5, 'charge'], [123.2, 'warn']
    ])('at %s s is %s', (t, phase) => {
        expect(heavyPhase(t)).toBe(phase);
    });
});

describe('assignHeavySlots', () => {
    function chasing(x: number, y: number): Enemy {
        const e = createEnemy('heavy', 1, () => 0.5, S);
        e.x = x;
        e.y = y;
        e.state = 'chase';
        return e;
    }
    const player = { x: 500, y: 500 };

    it('points a lone heavy at its own direction from the player', () => {
        const e = chasing(500, 200);
        assignHeavySlots([e], player);
        expect(e.slotAngle).toBeCloseTo(-Math.PI / 2);
    });

    it('spreads three heavies 120° apart starting from the oldest', () => {
        const a = chasing(800, 500);
        const b = chasing(100, 100);
        const c = chasing(100, 900);
        assignHeavySlots([a, b, c], player);
        expect(a.slotAngle).toBeCloseTo(0);
        expect(b.slotAngle).toBeCloseTo((Math.PI * 2) / 3);
        expect(c.slotAngle).toBeCloseTo((Math.PI * 4) / 3);
    });

    it('ignores heavies not yet chasing, removed heavies and other kinds', () => {
        const entering = chasing(500, 100);
        entering.state = 'enter';
        entering.slotAngle = 7;
        const gone = chasing(500, 100);
        gone.removed = true;
        gone.slotAngle = 7;
        const grunt = createEnemy('grunt', 2, () => 0.5, S);
        grunt.slotAngle = 7;
        const a = chasing(800, 500);
        const b = chasing(200, 500);
        assignHeavySlots([entering, gone, grunt, a, b], player);
        expect([entering.slotAngle, gone.slotAngle, grunt.slotAngle]).toEqual([7, 7, 7]);
        expect(a.slotAngle).toBeCloseTo(0);
        expect(b.slotAngle).toBeCloseTo(Math.PI);
    });

    it('does nothing without chasing heavies', () => {
        expect(() => assignHeavySlots([], player)).not.toThrow();
    });
});

describe('heavy', () => {
    function arrivedHeavy(): Enemy {
        const e = createEnemy('heavy', 1, seq(0, 0.5), S);
        runUntil(e, (x) => x.state === 'chase');
        return e;
    }

    it('heads for its post 180 px from the player at 70 px/s and stops there', () => {
        const e = arrivedHeavy();
        e.x = 500;
        e.y = 100;
        e.slotAngle = -Math.PI / 2; // post at (500, 320) for a player at (500, 500)
        const c = ctx({ player: { x: 500, y: 500 } });
        updateEnemy(e, DT, c);
        expect(e.y - 100).toBeCloseTo(70 * DT);
        // 220 px at 70 px/s takes about 3.14 s.
        run(e, 3.2, c);
        expect([e.x, e.y]).toEqual([500, 320]);
    });

    it('charges straight at the player at 150 px/s during the charge window', () => {
        const e = arrivedHeavy();
        e.x = 500;
        e.y = 100;
        const c = ctx({ player: { x: 500, y: 500 }, elapsed: 3.6 });
        updateEnemy(e, DT, c);
        expect(e.y - 100).toBeCloseTo(150 * DT);
    });

    it('stops on the player instead of overshooting when within one step', () => {
        const e = arrivedHeavy();
        e.x = 500;
        e.y = 499;
        updateEnemy(e, DT, ctx({ player: { x: 500, y: 500 }, elapsed: 3.6 }));
        expect([e.x, e.y]).toEqual([500, 500]);
    });

    it('speeds up to 90 px/s surrounding and 190 px/s charging from 120 s on', () => {
        const e = arrivedHeavy();
        e.x = 500;
        e.y = 0;
        e.slotAngle = -Math.PI / 2;
        updateEnemy(e, DT, ctx({ player: { x: 500, y: 500 }, elapsed: 120 }));
        expect(e.y).toBeCloseTo(90 * DT);
        const y = e.y;
        updateEnemy(e, DT, ctx({ player: { x: 500, y: 500 }, elapsed: 123.6 }));
        expect(e.y - y).toBeCloseTo(190 * DT);
    });

    it('keeps chasing and firing without ever being removed', () => {
        const e = arrivedHeavy();
        const fired = run(e, 60, ctx({ player: { x: 512, y: 700 } }));
        expect(e.removed).toBe(false);
        expect(e.state).toBe('chase');
        expect(fired).toBeGreaterThan(20);
    });
});

describe('rammer', () => {
    function warningRammer(rng: () => number = seq(0, 0.5)): Enemy {
        const e = createEnemy('rammer', 1, rng, S);
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

    it('charges sideways when it came in from a side at the player height', () => {
        const e = warningRammer(seq(0.75, 0.5, 0));
        expect(e.entry).toBe('left');
        runUntil(e, (x) => x.state === 'dash', 2, ctx({ player: { x: 900, y: e.y } }));
        expect(e.heading).toBeCloseTo(0);
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
