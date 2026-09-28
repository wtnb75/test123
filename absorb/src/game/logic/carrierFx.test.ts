import { describe, expect, it } from 'vitest';
import { DropFlashes } from './carrierFx';
import { createCarrier, createEnemy, type Enemy } from './enemy';
import { World, type Input } from './world';

// Expected values are worked out by hand from spec/carrier.md 「投下の合図」: the mark is white from the drop
// frame (t = 0) until exactly CARRIER_DROP_FLASH = 0.15 s.

const S = { width: 1024, height: 768 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

const carrier = (): Enemy => createCarrier(1, 'grunt', () => 0.1, S);

describe('drop flash timing', () => {
    it('is white from the drop frame, still at 0.149 s, and back to the cargo colour at exactly 0.15 s', () => {
        const fx = new DropFlashes();
        const c = carrier();
        fx.update(DT, [c]);
        expect(fx.isFlashing(c)).toBe(true);
        fx.update(0.149, []);
        expect(fx.isFlashing(c)).toBe(true);
        fx.update(0.001, []); // 0.149 + 0.001 is exactly 0.15 in floating point: the boundary itself
        expect(fx.isFlashing(c)).toBe(false);
        expect(fx.flashes).toHaveLength(0);
    });

    it('restarts, rather than stacks, when the same carrier drops again mid-flash', () => {
        const fx = new DropFlashes();
        const c = carrier();
        fx.update(DT, [c]);
        fx.update(0.1, [c]);
        expect(fx.flashes).toEqual([{ carrier: c, age: 0 }]);
        fx.update(0.149, []);
        expect(fx.isFlashing(c)).toBe(true);
    });

    it('gives a second carrier\'s drop its own flash, while the first still ends at its own 0.15 s', () => {
        const fx = new DropFlashes();
        const a = carrier();
        const b = carrier();
        fx.update(DT, [a]);
        fx.update(0.1, [b]);
        fx.update(0.05, []);
        expect(fx.isFlashing(a)).toBe(false);
        expect(fx.isFlashing(b)).toBe(true);
    });

    it('ends with its carrier, and makes none for a carrier already gone in its drop frame', () => {
        const fx = new DropFlashes();
        const c = carrier();
        fx.update(DT, [c]);
        c.removed = true;
        fx.update(DT, []);
        expect(fx.flashes).toHaveLength(0);
        const gone = carrier();
        gone.removed = true;
        fx.update(DT, [gone]);
        expect(fx.flashes).toHaveLength(0);
    });

    it('clears everything on restart', () => {
        const fx = new DropFlashes();
        fx.update(DT, [carrier()]);
        fx.clear();
        expect(fx.flashes).toHaveLength(0);
    });
});

function quietWorld(): World {
    const w = new World(S, () => 0.5);
    w.step(3, NONE);
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    w.nextBossAt = Infinity;
    w.nextCarrierAt = Infinity;
    return w;
}

function dueCarrier(w: World, x = 500): Enemy {
    const c = createCarrier(4000, 'grunt', () => 0.1, S);
    c.x = x;
    c.dropTimer = DT / 2;
    w.enemies.push(c);
    w.carrier = c;
    return c;
}

describe('carriers listed by the world for the drop flash', () => {
    it('lists a carrier in the step it drops, and forgets it on the next step', () => {
        const w = quietWorld();
        const c = dueCarrier(w);
        w.step(DT, NONE);
        expect(w.carrierDrops).toEqual([c]);
        w.step(DT, NONE);
        expect(w.carrierDrops).toHaveLength(0);
    });

    it('lists nothing for a carrier that is crossing without dropping', () => {
        const w = quietWorld();
        const c = dueCarrier(w);
        c.dropTimer = 10;
        w.step(DT, NONE);
        expect(w.carrierDrops).toHaveLength(0);
    });

    it('still lists a drop made in the step a ram ends the run, and nothing during ending', () => {
        const w = quietWorld();
        w.player.lives = 1;
        const c = dueCarrier(w);
        const g = createEnemy('grunt', 900, () => 0.5, S);
        g.x = w.player.x;
        g.y = w.player.y;
        g.state = 'dash';
        w.enemies.push(g);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        expect(w.carrierDrops).toEqual([c]);
        c.dropTimer = DT / 2;
        w.step(DT, NONE);
        expect(w.carrierDrops).toHaveLength(0);
    });

    it('keeps playing a flash started in the step a ram ends the run, through ending until 0.15 s', () => {
        const w = quietWorld();
        w.player.lives = 1;
        const c = dueCarrier(w);
        const g = createEnemy('grunt', 900, () => 0.5, S);
        g.x = w.player.x;
        g.y = w.player.y;
        g.state = 'dash';
        w.enemies.push(g);
        const fx = new DropFlashes();
        w.step(DT, NONE);
        fx.update(DT, w.carrierDrops);
        expect(w.phase).toBe('ending');
        expect(fx.isFlashing(c)).toBe(true);
        w.step(0.149, NONE);
        fx.update(0.149, w.carrierDrops);
        expect(fx.isFlashing(c)).toBe(true);
        w.step(0.001, NONE);
        fx.update(0.001, w.carrierDrops);
        expect(fx.isFlashing(c)).toBe(false);
    });

    it('lists a carrier shot down in the step it drops (the flash itself then skips it)', () => {
        const w = quietWorld();
        const c = dueCarrier(w);
        c.hp = 1;
        w.releaseBullets.push({
            x: c.x - 5, y: c.y, heading: 0, age: 0,
            group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
        });
        w.step(DT, NONE);
        expect(w.carrierDrops).toEqual([c]);
        expect(c.removed).toBe(true);
        const fx = new DropFlashes();
        fx.update(DT, w.carrierDrops);
        expect(fx.flashes).toHaveLength(0);
    });
});
