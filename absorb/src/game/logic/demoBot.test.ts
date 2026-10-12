import { describe, expect, it } from 'vitest';
import {
    DEMO_HOME_Y_RATIO, DEMO_RELEASE_MIN_STOCK, DEMO_ROAM_X_PERIOD, DEMO_ROAM_Y_PERIOD, DEMO_RELEASE_RANGE, DEMO_RELEASE_STOCK, PLAYER_MIN_Y, PLAYER_RADIUS
} from './constants';
import { decideDemoInput } from './demoBot';
import { createEnemy, type Enemy } from './enemy';
import type { ScreenSize } from './screen';
import { World, type Input } from './world';

const S: ScreenSize = { width: 1024, height: 768 };
const HOME_Y = S.height * DEMO_HOME_Y_RATIO; // 599.04

function fresh(): Input {
    return { moveX: 9, moveY: 9, dragX: 9, dragY: 9, release: true };
}

/** A playing world with spawning paused and the player put at (x, y). */
function playing(x: number, y: number): World {
    const w = new World(S, () => 0.5);
    w.beginPlay();
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    w.player.x = x;
    w.player.y = y;
    return w;
}

function enemyAt(w: World, x: number, y: number, radius = 20): Enemy {
    const e = createEnemy('grunt', w.enemies.length + 1, () => 0.5, w.screen);
    e.x = x;
    e.y = y;
    e.radius = radius;
    w.enemies.push(e);
    return e;
}

function decide(w: World): Input {
    const out = fresh();
    decideDemoInput(w, out);
    return out;
}

describe('decideDemoInput movement', () => {
    it('never uses a touch drag and starts every frame from a clean input', () => {
        const out = decide(playing(512, HOME_Y));
        expect(out).toMatchObject({ dragX: 0, dragY: 0 });
    });

    it('stays still at home with nothing around', () => {
        const out = decide(playing(512, HOME_Y));
        expect(out).toMatchObject({ moveX: 0, moveY: 0, release: false });
    });

    it('heads down when it is 80 px above home (the straight move beats a diagonal one)', () => {
        // down: lands on home (0); down-diagonal: 56.57 px of drift left, costing 1.2; stay: 80 px, costing 4.2.
        const out = decide(playing(512, HOME_Y - 80));
        expect(out).toMatchObject({ moveX: 0, moveY: 1 });
    });

    it('stays within 40 px of the target but moves back once farther (a straight move beats a diagonal one)', () => {
        // At t = 0 the target is (W / 2, 0.78 H). 20 px off: stay costs 1.04, down overshoots by 60 (3.1).
        expect(decide(playing(512, HOME_Y - 20))).toMatchObject({ moveX: 0, moveY: 0 });
        // 60 px off: stay costs 3.13, down lands 20 px past it (1.04).
        expect(decide(playing(512, HOME_Y - 60))).toMatchObject({ moveX: 0, moveY: 1 });
    });

    it('roams: the target swings to the right at a quarter period and to the left at three quarters', () => {
        // t = 2.25 s: target (512 + 358.4, 640.6); right lands 281.5 px away, right-down 302.3, up-right 317.
        const right = playing(512, HOME_Y);
        right.elapsed = DEMO_ROAM_X_PERIOD / 4;
        expect(decide(right)).toMatchObject({ moveX: 1, moveY: 0 });
        // t = 6.75 s: target (512 - 358.4, 675); left lands 288.6 px away, left-down 302.4.
        const left = playing(512, HOME_Y);
        left.elapsed = (DEMO_ROAM_X_PERIOD * 3) / 4;
        expect(decide(left)).toMatchObject({ moveX: -1, moveY: 0 });
    });

    it('also climbs back to home from below', () => {
        expect(decide(playing(512, HOME_Y + 80))).toMatchObject({ moveX: 0, moveY: -1 });
    });

    it('roams up and down too: a quarter of the vertical period puts the target below', () => {
        // t = 1.375 s: target (805.6, H x 0.78 + 0.1 H x sin(1.571) = 675.8); a player level with its x goes down.
        const w = playing(806, HOME_Y);
        w.elapsed = DEMO_ROAM_Y_PERIOD / 4;
        expect(decide(w)).toMatchObject({ moveX: 0, moveY: 1 });
    });

    it('turns away from an enemy 60 px above it: down or a down-diagonal', () => {
        // stay costs 3 x (80 - 30) = 150, up 270, right/left 30 (+ 4.2 for leaving the target); the three
        // down moves cost nothing from the enemy and the same 4.2 (80 px from the target) - which one is a tie.
        const w = playing(512, HOME_Y);
        enemyAt(w, 512, HOME_Y - 60);
        expect(decide(w).moveY).toBe(1);
    });

    it('counts the gap from the enemy\'s edge: a bigger enemy is avoided from further away', () => {
        // Radius 20 at 130 px: the gap is 100 (no cost). Radius 60 at 130 px: the gap is 60 (cost 60 for staying).
        const small = playing(512, HOME_Y);
        enemyAt(small, 512, HOME_Y - 130, 20);
        expect(decide(small)).toMatchObject({ moveX: 0, moveY: 0 });

        const big = playing(512, HOME_Y);
        enemyAt(big, 512, HOME_Y - 130, 60);
        expect(decide(big)).not.toMatchObject({ moveX: 0, moveY: 0 });
    });

    it('ignores a removed enemy', () => {
        const w = playing(512, HOME_Y);
        const gone = enemyAt(w, 512, HOME_Y - 60);
        gone.removed = true;
        expect(decide(w)).toMatchObject({ moveX: 0, moveY: 0 });
    });

    it('ignores an enemy that is off screen even when its body reaches the player', () => {
        // Radius 600 centred 1 px above the screen: its edge is at the player's feet (staying would cost 270 and
        // the bot would drop away); ignored, it stays on the target.
        const w = playing(512, HOME_Y);
        enemyAt(w, 512, -1, 600);
        expect(decide(w)).toMatchObject({ moveX: 0, moveY: 0 });
    });

    it('starts to keep away only inside DEMO_ENEMY_MARGIN: a gap of 80.5 px costs nothing', () => {
        // 30 px above the target: staying costs 1.56, down 2.6 (it overshoots by 50). The enemy 110.5 px above
        // leaves a gap of 80.5 px for staying; a margin that reached 81 px would charge staying 1.5 and send
        // the bot down.
        const w = playing(512, HOME_Y - 30);
        enemyAt(w, 512, HOME_Y - 30 - 110.5);
        expect(decide(w)).toMatchObject({ moveX: 0, moveY: 0 });
    });

    it('gives no bonus for a gap just outside the margin either', () => {
        // 50 px above the target staying costs 2.6 and down 1.56; a gap of 80.5 must not make staying look better.
        const w = playing(512, HOME_Y - 50);
        enemyAt(w, 512, HOME_Y - 50 - 110.5);
        expect(decide(w)).toMatchObject({ moveX: 0, moveY: 1 });
    });

    it('is cornered by the ceiling: a move above the top limit is clamped, not counted as free', () => {
        // Player at the top limit with an enemy 60 px below. Unclamped, right-up would land 129.6 px from the
        // enemy and win; clamped, up and its diagonals stay near it, and right (a tie with left, first) wins.
        const w = playing(512, PLAYER_MIN_Y);
        enemyAt(w, 512, PLAYER_MIN_Y + 60);
        expect(decide(w)).toMatchObject({ moveX: 1, moveY: 0 });
    });

    it('drifts towards a bullet it can absorb when nothing else differs', () => {
        // Only moving right brings the five bullets (150 px away) within the 90 px field: +5 beats the 4.2
        // for leaving the target.
        const w = playing(512, HOME_Y);
        for (let i = 0; i < 5; i++) w.enemyBullets.push({ x: 662, y: HOME_Y, vx: 0, vy: 0, removed: false });
        expect(decide(w)).toMatchObject({ moveX: 1, moveY: 0 });
    });

    it('does not count removed bullets', () => {
        const w = playing(512, HOME_Y);
        for (let i = 0; i < 5; i++) w.enemyBullets.push({ x: 662, y: HOME_Y, vx: 0, vy: 0, removed: true });
        expect(decide(w)).toMatchObject({ moveX: 0, moveY: 0 });
    });

    it('is cornered by the wall: a move off the left edge is clamped, not counted as free', () => {
        // Enemy 90 px to the right of a player at the wall. Unclamped, left-up would land 157 px away (cost 2.95)
        // and win; clamped it lands where "up" does (cost 4.17, the same as "down"), and "up" comes first.
        const w = playing(PLAYER_RADIUS, HOME_Y);
        enemyAt(w, PLAYER_RADIUS + 90, HOME_Y);
        expect(decide(w)).toMatchObject({ moveX: 0, moveY: -1 });
    });

    it('never spends a move on the wall: leaving the screen is clamped, so an enemy ring is not escaped through it', () => {
        // At t = 6.75 s the target is at x = 153.6 (just inside the left wall). Enemies at 90 px right, and 60 px
        // above and below, make staying cost 360. Unclamped, moving left would land 170 px from the first and
        // 100 px from the others (cost 60 + 12.3) and win; clamped it is a stay, and every move costs more.
        const w = playing(PLAYER_RADIUS, HOME_Y);
        w.elapsed = (DEMO_ROAM_X_PERIOD * 3) / 4;
        enemyAt(w, PLAYER_RADIUS + 90, HOME_Y);
        enemyAt(w, PLAYER_RADIUS, HOME_Y + 60);
        enemyAt(w, PLAYER_RADIUS, HOME_Y - 60);
        expect(decide(w).moveX).not.toBe(-1);
    });

    it('is cornered by the right wall as well', () => {
        const w = playing(S.width - PLAYER_RADIUS, HOME_Y);
        enemyAt(w, S.width - PLAYER_RADIUS - 90, HOME_Y);
        expect(decide(w)).toMatchObject({ moveX: 0, moveY: -1 });
    });

    it('does not move or release before play begins (ready, ending)', () => {
        const ready = new World(S, () => 0.5);
        ready.stock = 50;
        enemyAt(ready, 512, ready.player.y - 60);
        expect(decide(ready)).toMatchObject({ moveX: 0, moveY: 0, release: false });

        const ending = playing(512, HOME_Y);
        ending.stock = 50;
        ending.phase = 'ending';
        expect(decide(ending)).toMatchObject({ moveX: 0, moveY: 0, release: false });

        const over = playing(512, HOME_Y - 80);
        over.stock = 50;
        over.phase = 'over';
        expect(decide(over)).toMatchObject({ moveX: 0, moveY: 0, release: false });
    });

    it('is deterministic and leaves the world untouched', () => {
        const w = playing(300, 500);
        enemyAt(w, 330, 450);
        w.enemyBullets.push({ x: 320, y: 520, vx: 1, vy: 2, removed: false });
        const before = JSON.stringify({ p: w.player, e: w.enemies, b: w.enemyBullets, s: w.stock });
        const a = decide(w);
        const b = decide(w);
        expect(b).toEqual(a);
        expect(JSON.stringify({ p: w.player, e: w.enemies, b: w.enemyBullets, s: w.stock })).toBe(before);
    });
});

describe('decideDemoInput release', () => {
    it('releases at DEMO_RELEASE_STOCK even with nothing around, not one below', () => {
        const w = playing(512, HOME_Y);
        w.stock = DEMO_RELEASE_STOCK - 1;
        expect(decide(w).release).toBe(false);
        w.stock = DEMO_RELEASE_STOCK;
        expect(decide(w).release).toBe(true);
    });

    it('releases a small stock only with an on-screen enemy within DEMO_RELEASE_RANGE', () => {
        const w = playing(512, HOME_Y);
        w.stock = DEMO_RELEASE_MIN_STOCK;
        enemyAt(w, 512 + DEMO_RELEASE_RANGE + 1, HOME_Y);
        expect(decide(w).release).toBe(false);
        w.enemies[0].x = 512 + DEMO_RELEASE_RANGE;
        expect(decide(w).release).toBe(true);
    });

    it('holds a stock below DEMO_RELEASE_MIN_STOCK however near the enemy is', () => {
        const w = playing(512, HOME_Y);
        w.stock = DEMO_RELEASE_MIN_STOCK - 1;
        enemyAt(w, 512, HOME_Y - 100);
        expect(decide(w).release).toBe(false);
    });

    it('does not count an enemy that is off screen or removed as near', () => {
        const w = playing(512, PLAYER_MIN_Y);
        w.stock = DEMO_RELEASE_MIN_STOCK;
        enemyAt(w, 512, -20); // 70 px above the player but off screen
        const gone = enemyAt(w, 512, 150);
        gone.removed = true;
        expect(decide(w).release).toBe(false);
    });

    it('never releases an empty stock', () => {
        const w = playing(512, HOME_Y);
        enemyAt(w, 512, HOME_Y - 100);
        expect(decide(w).release).toBe(false);
    });
});
