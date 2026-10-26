import { describe, expect, it } from 'vitest';
import {
    createFormation,
    enemyShotVelocity,
    fireInterval,
    formationDrop,
    formationSpeed,
    moveFormation,
    pickShooter,
    reachedDanger,
    rowsForWave,
    shooters,
    type Enemy,
    type Formation,
} from './formation';

/** Danger lines (paddle centre − 80): phone portrait (height 1169), SE portrait (792), shortest (756). */
const DANGER_PHONE = 1169 - 100 - 80; // 989
const DANGER_SE = 792 - 100 - 80; // 612
const DANGER_MIN = 756 - 100 - 80; // 576

const bottomOf = (f: Formation) => Math.max(...f.enemies.map((e) => e.rect.y + e.rect.h / 2));

describe('rowsForWave', () => {
    it('starts at 3 rows and adds one every 2 waves up to 6', () => {
        const table: [number, number][] = [
            [1, 3],
            [2, 3],
            [3, 4],
            [4, 4],
            [5, 5],
            [6, 5],
            [7, 6],
            [8, 6],
            [20, 6],
        ];
        for (const [wave, rows] of table) expect(rowsForWave(wave), `wave ${wave}`).toBe(rows);
    });
});

describe('fireInterval', () => {
    it('is 1.2 s at wave 1 and 1.02 s at wave 2', () => {
        expect(fireInterval(1)).toBeCloseTo(1.2, 10);
        expect(fireInterval(2)).toBeCloseTo(1.02, 10);
    });

    it('is about 0.4526 s at wave 7 (still above the floor)', () => {
        expect(fireInterval(7)).toBeCloseTo(0.45259, 4); // 1.2 x 0.85^6
    });

    it('is cut to the 0.45 s floor from wave 8 (raw value about 0.3847)', () => {
        expect(fireInterval(8)).toBe(0.45);
        expect(fireInterval(30)).toBe(0.45);
    });
});

describe('formationSpeed', () => {
    it('is 50 with all 18 alive, 100 with 9 left, about 144.44 with the last one', () => {
        expect(formationSpeed(18, 18)).toBe(50);
        expect(formationSpeed(9, 18)).toBeCloseTo(100, 10);
        expect(formationSpeed(1, 18)).toBeCloseTo(50 * (1 + (2 * 17) / 18), 10);
    });

    it('falls back to the base speed for an empty formation instead of dividing by 0', () => {
        expect(formationSpeed(0, 0)).toBe(50);
    });
});

describe('formationDrop', () => {
    it('spreads the way to the danger line over 25 turns (phone wave 1: 741 / 25 = 29.64)', () => {
        expect(formationDrop(3, DANGER_PHONE)).toBeCloseTo(29.64, 10); // bottom 130 + 90 + 28 = 248
    });

    it('is 14.56 on an SE portrait screen (wave 1) and 7.84 on the shortest screen with 6 rows', () => {
        expect(formationDrop(3, DANGER_SE)).toBeCloseTo(14.56, 10);
        expect(formationDrop(6, DANGER_MIN)).toBeCloseTo(7.84, 10); // bottom 130 + 180 + 70 = 380
    });
});

describe('reachedDanger', () => {
    it('counts a bottom exactly on the line as reached, and 0.01 above it as not', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        const shift = (d: number) => f.enemies.forEach((e) => (e.rect.y += d));
        shift(DANGER_PHONE - bottomOf(f) - 0.01);
        expect(reachedDanger(f, DANGER_PHONE)).toBe(false);
        shift(0.01);
        expect(reachedDanger(f, DANGER_PHONE)).toBe(true);
    });

    it('judges by the lowest row still alive (losing the bottom row buys time)', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        const d = DANGER_PHONE - bottomOf(f);
        f.enemies.forEach((e) => (e.rect.y += d)); // bottom row exactly on the line
        expect(reachedDanger(f, DANGER_PHONE)).toBe(true);
        const bottomRowY = Math.max(...f.enemies.map((e) => e.rect.y));
        f.enemies = f.enemies.filter((e) => e.rect.y < bottomRowY); // the bottom row is destroyed
        expect(reachedDanger(f, DANGER_PHONE)).toBe(false); // the next row is 44 px higher
    });

    for (const [name, danger] of [
        ['phone (1169)', DANGER_PHONE],
        ['SE (792)', DANGER_SE],
    ] as const) {
        it(`an untouched formation reaches the line on turn 25, not before — ${name}`, () => {
            const f = createFormation(1, 1, danger);
            let turns = 0;
            let lastDir = f.dir;
            let reachedAt = -1;
            for (let i = 0; i < 100000 && reachedAt < 0; i++) {
                moveFormation(f, 0.05);
                if (f.dir !== lastDir) {
                    turns++;
                    lastDir = f.dir;
                }
                if (reachedDanger(f, danger)) reachedAt = turns;
            }
            expect(reachedAt).toBe(25);
        });
    }
});

describe('createFormation', () => {
    it('lays out 6 columns x 3 rows centered horizontally with the top row at y = 130', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        expect(f.enemies).toHaveLength(18);
        expect(f.offsetX).toBe(0);
        expect(f.dir).toBe(1);
        // Total width 6*56 + 5*14 = 406 -> left edge 67, first center 95, last center 445.
        const xs = f.enemies.map((e) => e.rect.x);
        expect(Math.min(...xs)).toBe(95);
        expect(Math.max(...xs)).toBe(445);
        const ys = [...new Set(f.enemies.map((e) => e.rect.y))];
        expect(ys).toEqual([145, 189, 233]);
        expect(f.enemies.every((e) => e.rect.w === 56 && e.rect.h === 30)).toBe(true);
    });

    it('numbers enemies from the given first id and records each column', () => {
        const f = createFormation(1, 100, DANGER_PHONE);
        expect(f.enemies.map((e) => e.id)).toEqual(Array.from({ length: 18 }, (_, i) => 100 + i));
        expect(f.enemies.filter((e) => e.col === 0).map((e) => e.rect.x)).toEqual([95, 95, 95]);
    });

    it('uses the rows for the wave (wave 7 has 6 rows)', () => {
        expect(createFormation(7, 1, DANGER_PHONE).enemies).toHaveLength(36);
    });
});

describe('moveFormation', () => {
    it('moves right at 50 px/s', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        moveFormation(f, 0.2);
        expect(f.offsetX).toBeCloseTo(10, 10);
        expect(f.enemies[0].rect.x).toBeCloseTo(105, 10);
    });

    it('when the right edge crosses the right wall (532), takes back the overshoot and turns left', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        // Right edge starts at 445 + 28 = 473; 1.5 s moves 75 -> 548, overshoot 16 -> offset 59.
        moveFormation(f, 1.5);
        expect(f.offsetX).toBeCloseTo(59, 10);
        expect(f.dir).toBe(-1);
        expect(Math.max(...f.enemies.map((e) => e.rect.x)) + 28).toBeCloseTo(532, 10);
    });

    it('when the left edge crosses the left wall (8), takes back the overshoot and turns right', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        f.dir = -1;
        f.offsetX = -55;
        moveFormation(f, 0.2); // -65 -> left edge 95 - 28 - 65 = 2, 6 inside the wall -> offset -59
        expect(f.offsetX).toBeCloseTo(-59, 10);
        expect(f.dir).toBe(1);
        expect(f.enemies[0].rect.x - 28).toBeCloseTo(8, 10);
    });

    it('turns at the remaining columns once an edge column is gone (and moves faster with fewer left)', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        f.enemies = f.enemies.filter((e) => e.col !== 5); // 15 of 18 left; rightmost living center is now 375
        // Speed 50 x (1 + 2 x 3/18) = 66.67 px/s.
        moveFormation(f, 1); // offset 66.67 -> right edge 375 + 28 + 66.67 = 469.67, still inside 532
        expect(f.dir).toBe(1);
        moveFormation(f, 1); // offset 133.33 -> 536.33, overshoot 4.33 -> 129
        expect(f.offsetX).toBeCloseTo(129, 10);
        expect(f.dir).toBe(-1);
    });

    it('drops the whole formation by `drop` on the frame it turns, and not on other frames', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        const ys = f.enemies.map((e) => e.rect.y);
        moveFormation(f, 1); // offset 50, no turn yet (room 59)
        expect(f.enemies.map((e) => e.rect.y)).toEqual(ys);
        moveFormation(f, 0.5); // first turn at the right wall
        expect(f.dir).toBe(-1);
        f.enemies.forEach((e, i) => expect(e.rect.y).toBeCloseTo(ys[i] + 29.64, 10));
    });

    it('does nothing with no enemies left', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        f.enemies = [];
        moveFormation(f, 1);
        expect(f.offsetX).toBe(0);
    });
});

describe('shooters / pickShooter', () => {
    const lowestOf = (enemies: Enemy[], col: number) =>
        enemies.filter((e) => e.col === col).reduce((a, b) => (b.rect.y > a.rect.y ? b : a));

    it('offers the lowest enemy of each column, left to right', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        const list = shooters(f.enemies);
        expect(list.map((e) => e.col)).toEqual([0, 1, 2, 3, 4, 5]);
        expect(list.every((e) => e.rect.y === 233)).toBe(true);
    });

    it('offers the enemy above once the bottom one of a column is gone, and skips an emptied column', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        const bottom0 = lowestOf(f.enemies, 0);
        let enemies = f.enemies.filter((e) => e !== bottom0);
        enemies = enemies.filter((e) => e.col !== 2);
        const list = shooters(enemies);
        expect(list.map((e) => e.col)).toEqual([0, 1, 3, 4, 5]);
        expect(list[0].rect.y).toBe(189);
    });

    it('picks the leftmost candidate with r = 0 and the rightmost with r just below 1', () => {
        const f = createFormation(1, 1, DANGER_PHONE);
        expect(pickShooter(f.enemies, 0)?.col).toBe(0);
        expect(pickShooter(f.enemies, 0.9999999)?.col).toBe(5);
        expect(pickShooter(f.enemies, 0.5)?.col).toBe(3); // floor(0.5 * 6)
    });

    it('returns undefined when no enemy is left', () => {
        expect(pickShooter([], 0.3)).toBeUndefined();
    });
});

describe('enemyShotVelocity', () => {
    it('r = 0.5 shoots straight down at 240', () => {
        const v = enemyShotVelocity(0.5);
        expect(v.vx).toBeCloseTo(0, 10);
        expect(v.vy).toBeCloseTo(240, 10);
    });

    it('r = 0 tilts 20 degrees to the left', () => {
        const v = enemyShotVelocity(0);
        expect(v.vx).toBeCloseTo(-240 * Math.sin(Math.PI / 9), 6);
        expect(v.vy).toBeCloseTo(240 * Math.cos(Math.PI / 9), 6);
    });

    it('r near 1 tilts almost 20 degrees to the right, never past it', () => {
        const v = enemyShotVelocity(0.9999999);
        expect(v.vx).toBeGreaterThan(0);
        expect(v.vx).toBeLessThan(240 * Math.sin(Math.PI / 9));
        expect(v.vx).toBeCloseTo(240 * Math.sin(Math.PI / 9), 3);
    });
});
