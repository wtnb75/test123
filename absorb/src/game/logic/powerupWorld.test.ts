import { describe, expect, it } from 'vitest';
import { createBoss } from './boss';
import { createCarrier, createEnemy, createLeech, type Enemy } from './enemy';
import type { ScreenSize } from './screen';
import { World, type Input, type ReleaseBullet } from './world';

// Expected values are worked out by hand from docs/spec/powerup.md (item 12 px at 90 px/s, boost 10 s,
// field 90 -> 135 px) and docs/spec/carrier.md.

const S: ScreenSize = { width: 1024, height: 768 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

/** A world in the playing phase with every spawn paused; the player sits at (512, 652.8). */
function quietWorld(): World {
    const w = new World(S, () => 0.5);
    w.step(3, NONE);
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    w.nextBossAt = Infinity;
    w.nextCarrierAt = Infinity;
    w.nextLeechAt = Infinity;
    return w;
}

function run(w: World, frames: number, dt = DT): void {
    for (let i = 0; i < frames; i++) w.step(dt, NONE);
}

/** An item `d` px above the player (so it is `d - 1.5` px away after one 60 fps frame of falling). */
function itemAbove(w: World, d: number): void {
    w.items.push({ x: w.player.x, y: w.player.y - d, removed: false });
}

/** A carrier at (x, y) that drops nothing and has 1 HP, with a release bullet about to hit it. */
function carrierAboutToDie(w: World, x: number, y: number): Enemy {
    const c = createCarrier(7000, 'grunt', () => 0.1, S);
    c.x = x;
    c.y = y;
    c.hp = 1;
    c.dropTimer = Infinity;
    w.enemies.push(c);
    w.carrier = c;
    shootAt(w, c);
    return c;
}

function shootAt(w: World, e: Enemy): void {
    const b: ReleaseBullet = {
        x: e.x - 5, y: e.y, heading: 0, age: 0,
        group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
    };
    w.releaseBullets.push(b);
}

/** A grunt that holds still (a state grunts never use) right on the player, so contact is certain. */
function rammerOnPlayer(w: World): void {
    const e = createEnemy('grunt', 7100, () => 0.5, S);
    e.x = w.player.x;
    e.y = w.player.y;
    e.state = 'dash';
    w.enemies.push(e);
}

describe('carrier reward: when an item drops', () => {
    it('drops one item at the carrier position when a release bullet kills it', () => {
        const w = quietWorld();
        const c = carrierAboutToDie(w, 400, 76.8);
        w.step(DT, NONE);
        expect(w.carrier).toBeNull();
        expect(w.items).toHaveLength(1);
        expect(w.items[0].x).toBeCloseTo(c.x, 10);
        expect(w.items[0].y).toBeCloseTo(c.y, 10);
    });

    it('does not move or take the item in the frame it was dropped (it joins after the frame)', () => {
        const w = quietWorld();
        // The carrier dies right above the player: even inside the field, the new item is not taken this frame.
        const c = carrierAboutToDie(w, w.player.x, w.player.y - 40);
        w.step(DT, NONE);
        expect(w.items).toHaveLength(1);
        expect(w.items[0].y).toBeCloseTo(c.y, 10);
        expect(w.pickups).toHaveLength(0);
        expect(w.powerupElapsed).toBeNull();
    });

    it('keeps x on the screen when the carrier dies with its centre outside it', () => {
        const w = quietWorld();
        carrierAboutToDie(w, -5, 76.8);
        w.step(DT, NONE);
        expect(w.items[0].x).toBe(0);
    });

    it('drops no item when the carrier is rammed (it breaks without scoring)', () => {
        const w = quietWorld();
        const c = createCarrier(7000, 'grunt', () => 0.1, S);
        c.x = w.player.x;
        c.y = w.player.y;
        c.dropTimer = Infinity;
        w.enemies.push(c);
        w.carrier = c;
        w.step(DT, NONE);
        expect(w.carrier).toBeNull();
        expect(w.player.lives).toBe(2);
        expect(w.items).toHaveLength(0);
    });

    it('drops no item when the carrier flies off the far side', () => {
        const w = quietWorld();
        const c = createCarrier(7000, 'grunt', () => 0.1, S); // enters from the left, heading right
        c.dropTimer = Infinity;
        c.x = S.width - 0.5; // one frame at 60 px/s carries its centre past the right edge
        w.enemies.push(c);
        w.carrier = c;
        run(w, 10);
        expect(w.carrier).toBeNull();
        expect(w.items).toHaveLength(0);
    });

    it('drops no item for the boss or for ordinary enemies killed by a release bullet', () => {
        const w = quietWorld();
        const boss = createBoss(1, 7200, S);
        boss.x = 300;
        boss.y = 300;
        boss.hp = 1;
        w.enemies.push(boss);
        w.boss = boss;
        shootAt(w, boss);
        const g = createEnemy('grunt', 7201, () => 0.5, S);
        g.x = 700;
        g.y = 300;
        g.hp = 1;
        g.state = 'dash';
        w.enemies.push(g);
        shootAt(w, g);
        w.step(DT, NONE);
        expect(boss.removed || w.boss === null).toBe(true);
        expect(g.removed || !w.enemies.includes(g)).toBe(true);
        expect(w.items).toHaveLength(0);
    });

    it('still drops the item in the frame the run ends on contact', () => {
        const w = quietWorld();
        w.player.lives = 1;
        rammerOnPlayer(w);
        carrierAboutToDie(w, 400, 76.8);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        expect(w.items).toHaveLength(1);
    });
});

describe('item fall and pickup in the world', () => {
    it('falls 1.5 px per 60 fps frame', () => {
        const w = quietWorld();
        w.items.push({ x: 100, y: 100, removed: false });
        run(w, 60);
        expect(w.items[0].y).toBeCloseTo(190, 6);
    });

    it('is dropped once its centre is below screen height + 12 px', () => {
        const w = quietWorld();
        w.items.push({ x: 100, y: 779, removed: false });
        w.step(DT, NONE); // 780.5 > 780
        expect(w.items).toHaveLength(0);
        expect(w.pickups).toHaveLength(0);
        expect(w.powerupElapsed).toBeNull();
    });

    it('is not touched by enemies, bullets or the player body', () => {
        const w = quietWorld();
        w.items.push({ x: w.player.x + 200, y: w.player.y - 300, removed: false });
        const g = createEnemy('grunt', 7300, () => 0.5, S);
        g.x = w.player.x + 200;
        g.y = w.player.y - 300;
        g.state = 'dash';
        g.hp = 9;
        w.enemies.push(g);
        shootAt(w, g);
        w.step(DT, NONE);
        expect(w.items).toHaveLength(1);
        expect(w.pickups).toHaveLength(0);
    });

    it('is taken when it falls into the field: it disappears, the stock and score do not change', () => {
        const w = quietWorld();
        itemAbove(w, 100);
        const stock = w.stock;
        const score = w.score;
        w.step(DT, NONE); // 98.5 px: outside 90
        expect(w.items).toHaveLength(1);
        run(w, 6); // 98.5 -> 89.5 px
        expect(w.items).toHaveLength(0);
        expect(w.stock).toBe(stock);
        expect(w.score).toBe(score);
    });

    it('lists the taken item for the frame, with the boost clock at 0 and the radius still 90', () => {
        const w = quietWorld();
        itemAbove(w, 85);
        w.step(DT, NONE);
        expect(w.pickups).toHaveLength(1);
        expect(w.powerupElapsed).toBe(0);
        expect(w.fieldRadius).toBe(90);
        w.step(DT, NONE);
        expect(w.pickups).toHaveLength(0);
    });

    it('widens the field from the next frame', () => {
        const w = quietWorld();
        itemAbove(w, 85);
        w.step(DT, NONE);
        w.step(DT, NONE);
        expect(w.fieldRadius).toBe(135);
        expect(w.powerupElapsed).toBeCloseTo(DT, 10);
    });

    it('does not widen the radius for bullets in the very frame the item is taken', () => {
        const w = quietWorld();
        itemAbove(w, 85);
        w.enemyBullets.push({ x: w.player.x, y: w.player.y + 100, vx: 0, vy: 0, removed: false });
        w.step(DT, NONE);
        expect(w.stock).toBe(0);
        w.step(DT, NONE); // next frame: 100 px is inside 135 px
        expect(w.stock).toBe(1);
    });

    it('takes several items in one frame as one boost starting from 0', () => {
        const w = quietWorld();
        itemAbove(w, 85);
        itemAbove(w, 80);
        w.step(DT, NONE);
        expect(w.pickups).toHaveLength(2);
        expect(w.powerupElapsed).toBe(0);
    });
});

describe('the boosted absorb radius', () => {
    const bulletAt = (w: World, d: number): void => {
        w.enemyBullets.push({ x: w.player.x, y: w.player.y - d, vx: 0, vy: 0, removed: false });
    };

    it('absorbs a bullet 100 px away only while boosted', () => {
        const plain = quietWorld();
        bulletAt(plain, 100);
        plain.step(DT, NONE);
        expect(plain.stock).toBe(0);

        const boosted = quietWorld();
        boosted.powerupElapsed = 3;
        bulletAt(boosted, 100);
        boosted.step(DT, NONE);
        expect(boosted.stock).toBe(1);
        expect(boosted.absorbed).toHaveLength(1);
    });

    it('absorbs at exactly 135 px and not at 135.01 px while boosted', () => {
        const a = quietWorld();
        a.powerupElapsed = 3;
        bulletAt(a, 135);
        a.step(0, NONE);
        expect(a.stock).toBe(1);
        const b = quietWorld();
        b.powerupElapsed = 3;
        bulletAt(b, 135.01);
        b.step(0, NONE);
        expect(b.stock).toBe(0);
    });

    it('ends the boost after 599 / 600 frames at 60 fps and the radius goes back to 90', () => {
        const w = quietWorld();
        itemAbove(w, 85);
        w.step(DT, NONE); // taken: e = 0
        run(w, 599);
        expect(w.powerupElapsed).not.toBeNull();
        expect(w.fieldRadius).toBe(135);
        w.step(DT, NONE);
        expect(w.powerupElapsed).toBeNull();
        expect(w.fieldRadius).toBe(90);
    });

    it('ends the boost after 199 / 200 frames of 0.05 s', () => {
        const w = quietWorld();
        itemAbove(w, 85);
        w.step(0.05, NONE);
        run(w, 199, 0.05);
        expect(w.fieldRadius).toBe(135);
        w.step(0.05, NONE);
        expect(w.fieldRadius).toBe(90);
    });

    it('restarts the clock when another item is taken during the boost, with no stacking', () => {
        const w = quietWorld();
        w.powerupElapsed = 5;
        itemAbove(w, 100); // inside the boosted 135 px
        w.step(DT, NONE);
        expect(w.pickups).toHaveLength(1);
        expect(w.powerupElapsed).toBe(0);
        expect(w.fieldRadius).toBe(135);
        run(w, 599);
        expect(w.fieldRadius).toBe(135);
        w.step(DT, NONE);
        expect(w.fieldRadius).toBe(90);
    });

    it('takes an item the old field would miss while boosted: 120 px away', () => {
        const w = quietWorld();
        w.powerupElapsed = 3;
        itemAbove(w, 120);
        w.step(DT, NONE);
        expect(w.items).toHaveLength(0);
        expect(w.pickups).toHaveLength(1);
    });

    it('starts a new boost in the frame an old one ends (radius 90, clock 0)', () => {
        const w = quietWorld();
        w.powerupElapsed = 10 - DT / 2; // this frame's time ends it
        itemAbove(w, 85);
        w.step(DT, NONE);
        expect(w.fieldRadius).toBe(90);
        expect(w.powerupElapsed).toBe(0);
    });
});

describe('items and the boost in other phases', () => {
    it('takes nothing and runs no clock before play starts', () => {
        const w = new World(S, () => 0.5);
        itemAbove(w, 20);
        w.step(DT, NONE);
        expect(w.phase).toBe('ready');
        expect(w.items).toHaveLength(1);
        expect(w.pickups).toHaveLength(0);
        expect(w.powerupElapsed).toBeNull();
        expect(w.fieldRadius).toBe(90);
    });

    it('keeps falling but takes nothing and freezes the clock while the run is ending', () => {
        const w = quietWorld();
        w.powerupElapsed = 3;
        w.player.lives = 1;
        rammerOnPlayer(w);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        itemAbove(w, 20); // right inside the field
        const y0 = w.items[0].y;
        run(w, 6);
        expect(w.phase).toBe('ending');
        expect(w.items).toHaveLength(1);
        expect(w.items[0].y).toBeGreaterThan(y0);
        expect(w.pickups).toHaveLength(0);
        expect(w.powerupElapsed).toBeCloseTo(3 + DT, 10); // advanced only in the playing frame before
    });

    it('counts an item taken in the frame the run ends as taken (the scene draws no ring for it)', () => {
        const w = quietWorld();
        w.player.lives = 1;
        rammerOnPlayer(w);
        itemAbove(w, 85);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        expect(w.pickups).toHaveLength(1);
        expect(w.powerupElapsed).toBe(0);
    });

    it('starts with no item and no boost in a new world (restart)', () => {
        const w = new World(S);
        expect(w.items).toHaveLength(0);
        expect(w.powerupElapsed).toBeNull();
        expect(w.fieldRadius).toBe(90);
    });

    it('does not move on a frame of no time (a paused scene never steps, but dt 0 must not advance anything)', () => {
        const w = quietWorld();
        w.powerupElapsed = 3;
        w.items.push({ x: 10, y: 10, removed: false });
        w.step(0, NONE);
        expect(w.powerupElapsed).toBe(3);
        expect(w.items[0].y).toBe(10);
    });
});

describe('what the boost does not change', () => {
    /** A leech 100 px from the player (outside the normal field, inside the drain range), holding still. */
    function drainWorld(boosted: boolean): World {
        const w = quietWorld();
        w.stock = 30;
        if (boosted) w.powerupElapsed = 3;
        const l = createLeech(7400, w.player, () => 0.5, S);
        l.x = w.player.x + 100;
        l.y = w.player.y;
        l.orbitAngle = 0;
        w.enemies.push(l);
        return w;
    }

    it('leech drain is the same boosted or not (range 150 px, not the field radius)', () => {
        const a = drainWorld(false);
        const b = drainWorld(true);
        run(a, 120);
        run(b, 120);
        expect(a.stock).toBeLessThan(30); // the drain really ran
        expect(b.stock).toBe(a.stock);
    });

    it('still adds one stock per absorbed bullet and auto-releases at 50 while boosted', () => {
        const w = quietWorld();
        w.powerupElapsed = 3;
        w.stock = 49;
        w.enemyBullets.push({ x: w.player.x, y: w.player.y - 120, vx: 0, vy: 0, removed: false });
        w.step(DT, NONE);
        expect(w.stock).toBe(0); // 50 reached, released at once
        expect(w.releases).toHaveLength(1);
        expect(w.releases[0].count).toBe(50);
    });

    it('still gives the consolation stock when rammed while boosted', () => {
        const w = quietWorld();
        w.powerupElapsed = 3;
        rammerOnPlayer(w);
        w.step(DT, NONE);
        expect(w.stock).toBe(10);
        expect(w.player.lives).toBe(2);
    });

    it('does not widen the body: an enemy 100 px away does not touch the boosted player', () => {
        const w = quietWorld();
        w.powerupElapsed = 3;
        const e = createEnemy('grunt', 7500, () => 0.5, S);
        e.x = w.player.x;
        e.y = w.player.y - 100;
        e.state = 'dash';
        w.enemies.push(e);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(3);
        expect(e.removed).toBe(false);
    });

    it('keeps the leech drain range at 150 px, also outside the boosted 135 px field', () => {
        const farLeech = (boosted: boolean): World => {
            const w = quietWorld();
            w.stock = 30;
            if (boosted) w.powerupElapsed = 3;
            const l = createLeech(7600, w.player, () => 0.5, S);
            l.x = w.player.x + 140;
            l.y = w.player.y;
            l.orbitAngle = 0;
            w.enemies.push(l);
            return w;
        };
        const plain = farLeech(false);
        const boosted = farLeech(true);
        run(plain, 120);
        run(boosted, 120);
        expect(plain.stock).toBeLessThan(30);
        expect(boosted.stock).toBe(plain.stock);
    });

    it('allocates a release to targets the same way boosted or not', () => {
        const setup = (boosted: boolean): number[] => {
            const w = quietWorld();
            if (boosted) w.powerupElapsed = 3;
            for (let i = 0; i < 3; i++) {
                const e = createEnemy('heavy', 7700 + i, () => 0.5, S);
                e.x = 300 + i * 150;
                e.y = 200;
                e.state = 'dash';
                w.enemies.push(e);
            }
            w.stock = 12;
            w.release();
            return w.releaseBullets.map((b) => b.target?.id ?? -1);
        };
        expect(setup(true)).toEqual(setup(false));
    });
});

describe('taking items whatever the player\'s state', () => {
    it('takes an item while invulnerable', () => {
        const w = quietWorld();
        w.player.invulnerable = 1;
        itemAbove(w, 85);
        w.step(DT, NONE);
        expect(w.pickups).toHaveLength(1);
        expect(w.powerupElapsed).toBe(0);
    });

    it('takes an item with the stock at the cap (50) and leaves the stock alone', () => {
        const w = quietWorld();
        w.stock = 50;
        itemAbove(w, 85);
        w.step(DT, NONE);
        expect(w.pickups).toHaveLength(1);
        expect(w.powerupElapsed).toBe(0);
        expect(w.stock).toBe(50);
    });
});

describe('carrier reward: whichever release kills the carrier', () => {
    it('drops the item when a manual release kills it', () => {
        const w = quietWorld();
        const c = createCarrier(7800, 'grunt', () => 0.1, S);
        c.x = w.player.x;
        c.y = 300;
        c.hp = 1;
        c.dropTimer = Infinity;
        w.enemies.push(c);
        w.carrier = c;
        w.stock = 5;
        // Bullets spread +-30 degrees; 5 bullets homing on the lone on-screen carrier reach it within 0.6 s.
        w.step(DT, { ...NONE, release: true });
        run(w, 60);
        expect(w.carrier).toBeNull();
        expect(w.items).toHaveLength(1);
    });

    it('drops the item when the automatic release at 50 stock kills it', () => {
        const w = quietWorld();
        const c = createCarrier(7900, 'grunt', () => 0.1, S);
        c.x = w.player.x;
        c.y = 300;
        c.hp = 1;
        c.dropTimer = Infinity;
        w.enemies.push(c);
        w.carrier = c;
        w.stock = 49;
        w.enemyBullets.push({ x: w.player.x, y: w.player.y - 50, vx: 0, vy: 0, removed: false });
        w.step(DT, NONE); // absorbs it: 50, released at once
        expect(w.releases).toHaveLength(1);
        run(w, 60);
        expect(w.carrier).toBeNull();
        expect(w.items).toHaveLength(1);
    });

    it('lets the dropped item start falling from the next frame: 1.5 px per frame', () => {
        const w = quietWorld();
        const c = carrierAboutToDie(w, 400, 76.8);
        w.step(DT, NONE);
        const y0 = w.items[0].y;
        expect(y0).toBeCloseTo(c.y, 10);
        w.step(DT, NONE);
        expect(w.items[0].y).toBeCloseTo(y0 + 1.5, 10);
    });
});
