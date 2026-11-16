import { describe, expect, it } from 'vitest';
import { multiKillBonus } from './breakdown';
import { RELEASE_LIFETIME } from './constants';
import { createEnemy, type Enemy } from './enemy';
import type { ScreenSize } from './screen';
import { World, type Input, type ReleaseGroup } from './world';

const S: ScreenSize = { width: 1024, height: 768 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

function playingWorld(screen: ScreenSize = S): World {
    const w = new World(screen, () => 0.5);
    w.step(3, NONE);
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    w.nextLeechAt = Infinity;
    return w;
}

/** An enemy that holds still and never fires (see world.test.ts). */
function still(w: World, kind: 'grunt' | 'shooter', x: number, y: number, hp?: number): Enemy {
    const e = createEnemy(kind, 1000 + w.enemies.length, () => 0.5, w.screen);
    e.x = x;
    e.y = y;
    e.state = 'dash';
    if (hp !== undefined) e.hp = hp;
    w.enemies.push(e);
    return e;
}

function steps(w: World, seconds: number): void {
    const n = Math.round(seconds / DT);
    for (let k = 0; k < n; k++) w.step(DT, NONE);
}

function untilBulletsGone(w: World, limit = 5): void {
    let t = 0;
    while (w.releaseBullets.length > 0) {
        if (t > limit) expect.fail('release bullets still flying');
        w.step(DT, NONE);
        t += DT;
    }
}

/** Puts a one-hit grunt in front of the player and fires one bullet at it; returns once the release has settled. */
function killOneGrunt(w: World): void {
    still(w, 'grunt', w.player.x, w.player.y - 100, 1);
    w.stock = 1;
    w.release();
    untilBulletsGone(w);
}

/** Fires one bullet with nothing to hit; returns once it has left the screen (a release without kills). */
function fireIntoNothing(w: World): void {
    w.stock = 1;
    w.release();
    untilBulletsGone(w);
}

function group(): ReleaseGroup {
    return { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false };
}

describe('chain level (docs/spec/chain.md)', () => {
    it('gives the first kill level 1 and no bonus', () => {
        const w = playingWorld();
        expect(w.chainLevel).toBe(0);
        killOneGrunt(w);
        expect(w.chainLevel).toBe(1);
        expect(w.score).toBe(100);
    });

    it('raises the level by 1 for a release whose first kill comes within 5 s of the last kill, doubling its score', () => {
        const w = playingWorld();
        killOneGrunt(w);
        steps(w, 3);
        killOneGrunt(w);
        expect(w.chainLevel).toBe(2);
        expect(w.score).toBe(100 + 200);
        steps(w, 1);
        killOneGrunt(w);
        expect(w.chainLevel).toBe(3);
        expect(w.score).toBe(100 + 200 + 300);
    });

    it('starts again at level 1 when the last kill is more than 5 s old', () => {
        const w = playingWorld();
        killOneGrunt(w);
        steps(w, 5.5);
        expect(w.chainLevel).toBe(1); // a window that merely ran out does not reset the level by itself
        killOneGrunt(w);
        expect(w.chainLevel).toBe(1);
        expect(w.score).toBe(200);
    });

    it('caps the multiplier at +4.0 from level 5 on', () => {
        const w = playingWorld();
        const gained: number[] = [];
        for (let i = 0; i < 7; i++) {
            const before = w.score;
            killOneGrunt(w);
            gained.push(w.score - before);
        }
        expect(gained).toEqual([100, 200, 300, 400, 500, 500, 500]);
        expect(w.chainLevel).toBe(7);
    });

    it('decides the level at a release\'s first kill only: its later kills keep it, and keep the window alive', () => {
        const w = playingWorld();
        killOneGrunt(w);
        // One release, two kills a while apart: the second kill does not raise the level again.
        still(w, 'grunt', w.player.x - 150, w.player.y - 100, 1);
        still(w, 'grunt', w.player.x + 150, w.player.y - 100, 1);
        w.stock = 4;
        w.release();
        untilBulletsGone(w);
        expect(w.chainLevel).toBe(2);
        expect(w.score).toBe(100 + 200 * 2.5); // 100 + (100 + 100) × (1 + 0.5 + 1.0)
        expect(w.chainSinceKill).toBeLessThan(1);
    });

    it('counts the window from the latest kill of any release, not from the first kill', () => {
        const w = playingWorld();
        // A release whose bullets fly for a while: kills the near grunt first, the far one 0.5 s of travel later.
        still(w, 'grunt', w.player.x, w.player.y - 100, 1);
        still(w, 'grunt', w.player.x, 100, 1);
        w.stock = 2;
        w.release();
        // The two kills are well apart in time, so "latest kill" and "first kill" differ.
        let firstKillAt = -1;
        let secondKillAt = -1;
        for (let i = 0; i < 400 && w.releaseBullets.length > 0; i++) {
            w.step(DT, NONE);
            const left = w.enemies.length;
            if (left === 1 && firstKillAt < 0) firstKillAt = w.chainClock;
            if (left === 0 && secondKillAt < 0) secondKillAt = w.chainClock;
        }
        expect(secondKillAt - firstKillAt).toBeGreaterThan(0.5);
        expect(w.chainLevel).toBe(1);
        expect(w.chainSinceKill).toBeLessThan(0.1); // the second kill is the latest one
        steps(w, 4.5);
        // About 4.7 s after the last kill but over 5.4 s after the first: inside the window only if the latest kill counts.
        killOneGrunt(w);
        expect(w.chainLevel).toBe(2);
    });

    it('lets two releases that make their first kill in the same step take levels 1 and 2 in bullet order', () => {
        const w = playingWorld();
        const a = still(w, 'grunt', 300, 300, 1);
        const b = still(w, 'grunt', 700, 300, 1);
        const ga = group();
        const gb = group();
        w.openGroups.push(ga, gb);
        w.releaseBullets.push({ x: a.x, y: a.y, heading: 0, age: 0, group: ga, target: null, removed: false });
        w.releaseBullets.push({ x: b.x, y: b.y, heading: 0, age: 0, group: gb, target: null, removed: false });
        w.step(DT, NONE);
        expect(ga.level).toBe(1);
        expect(gb.level).toBe(2);
        expect(w.chainLevel).toBe(2);
        expect(w.score).toBe(100 + 200);
    });

    it('starts level 1 from a clean slate in a new world', () => {
        expect(new World(S, () => 0.5).chainLevel).toBe(0);
        expect(new World(S, () => 0.5).chainSinceKill).toBe(Infinity);
    });
});

describe('a release without kills ends the chain', () => {
    it('resets the level to 0 when it settles, even though the window has time left; the next kill is level 1', () => {
        const w = playingWorld();
        killOneGrunt(w);
        killOneGrunt(w);
        expect(w.chainLevel).toBe(2);
        fireIntoNothing(w);
        expect(w.chainLevel).toBe(0);
        const before = w.score;
        killOneGrunt(w);
        expect(w.chainLevel).toBe(1);
        expect(w.score - before).toBe(100);
    });

    it('resets while another release is still in flight', () => {
        const w = playingWorld();
        killOneGrunt(w);
        killOneGrunt(w);
        // A release that is still flying (crossing the screen sideways) when an empty one settles.
        const lingering = { x: 50, y: 100, heading: 0, age: 0, group: group(), target: null, removed: false };
        w.releaseBullets.push(lingering);
        w.stock = 1;
        w.release();
        for (let i = 0; i < 400 && w.chainLevel !== 0; i++) w.step(DT, NONE);
        expect(w.chainLevel).toBe(0);
        expect(w.releaseBullets).toContain(lingering);
    });

    it('does not reset when a release that killed something settles', () => {
        const w = playingWorld();
        killOneGrunt(w);
        expect(w.chainLevel).toBe(1);
        killOneGrunt(w);
        expect(w.chainLevel).toBe(2);
    });

    it('lets a kill made in the same step continue the chain first; the reset comes after the kills', () => {
        const w = playingWorld();
        killOneGrunt(w);
        killOneGrunt(w);
        expect(w.chainLevel).toBe(2);
        const target = still(w, 'grunt', 700, 300, 1);
        const empty = group();
        const killer = group();
        w.openGroups.push(killer);
        // The empty release's bullet runs out of life this step and comes first in the list; the other kills the grunt.
        w.releaseBullets.push({ x: 100, y: 100, heading: 0, age: RELEASE_LIFETIME - DT / 2, group: empty, target: null, removed: false });
        w.releaseBullets.push({ x: target.x, y: target.y, heading: 0, age: 0, group: killer, target: null, removed: false });
        const before = w.score;
        w.step(DT, NONE);
        expect(killer.level).toBe(3);
        expect(w.score - before).toBe(300); // level 3 (the chain was still running when it killed): 100 × (1 + 2.0)
        expect(w.chainLevel).toBe(0); // and the empty release's settlement resets the chain afterwards
    });
});

describe('what does not count toward the chain', () => {
    it('leaves the level and the last-kill time alone when an enemy is rammed', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
        expect(w.chainLevel).toBe(0);
        expect(w.chainSinceKill).toBe(Infinity);
        expect(w.score).toBe(0);
    });

    it('does not move the window when a rammed enemy dies in the middle of a chain', () => {
        const w = playingWorld();
        killOneGrunt(w);
        steps(w, 3);
        const since = w.chainSinceKill;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.chainLevel).toBe(1);
        expect(w.chainSinceKill).toBeCloseTo(since + DT, 6);
    });

    function spawnBoss(w: World): Enemy {
        w.elapsed = w.nextBossAt;
        w.step(DT, NONE);
        if (!w.boss) expect.fail('boss did not spawn');
        const boss = w.boss;
        boss.fireTimer = Infinity;
        boss.actionTimer = Infinity;
        boss.state = 'sway';
        return boss;
    }

    it('does not count a boss killed by ramming: no level, no multiplier, score as before', () => {
        const w = playingWorld();
        const boss = spawnBoss(w);
        boss.x = w.player.x;
        boss.y = w.player.y;
        boss.stationY = boss.y;
        boss.hp = 10;
        w.step(DT, NONE);
        expect(w.boss).toBeNull();
        expect(w.score).toBe(7500);
        expect(w.chainLevel).toBe(0);
        expect(w.chainSinceKill).toBe(Infinity);
    });

    it('counts a boss killed by a release bullet like any other kill', () => {
        const w = playingWorld();
        killOneGrunt(w);
        const boss = spawnBoss(w);
        boss.x = 512;
        boss.y = 300;
        boss.stationY = 300;
        boss.hp = 1;
        w.stock = 1;
        w.release();
        untilBulletsGone(w);
        expect(w.boss).toBeNull();
        expect(w.chainLevel).toBe(2); // within 5 s of the grunt (the boss comes at its set time, so this is checked by the level)
        expect(w.chainSinceKill).toBeLessThan(0.5);
        expect(w.score).toBe(100 + 7500 * 2);
    });
});

describe('time and the end of the run', () => {
    it('measures the window with the world\'s own clock: it advances by the step it is given', () => {
        const w = playingWorld();
        killOneGrunt(w);
        const t0 = w.chainSinceKill;
        w.step(0.5, NONE);
        expect(w.chainSinceKill).toBeCloseTo(t0 + 0.5, 9);
    });

    it('does not move the window while time is not given to the world (a paused run steps with dt 0)', () => {
        const w = playingWorld();
        killOneGrunt(w);
        const t0 = w.chainSinceKill;
        w.step(0, NONE);
        expect(w.chainSinceKill).toBe(t0);
    });

    it('applies the chain to a release still in flight when the run ends, so the score includes it', () => {
        const w = playingWorld({ width: 1024, height: 1536 });
        w.player.lives = 1;
        w.chainLevel = 1;
        w.lastKillAt = w.chainClock;
        still(w, 'grunt', w.player.x, w.player.y - 100, 1);
        w.stock = 2;
        w.release();
        steps(w, 0.3);
        expect(w.enemies).toHaveLength(0);
        expect(w.releaseBullets).toHaveLength(1);
        still(w, 'shooter', w.player.x, w.player.y, 8);
        steps(w, 1.1);
        expect(w.phase).toBe('over');
        expect(w.score).toBe(200); // 100 × (1 + 1.0)
    });

    it('puts the chain bonus into the game-over bonus (final score minus the kinds\' base points)', () => {
        const w = playingWorld();
        killOneGrunt(w);
        killOneGrunt(w);
        expect(w.score).toBe(300);
        expect(multiKillBonus(w.score, w.breakdown)).toBe(100);
    });

    it('reports a settlement with the chain\'s points (what the "+points" popup shows)', () => {
        const w = playingWorld();
        killOneGrunt(w);
        still(w, 'grunt', w.player.x, w.player.y - 100, 1);
        w.stock = 1;
        w.release();
        let points = -1;
        for (let i = 0; i < 400 && points < 0; i++) {
            w.step(DT, NONE);
            if (w.settlements.length > 0) points = w.settlements[0].score;
        }
        expect(points).toBe(200);
    });
});
