import { describe, expect, it } from 'vitest';
import {
    createFieldState, removeBulletsAt, removeEnemiesAt, shotVelocities, stepField,
    type BulletState, type EnemyState, type FieldState, type StepInput
} from './field';

// Expected values are worked out by hand from docs/spec.md (技術要件・テスト観点「敵機・敵弾の core」).
// `rand` is scripted: it hands out the listed values in order and fails if the code asks for more.

function scripted(...values: number[]) {
    let i = 0;
    const fn = () => {
        if (i >= values.length) throw new Error(`rand called ${i + 1} times, only ${values.length} scripted`);
        return values[i++];
    };
    return Object.assign(fn, { used: () => i });
}

function input(over: Partial<StepInput> & { rand?: () => number } = {}): StepInput {
    return {
        dt: 0.1, elapsedSec: 5, playerX: 240, playerY: 600,
        rand: () => { throw new Error('rand must not be called'); },
        ...over
    };
}

// A state with no spawn due: the formation timer is far from its interval, the next solo enemy is far off.
function quietState(): FieldState {
    const s = createFieldState();
    s.formationTimer = 0;
    s.soloSpawnedCount = 99;
    return s;
}

function enemy(over: Partial<EnemyState> = {}): EnemyState {
    return {
        id: 100, kind: 'formation', x: 240, y: 100, vx: 0, vy: 80, phase: 'descend',
        holdLeft: 0, fireTimer: 10, bulletType: 'straight', ...over
    };
}

function bullet(over: Partial<BulletState> = {}): BulletState {
    return { id: 200, x: 240, y: 300, vx: 0, vy: 0, type: 'straight', ...over };
}

describe('createFieldState', () => {
    it('starts empty with the formation timer past any interval and no solo enemy spawned', () => {
        const s = createFieldState();
        expect(s.enemies).toEqual([]);
        expect(s.bullets).toEqual([]);
        expect(s.formationTimer).toBe(Infinity);
        expect(s.soloSpawnedCount).toBe(0);
        expect(s.nextId).toBe(0);
    });
});

describe('stepField: formation spawn', () => {
    it('spawns a row of 3 on the first step: center x, positions, first-fire times and 5 random calls', () => {
        const s = createFieldState();
        // shape 0 -> row; center x floor(0.5 * 321 + 80) = 240; ships fire first after 0.5 + r * 0.5
        const rand = scripted(0, 0.5, 0, 0.5, 0.998);
        const { events, aborted } = stepField(s, input({ dt: 0.1, elapsedSec: 0, rand }));
        expect(aborted).toBe(false);
        expect(rand.used()).toBe(5);
        expect(events.spawnedEnemies.map((e) => e.id)).toEqual([0, 1, 2]);
        expect(s.enemies.map((e) => e.x)).toEqual([188, 240, 292]);
        expect(s.enemies.every((e) => e.vx === 0 && e.vy === 80)).toBe(true);
        // they spawned at y = -20 and moved down 80 * 0.1 in the same step
        for (const e of s.enemies) expect(e.y).toBeCloseTo(-12, 9);
        expect(s.enemies.map((e) => e.bulletType)).toEqual(['straight', 'straight', 'straight']);
        expect(s.enemies[0].fireTimer).toBeCloseTo(0.5 - 0.1, 9);
        expect(s.enemies[1].fireTimer).toBeCloseTo(0.75 - 0.1, 9);
        expect(s.enemies[2].fireTimer).toBeCloseTo(0.999 - 0.1, 9);
        expect(s.formationTimer).toBe(0);
    });

    it('puts the center x at 80 for r = 0 and at 400 for r just below 1', () => {
        const low = createFieldState();
        stepField(low, input({ dt: 0, elapsedSec: 0, rand: scripted(0, 0, 0, 0, 0) }));
        expect(low.enemies[1].x).toBe(80);
        const high = createFieldState();
        stepField(high, input({ dt: 0, elapsedSec: 0, rand: scripted(0, 0.999999, 0, 0, 0) }));
        expect(high.enemies[1].x).toBe(400);
    });

    it('always makes a row before 10 s, even when the shape roll is high', () => {
        const s = createFieldState();
        const rand = scripted(0.99, 0.5, 0, 0, 0);
        stepField(s, input({ dt: 0, elapsedSec: 9.99, rand }));
        expect(s.enemies.map((e) => e.y)).toEqual([-20, -20, -20]);
        expect(rand.used()).toBe(5);
    });

    it('makes a V (aimed bullets) from 10 s when the shape roll is 0.5, and a row when it is 0.499', () => {
        const v = createFieldState();
        const vRand = scripted(0.5, 0.5, 0, 0, 0);
        stepField(v, input({ dt: 0, elapsedSec: 10, rand: vRand }));
        expect(vRand.used()).toBe(5);
        // 3 ships: apex first, then left, then right; each wing one step (52, 0.6 * 52) behind
        expect(v.enemies.map((e) => [e.x, e.y])).toEqual([[240, -20], [188, expect.closeTo(11.2, 9)], [292, expect.closeTo(11.2, 9)]]);
        expect(v.enemies.map((e) => e.bulletType)).toEqual(['aimed', 'aimed', 'aimed']);
        const row = createFieldState();
        stepField(row, input({ dt: 0, elapsedSec: 10, rand: scripted(0.499, 0.5, 0, 0, 0) }));
        expect(row.enemies.map((e) => e.y)).toEqual([-20, -20, -20]);
    });

    it('spawns 6 ships for a 4-ship V (the pair at half a step comes after the full pairs) with 2 + 6 random calls', () => {
        const s = createFieldState();
        s.soloSpawnedCount = 1; // next solo enemy is due at 42 s, so none at 31 s
        const rand = scripted(0.5, 0.5, 0, 0, 0, 0, 0, 0);
        stepField(s, input({ dt: 0, elapsedSec: 31, rand }));
        expect(rand.used()).toBe(8);
        expect(s.enemies).toHaveLength(6);
        const ys = s.enemies.map((e) => e.y);
        const xs = s.enemies.map((e) => e.x);
        expect(xs).toEqual([188, 292, 136, 344, 162, 318]);
        expect(ys[0]).toBeCloseTo(11.2, 9);
        expect(ys[2]).toBeCloseTo(42.4, 9);
        expect(ys[4]).toBeCloseTo(26.8, 9);
    });

    it('does not spawn or roll again before the interval is reached (4 s early on)', () => {
        const s = createFieldState();
        s.formationTimer = 0;
        s.soloSpawnedCount = 99;
        stepField(s, input({ dt: 3.9, elapsedSec: 5 })); // rand would throw
        expect(s.enemies).toHaveLength(0);
        expect(s.formationTimer).toBeCloseTo(3.9, 9);
        stepField(s, input({ dt: 0.1, elapsedSec: 5, rand: scripted(0, 0.5, 0, 0, 0) }));
        expect(s.enemies).toHaveLength(3);
    });
});

describe('stepField: solo enemies', () => {
    it('spawns a rusher at x = 14 + r * 452 above the top edge, heading for the player at speed 160', () => {
        const s = quietState();
        s.soloSpawnedCount = 0; // the first solo enemy is the rusher, due at 30 s
        const rand = scripted(0.5);
        const { events } = stepField(s, input({ dt: 0.1, elapsedSec: 30, playerX: 240, playerY: 700, rand }));
        expect(rand.used()).toBe(1);
        expect(events.spawnedEnemies).toHaveLength(1);
        const r = s.enemies[0];
        expect(r.kind).toBe('rush');
        expect(r.x).toBe(240);
        expect(r.vx).toBeCloseTo(0, 9);
        expect(r.vy).toBeCloseTo(160, 9);
        expect(r.y).toBeCloseTo(-14 + 16, 9); // spawned at -14, moved 160 * 0.1 in the same step
        expect(s.soloSpawnedCount).toBe(1);
    });

    it('keeps the whole body on screen at both ends of the spawn roll', () => {
        const left = quietState();
        left.soloSpawnedCount = 0;
        stepField(left, input({ dt: 0, elapsedSec: 30, rand: scripted(0) }));
        expect(left.enemies[0].x).toBe(14);
        const right = quietState();
        right.soloSpawnedCount = 0;
        stepField(right, input({ dt: 0, elapsedSec: 30, rand: scripted(0.999999) }));
        expect(right.enemies[0].x).toBeCloseTo(466, 3);
    });

    it('spawns a stopper (second solo enemy) with zero velocity that starts descending at 80', () => {
        const s = quietState();
        s.soloSpawnedCount = 1; // due at 30 + 12 = 42 s
        stepField(s, input({ dt: 0.1, elapsedSec: 42, rand: scripted(0.5) }));
        const st = s.enemies[0];
        expect(st.kind).toBe('stop');
        expect([st.vx, st.vy]).toEqual([0, 0]);
        expect(st.phase).toBe('descend');
        expect(st.y).toBeCloseTo(-14 + 8, 9);
    });

    it('spawns no solo enemy just before it is due (29.99 s)', () => {
        const s = quietState();
        s.soloSpawnedCount = 0;
        stepField(s, input({ dt: 0.1, elapsedSec: 29.99 })); // rand would throw
        expect(s.enemies).toHaveLength(0);
    });
});

describe('stepField: firing', () => {
    it('does not shoot or roll while the fire timer is still above zero', () => {
        const s = quietState();
        s.enemies.push(enemy({ fireTimer: 1 }));
        stepField(s, input({ dt: 0.1 }));
        expect(s.bullets).toHaveLength(0);
        expect(s.enemies[0].fireTimer).toBeCloseTo(0.9, 9);
    });

    it('shoots when the timer reaches exactly zero: next interval then bullet type, in that order', () => {
        const s = quietState();
        s.enemies.push(enemy({ fireTimer: 0.1, vy: 0 }));
        const rand = scripted(0.5, 0);
        const { events } = stepField(s, input({ dt: 0.1, elapsedSec: 5, rand }));
        expect(rand.used()).toBe(2);
        // stage 1: interval 2.0 + 0.5 * 0.3, only straight bullets at speed 180
        expect(s.enemies[0].fireTimer).toBeCloseTo(2.15, 9);
        expect(events.spawnedBullets).toHaveLength(1);
        // the bullet spawned this step also moves this step: 180 * 0.1 = 18 below the enemy
        expect(s.bullets[0].y).toBeCloseTo(100 + 18, 9);
        expect(s.bullets[0].x).toBe(240);
    });

    it('picks the bullet type as floor(r * count) from the stage list: 0.999 -> fast, 0.5 -> nway5 (5 bullets)', () => {
        const fast = quietState();
        fast.enemies.push(enemy({ fireTimer: 0, vy: 0 }));
        stepField(fast, input({ dt: 0, elapsedSec: 100, rand: scripted(0, 0.999) }));
        expect(fast.bullets).toHaveLength(1);
        expect(fast.bullets[0].type).toBe('fast');
        expect(fast.bullets[0].vy).toBeCloseTo(180 * 1.6 * 2, 9);

        const nway = quietState();
        nway.enemies.push(enemy({ fireTimer: 0, vy: 0 }));
        stepField(nway, input({ dt: 0, elapsedSec: 100, rand: scripted(0, 0.5) }));
        expect(nway.enemies[0].bulletType).toBe('nway5');
        expect(nway.bullets).toHaveLength(5);
    });

    it('aims at the player position it was given', () => {
        const s = quietState();
        s.enemies.push(enemy({ x: 100, y: 100, vy: 0, fireTimer: 0 }));
        // elapsed 15: straight / aimed; r = 0.5 -> aimed. Player straight below.
        stepField(s, input({ dt: 0, elapsedSec: 15, playerX: 100, playerY: 400, rand: scripted(0, 0.5) }));
        expect(s.bullets[0].vx).toBeCloseTo(0, 9);
        expect(s.bullets[0].vy).toBeCloseTo(180, 9);
    });

    it('lets a rusher fly straight without shooting or rolling', () => {
        const s = quietState();
        s.enemies.push(enemy({ kind: 'rush', vx: 0, vy: 160, fireTimer: 0 }));
        stepField(s, input({ dt: 0.1 }));
        expect(s.bullets).toHaveLength(0);
        expect(s.enemies[0].y).toBeCloseTo(116, 9);
    });
});

describe('stepField: stopper', () => {
    function stopper(over: Partial<EnemyState> = {}): EnemyState {
        return enemy({ kind: 'stop', vy: 0, ...over });
    }

    it('shoots in the update it enters the hold when the first-fire roll fits in dt (3 random calls)', () => {
        const s = quietState();
        s.enemies.push(stopper({ y: 179 }));
        // 179 + 80 * 0.05 = 183 reaches the stop line 180; first shot in 0 * 0.3 = 0 s, so it fires at once
        const rand = scripted(0, 0.5, 0);
        stepField(s, input({ dt: 0.05, elapsedSec: 31, rand }));
        expect(rand.used()).toBe(3);
        expect(s.enemies[0].y).toBe(180);
        expect(s.enemies[0].phase).toBe('hold');
        expect(s.enemies[0].holdLeft).toBe(3);
        expect(s.enemies[0].fireTimer).toBeCloseTo(1.4 + 0.15, 9);
        expect(s.bullets).toHaveLength(1);
    });

    it('waits when the first-fire roll is longer than dt (1 random call, no shot)', () => {
        const s = quietState();
        s.enemies.push(stopper({ y: 179 }));
        const rand = scripted(0.999);
        stepField(s, input({ dt: 0.05, elapsedSec: 31, rand }));
        expect(rand.used()).toBe(1);
        expect(s.bullets).toHaveLength(0);
        expect(s.enemies[0].fireTimer).toBeCloseTo(0.999 * 0.3 - 0.05, 9);
    });

    it('does not shoot or tick the timer while descending', () => {
        const s = quietState();
        s.enemies.push(stopper({ y: 50, fireTimer: 0 }));
        stepField(s, input({ dt: 0.1 })); // rand would throw
        expect(s.bullets).toHaveLength(0);
        expect(s.enemies[0].fireTimer).toBe(0);
        expect(s.enemies[0].y).toBeCloseTo(58, 9);
    });

    it('does not shoot in the update the hold ends and it turns to ascend', () => {
        const s = quietState();
        s.enemies.push(stopper({ y: 180, phase: 'hold', holdLeft: 0.05, fireTimer: 0 }));
        stepField(s, input({ dt: 0.05 })); // rand would throw
        expect(s.enemies[0].phase).toBe('ascend');
        expect(s.bullets).toHaveLength(0);
    });

    it('shoots during the hold and keeps its y', () => {
        const s = quietState();
        s.enemies.push(stopper({ y: 180, phase: 'hold', holdLeft: 2, fireTimer: 0.05 }));
        stepField(s, input({ dt: 0.1, elapsedSec: 31, rand: scripted(0, 0) }));
        expect(s.enemies[0].y).toBe(180);
        expect(s.enemies[0].holdLeft).toBeCloseTo(1.9, 9);
        expect(s.bullets).toHaveLength(1);
    });

    it('rises after the hold and leaves once it is above -40 (exactly -40 stays)', () => {
        const stays = quietState();
        stays.enemies.push(stopper({ y: -40 + 8, phase: 'ascend' }));
        stepField(stays, input({ dt: 0.1 }));
        expect(stays.enemies).toHaveLength(1); // -40 exactly
        const gone = quietState();
        gone.enemies.push(stopper({ y: -35, phase: 'ascend' }));
        const { events } = stepField(gone, input({ dt: 0.1 }));
        expect(gone.enemies).toHaveLength(0);
        expect(events.removedEnemyIds).toEqual([100]);
    });
});

describe('stepField: removal borders', () => {
    it('removes a formation ship below the screen by more than 40 px (760 stays, beyond it goes)', () => {
        const s = quietState();
        s.enemies.push(enemy({ id: 1, y: 760, vy: 0 }), enemy({ id: 2, y: 760.001, vy: 0 }));
        const { events } = stepField(s, input({ dt: 0.01 }));
        expect(s.enemies.map((e) => e.id)).toEqual([1]);
        expect(events.removedEnemyIds).toEqual([2]);
    });

    it('removes a rusher that left by the sides or bottom (beyond 40 px)', () => {
        const s = quietState();
        s.enemies.push(
            enemy({ id: 1, kind: 'rush', x: -40, vy: 0 }),
            enemy({ id: 2, kind: 'rush', x: -40.001, vy: 0 }),
            enemy({ id: 3, kind: 'rush', x: 520.001, vy: 0 }),
            enemy({ id: 4, kind: 'rush', y: 760.001, vy: 0 }),
            enemy({ id: 5, kind: 'rush', y: 760, vy: 0 }),
            enemy({ id: 6, kind: 'rush', x: 520, vy: 0 })
        );
        const { events } = stepField(s, input({ dt: 0.01 }));
        expect(events.removedEnemyIds).toEqual([2, 3, 4]);
        expect(s.enemies.map((e) => e.id)).toEqual([1, 5, 6]);
    });

    it('removes a bullet only once it is more than 20 px outside the screen on any side', () => {
        const s = quietState();
        s.bullets.push(
            bullet({ id: 1, x: -20 }), bullet({ id: 2, x: -20.001 }),
            bullet({ id: 3, x: 500 }), bullet({ id: 4, x: 500.001 }),
            bullet({ id: 5, x: 240, y: -20 }), bullet({ id: 6, x: 240, y: -20.001 }),
            bullet({ id: 7, x: 240, y: 740 }), bullet({ id: 8, x: 240, y: 740.001 })
        );
        const { events } = stepField(s, input({ dt: 0.01 }));
        expect(s.bullets.map((b) => b.id)).toEqual([1, 3, 5, 7]);
        expect(events.removedBulletIds).toEqual([2, 4, 6, 8]);
    });

    it('moves bullets by velocity * dt', () => {
        const s = quietState();
        s.bullets.push(bullet({ x: 100, y: 100, vx: 30, vy: 100 }));
        stepField(s, input({ dt: 0.1 }));
        expect(s.bullets[0].x).toBeCloseTo(103, 9);
        expect(s.bullets[0].y).toBeCloseTo(110, 9);
    });
});

describe('stepField: stopping in the middle (a rusher touched the player)', () => {
    function threeShips(): FieldState {
        const s = quietState();
        // enemy 3 is also ready to shoot, so it would ask for 2 more random values if the step did not stop
        s.enemies.push(enemy({ id: 1, fireTimer: 0 }), enemy({ id: 2 }), enemy({ id: 3, fireTimer: 0 }));
        s.bullets.push(bullet({ id: 9, vy: 100 }));
        return s;
    }

    it('leaves the later enemies and every bullet untouched, reports what spawned, and makes no removal', () => {
        const s = threeShips();
        const rand = scripted(0.5, 0);
        const calls: number[] = [];
        const ys: number[] = [];
        const { aborted, events } = stepField(s, input({ dt: 0.1, elapsedSec: 5, rand }), (e) => {
            calls.push(e.id);
            ys.push(e.y);
            return e.id === 2;
        });
        expect(aborted).toBe(true);
        expect(calls).toEqual([1, 2]);
        expect(ys).toEqual([108, 108]); // the hook sees each enemy right after it moved
        expect(rand.used()).toBe(2); // only enemy 1 fired
        expect(s.enemies.map((e) => e.y)).toEqual([108, 108, 100]);
        // the bullet enemy 1 shot stays where it spawned (no bullet movement), and the old bullet did not move
        expect(events.spawnedBullets.map((b) => b.id)).toEqual([s.bullets[1].id]);
        expect(s.bullets[1].y).toBeCloseTo(108, 9);
        expect(s.bullets[0].y).toBe(300);
        expect(events.removedEnemyIds).toEqual([]);
        expect(events.removedBulletIds).toEqual([]);
    });

    it('still reports the formation that spawned in the same step when the hook stops at its first ship', () => {
        const s = createFieldState();
        const { aborted, events } = stepField(s, input({ dt: 0.1, elapsedSec: 0, rand: scripted(0, 0.5, 0, 0, 0) }), (e) => e.id === 0);
        expect(aborted).toBe(true);
        expect(events.spawnedEnemies.map((e) => e.id)).toEqual([0, 1, 2]);
        expect(events.removedEnemyIds).toEqual([]);
        // the first ship moved (-20 + 8); the others stay where they spawned
        expect(s.enemies.map((e) => e.y)).toEqual([expect.closeTo(-12, 9), -20, -20]);
    });

    it('carries on through all enemies and moves bullets when the hook never stops it', () => {
        const s = threeShips();
        const { aborted } = stepField(s, input({ dt: 0.1, elapsedSec: 5, rand: scripted(0.5, 0, 0.5, 0) }), () => false);
        expect(aborted).toBe(false);
        expect(s.enemies.map((e) => e.y)).toEqual([108, 108, 108]);
        expect(s.bullets[0].y).toBeCloseTo(310, 9);
    });
});

describe('stepField: ids and events', () => {
    it('gives every spawned enemy and bullet a distinct id', () => {
        const s = createFieldState();
        // 3 ships spawn on the first step (fire timers 0.5.. so none shoots); then a step far on makes them shoot
        stepField(s, input({ dt: 0.1, elapsedSec: 0, rand: scripted(0, 0.5, 0, 0, 0) }));
        stepField(s, input({ dt: 1, elapsedSec: 1, rand: scripted(0.5, 0, 0.5, 0, 0.5, 0) }));
        const ids = [...s.enemies.map((e) => e.id), ...s.bullets.map((b) => b.id)];
        expect(s.bullets).toHaveLength(3);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('reports a bullet that is shot and leaves the screen in the same step as both spawned and removed', () => {
        const s = quietState();
        // a ship 30 px left of the screen shoots straight down: the bullet starts at x = -30, beyond the -20 border
        s.enemies.push(enemy({ x: -30, vy: 0, fireTimer: 0 }));
        const { events } = stepField(s, input({ dt: 0.1, elapsedSec: 5, rand: scripted(0.5, 0) }));
        expect(events.spawnedBullets).toHaveLength(1);
        expect(events.removedBulletIds).toEqual([events.spawnedBullets[0].id]);
        expect(s.bullets).toHaveLength(0);
    });

    it('starts a recreated field from scratch: ids restart at 0 and the events arrays are not shared', () => {
        const used = createFieldState();
        stepField(used, input({ dt: 0.1, elapsedSec: 0, rand: scripted(0, 0.5, 0, 0, 0) }));
        expect(used.nextId).toBe(3);
        const fresh = createFieldState();
        expect(fresh.nextId).toBe(0);
        expect(fresh.formationTimer).toBe(Infinity);
        expect(fresh.events.spawnedEnemies).not.toBe(used.events.spawnedEnemies);
        expect(fresh.events.spawnedEnemies).toEqual([]);
    });

    it('clears the events at the start of the next step', () => {
        const s = createFieldState();
        stepField(s, input({ dt: 0.1, elapsedSec: 0, rand: scripted(0, 0.5, 0.9, 0.9, 0.9) }));
        expect(s.events.spawnedEnemies).toHaveLength(3);
        const { events } = stepField(s, input({ dt: 0.1, elapsedSec: 0.1 }));
        expect(events.spawnedEnemies).toEqual([]);
        expect(events.removedEnemyIds).toEqual([]);
    });
});

describe('shotVelocities', () => {
    // shooter at (100, 100), speed 100; player given per case
    it('shoots straight down for a straight bullet and twice as fast for a fast one', () => {
        expect(shotVelocities('straight', 100, 100, 0, 0, 100)).toEqual([{ vx: 0, vy: 100 }]);
        expect(shotVelocities('fast', 100, 100, 0, 0, 100)).toEqual([{ vx: 0, vy: 200 }]);
    });

    it('aims along the line to the player: below (pi/2), above (-pi/2) and on the same spot (atan2(0,0) = 0, to the right)', () => {
        const below = shotVelocities('aimed', 100, 100, 100, 200, 100)[0];
        expect([below.vx, below.vy]).toEqual([expect.closeTo(0, 9), expect.closeTo(100, 9)]);
        const above = shotVelocities('aimed', 100, 100, 100, 0, 100)[0];
        expect([above.vx, above.vy]).toEqual([expect.closeTo(0, 9), expect.closeTo(-100, 9)]);
        const same = shotVelocities('aimed', 100, 100, 100, 100, 100)[0];
        expect([same.vx, same.vy]).toEqual([100, 0]);
    });

    it('fans nway3 over pi/5 centred on the player direction (order: lowest angle first)', () => {
        const v = shotVelocities('nway3', 100, 100, 100, 200, 100);
        expect(v).toHaveLength(3);
        // angles pi/2 - pi/10, pi/2, pi/2 + pi/10: vx = 100 * cos(angle) = +30.902, 0, -30.902
        expect(v.map((b) => b.vx)).toEqual([expect.closeTo(30.902, 3), expect.closeTo(0, 9), expect.closeTo(-30.902, 3)]);
        expect(v.map((b) => b.vy)).toEqual([expect.closeTo(95.106, 3), expect.closeTo(100, 9), expect.closeTo(95.106, 3)]);
    });

    it('fans nway5 over pi/5 in 5 evenly spaced bullets', () => {
        const v = shotVelocities('nway5', 100, 100, 100, 200, 100);
        expect(v.map((b) => b.vx)).toEqual([
            expect.closeTo(30.902, 3), expect.closeTo(15.643, 3), expect.closeTo(0, 9),
            expect.closeTo(-15.643, 3), expect.closeTo(-30.902, 3)
        ]);
    });

    it('spreads 8 bullets every 45 degrees starting to the right, ignoring where the player is', () => {
        const v = shotVelocities('spread8', 100, 100, 100, 200, 100);
        expect(v).toHaveLength(8);
        expect([v[0].vx, v[0].vy]).toEqual([100, 0]);
        expect([v[1].vx, v[1].vy]).toEqual([expect.closeTo(70.711, 3), expect.closeTo(70.711, 3)]);
        expect([v[2].vx, v[2].vy]).toEqual([expect.closeTo(0, 9), expect.closeTo(100, 9)]);
        expect([v[4].vx, v[4].vy]).toEqual([expect.closeTo(-100, 9), expect.closeTo(0, 9)]);
        expect([v[6].vx, v[6].vy]).toEqual([expect.closeTo(0, 9), expect.closeTo(-100, 9)]);
    });
});

describe('removeEnemiesAt / removeBulletsAt', () => {
    it('removes only the listed enemies, returns their ids and keeps the survivors in order', () => {
        const s = createFieldState();
        s.enemies.push(enemy({ id: 1 }), enemy({ id: 2 }), enemy({ id: 3 }), enemy({ id: 4 }));
        expect(removeEnemiesAt(s, [0, 2])).toEqual([1, 3]);
        expect(s.enemies.map((e) => e.id)).toEqual([2, 4]);
    });

    it('removes only the listed bullets, returns their ids and keeps the survivors in order', () => {
        const s = createFieldState();
        s.bullets.push(bullet({ id: 1 }), bullet({ id: 2 }), bullet({ id: 3 }));
        expect(removeBulletsAt(s, [1])).toEqual([2]);
        expect(s.bullets.map((b) => b.id)).toEqual([1, 3]);
    });

    it('removes nothing for an empty list', () => {
        const s = createFieldState();
        s.enemies.push(enemy({ id: 1 }));
        s.bullets.push(bullet({ id: 2 }));
        expect(removeEnemiesAt(s, [])).toEqual([]);
        expect(removeBulletsAt(s, [])).toEqual([]);
        expect(s.enemies).toHaveLength(1);
        expect(s.bullets).toHaveLength(1);
    });
});
