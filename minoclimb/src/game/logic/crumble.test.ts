// Stuck-crumble (docs/spec/stuck-crumble.md): sealed-in detection, target choice, timer and row-clear following.
import { describe, expect, it } from 'vitest';
import { P } from '../params';
import { createGrid, type Grid } from './board';
import { Crumble, isSealed, pickCrumbleCell } from './crumble';
import type { Player } from './player';

const DT = 1 / 60;

/** Makes every cell of row `r` solid except the columns in `gaps`. */
const fillRow = (g: Grid, r: number, gaps: readonly number[] = []): void => {
    for (let c = 0; c < P.COLS; c++) if (!gaps.includes(c)) g[r][c] = 1;
};

/**
 * A climber whose body centre is in cell (c, r); `onGround` puts the feet on the bottom edge of row r. `x` is the
 * left edge of the body (default: inside column c); the centre stays in column c for x in [c - 0.35, c + 0.65).
 */
const at = (c: number, r: number, onGround = true, x = c + 0.15): Player => ({ x, y: r + 0.1 - 1e-6, vy: 0, onGround });

/** Spec example A: rows 15-19 solid except a 2-wide pocket (columns 4-5, rows 16-19) under a cap in row 15. */
const exampleA = (): Grid => {
    const g = createGrid();
    for (let r = 15; r <= 19; r++) fillRow(g, r, r === 15 ? [] : [4, 5]);
    return g;
};

/**
 * Spec example B: a one-row pocket (columns 4-5, row 17) under a 2-thick roof (rows 15-16), on a floor (row 18)
 * with a second closed hollow below it (columns 4-5, row 19).
 */
const exampleB = (): Grid => {
    const g = createGrid();
    fillRow(g, 15);
    fillRow(g, 16);
    fillRow(g, 17, [4, 5]);
    fillRow(g, 18);
    fillRow(g, 19, [4, 5]);
    return g;
};

describe('isSealed', () => {
    it('is false on an empty field: row 0 is open to the sky', () => {
        expect(isSealed(createGrid(), at(4, 18))).toBe(false);
    });

    it('is true under the cap of a closed pocket (example A)', () => {
        expect(isSealed(exampleA(), at(4, 18))).toBe(true);
    });

    it('turns false when one cap cell is removed, because the pocket then reaches row 0', () => {
        const g = exampleA();
        g[15][4] = 0;
        expect(isSealed(g, at(4, 18))).toBe(false);
    });

    it('treats a gap that only touches the pocket diagonally as closed', () => {
        const g = createGrid();
        for (let r = 15; r <= 19; r++) fillRow(g, r, r === 15 ? [3] : [4]); // one-wide pocket in column 4
        // (3,15) is empty and open above, and touches the pocket cell (4,16) only at a corner.
        expect(g[15][3]).toBe(0);
        expect(isSealed(g, at(4, 18))).toBe(true);
    });

    it('is true in a one-cell-wide closed gap', () => {
        const g = createGrid();
        for (let r = 15; r <= 19; r++) fillRow(g, r, r === 15 ? [] : [4]);
        expect(isSealed(g, at(4, 18))).toBe(true);
    });

    it('is false when the body centre is above the board', () => {
        expect(isSealed(exampleA(), { x: 4.15, y: -2, vy: 0, onGround: false })).toBe(false);
    });

    it('is false when the body centre cell is solid (not a state play reaches)', () => {
        const g = exampleA();
        g[18][4] = 1;
        expect(isSealed(g, at(4, 18))).toBe(false);
    });

    it('keeps the body centre column inside the board', () => {
        const left = createGrid();
        for (let r = 15; r <= 19; r++) fillRow(left, r, r === 15 ? [] : [0]);
        // x + PLAYER_W / 2 = -0.15 would floor to column -1: it is held to column 0.
        expect(isSealed(left, { x: -0.5, y: 18.1, vy: 0, onGround: true })).toBe(true);
        const right = createGrid();
        for (let r = 15; r <= 19; r++) fillRow(right, r, r === 15 ? [] : [P.COLS - 1]);
        // x + PLAYER_W / 2 = 10.05 would floor to column 10: it is held to the last column.
        expect(isSealed(right, { x: 9.7, y: 18.1, vy: 0, onGround: true })).toBe(true);
    });

    it('does not count a pocket that is open to the sky through row 0', () => {
        const g = createGrid();
        for (let r = 1; r <= 19; r++) fillRow(g, r, [4]);
        expect(isSealed(g, at(4, 18))).toBe(false);
    });
});

describe('pickCrumbleCell', () => {
    it('example A: the left cap cell (4,15) wins the cost-1 tie on the lower column', () => {
        expect(pickCrumbleCell(exampleA(), at(4, 18))).toEqual({ c: 4, r: 15 });
    });

    it('example B: avoids the cell under the feet, so (5,18) crumbles', () => {
        expect(pickCrumbleCell(exampleB(), at(4, 17))).toEqual({ c: 5, r: 18 });
    });

    it('example B: without feet on the floor (airborne) the lower column (4,18) is chosen', () => {
        expect(pickCrumbleCell(exampleB(), at(4, 17, false))).toEqual({ c: 4, r: 18 });
    });

    it('prefers the higher row among equal costs when neither is under the feet', () => {
        const g = createGrid();
        fillRow(g, 16);
        fillRow(g, 17, [4, 5]);
        fillRow(g, 18);
        fillRow(g, 19, [4, 5]); // closed hollow: floor cells cost 1, the roof (row 16, open above) also costs 1
        expect(pickCrumbleCell(g, at(4, 17, false))).toEqual({ c: 4, r: 16 });
    });

    it('avoids every cell under the feet when the body straddles two columns', () => {
        const g = createGrid();
        fillRow(g, 15);
        fillRow(g, 16);
        fillRow(g, 17, [4, 5, 6]);
        fillRow(g, 18);
        fillRow(g, 19, [4, 5, 6]); // a closed hollow under the floor: the floor cells (4..6,18) cost 1 each
        // The body spans x 4.6..5.3: it stands on columns 4 and 5, so only (6,18) is free of the feet.
        expect(pickCrumbleCell(g, at(4, 17, true, 4.6))).toEqual({ c: 6, r: 18 });
        // Held to the single column 4 by mistake, the lower free column (5,18) would be chosen instead.
        expect(pickCrumbleCell(g, at(4, 17, true, 4.15))).toEqual({ c: 5, r: 18 });
    });

    it('does not count a column the body only touches at its right edge (x + PLAYER_W exactly on the boundary)', () => {
        const g = createGrid();
        fillRow(g, 15);
        fillRow(g, 16);
        fillRow(g, 17, [4, 5, 6]);
        fillRow(g, 18);
        fillRow(g, 19, [4, 5, 6]);
        // The body spans x 4.3..5.0: it stands on column 4 only, so (5,18) is free of the feet and the lowest such column.
        expect(4.3 + P.PLAYER_W).toBe(5);
        expect(pickCrumbleCell(g, at(4, 17, true, 4.3))).toEqual({ c: 5, r: 18 });
    });

    it('does not count the column to the left of a body whose left edge is exactly on a column boundary', () => {
        const g = createGrid();
        fillRow(g, 15);
        fillRow(g, 16);
        fillRow(g, 17, [4, 5, 6]);
        fillRow(g, 18);
        fillRow(g, 19, [4, 5, 6]);
        // The body spans x 5.0..5.7: it stands on column 5 only, so the lowest free column is 4.
        expect(pickCrumbleCell(g, at(5, 17, true, 5))).toEqual({ c: 4, r: 18 });
    });

    it('prefers the lower column among equal costs in the same row', () => {
        const g = createGrid();
        fillRow(g, 15);
        fillRow(g, 16);
        fillRow(g, 17, [2, 4, 6]); // the pocket is column 4; columns 2 and 6 are empty and outside it
        fillRow(g, 18);
        fillRow(g, 19);
        // Walls (3,17) and (5,17) both reach an outside empty cell at cost 1.
        expect(pickCrumbleCell(g, at(4, 17))).toEqual({ c: 3, r: 17 });
    });

    it('counts a solid cell in row 0 as one step from the sky', () => {
        const g = createGrid();
        for (let r = 0; r < P.ROWS; r++) fillRow(g, r, r === 10 ? [4] : []);
        // Everything is solid except the pocket cell (4,10): the cheapest way out is straight up, rows 9..0.
        expect(pickCrumbleCell(g, at(4, 10, false))).toEqual({ c: 4, r: 9 });
    });

    it('ignores a solid island that touches only the pocket (no way out through it)', () => {
        const g = createGrid();
        for (let r = 0; r < P.ROWS; r++) fillRow(g, r);
        for (let r = 9; r <= 11; r++) for (let c = 3; c <= 5; c++) g[r][c] = 0;
        g[10][4] = 1; // island inside a ring-shaped pocket
        // Row r of column c is r + 1 steps from the sky; the roof of the ring (3..5, 8) costs 9 and column 3 is the lowest.
        expect(pickCrumbleCell(g, at(3, 10, false))).toEqual({ c: 3, r: 8 });
    });

    it('is null when the climber is not sealed in', () => {
        expect(pickCrumbleCell(createGrid(), at(4, 18))).toBeNull();
    });
});

/** An independent reference: depth-first pocket, Bellman-Ford style costs, then a plain sort of the candidates. */
const reference = (
    g: Grid, c0: number, r0: number, onGround: boolean, x: number,
): { sealed: boolean; cell: { c: number; r: number } | null } => {
    const pocket = new Set<string>();
    const visit = (c: number, r: number): boolean => {
        if (c < 0 || c >= P.COLS || r < 0 || r >= P.ROWS || g[r][c] !== 0 || pocket.has(`${c},${r}`)) return false;
        pocket.add(`${c},${r}`);
        let open = r === 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (visit(c + dc, r + dr)) open = true;
        return open;
    };
    if (visit(c0, r0)) return { sealed: false, cell: null };
    const INF = 1e9;
    const cost = g.map((row, r) => row.map((v, c) => (v === 0 && !pocket.has(`${c},${r}`) ? 0 : INF)));
    for (let changed = true; changed;) {
        changed = false;
        for (let r = 0; r < P.ROWS; r++) {
            for (let c = 0; c < P.COLS; c++) {
                if (g[r][c] === 0) continue;
                let best = r === 0 ? 0 : INF; // the sky above row 0 is "outside" at cost 0
                for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nc = c + dc;
                    const nr = r + dr;
                    if (nc < 0 || nc >= P.COLS || nr < 0 || nr >= P.ROWS || pocket.has(`${nc},${nr}`)) continue;
                    best = Math.min(best, cost[nr][nc]);
                }
                if (best + 1 < cost[r][c]) {
                    cost[r][c] = best + 1;
                    changed = true;
                }
            }
        }
    }
    const candidates: Array<{ c: number; r: number; cost: number; support: number }> = [];
    for (const key of pocket) {
        const [pc, pr] = key.split(',').map(Number);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const c = pc + dc;
            const r = pr + dr;
            if (c < 0 || c >= P.COLS || r < 0 || r >= P.ROWS || g[r][c] === 0 || cost[r][c] >= INF) continue;
            // Under the feet: the row just below the body, in every column the body covers (x .. x + PLAYER_W).
            const under = onGround && r === r0 + 1 && c >= Math.floor(x) && c <= Math.floor(x + P.PLAYER_W - 1e-6);
            candidates.push({ c, r, cost: cost[r][c], support: under ? 1 : 0 });
        }
    }
    candidates.sort((a, b) => a.cost - b.cost || a.support - b.support || a.r - b.r || a.c - b.c);
    return { sealed: true, cell: candidates.length ? { c: candidates[0].c, r: candidates[0].r } : null };
};

const seeded = (seed: number): (() => number) => {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

describe('sealed-in detection and target choice against an independent reference', () => {
    it('agree on 4000 random fields (both sealed and open ones occur)', () => {
        const rnd = seeded(11);
        let sealed = 0;
        let open = 0;
        let withTarget = 0;
        for (let n = 0; n < 4000; n++) {
            const density = 0.5 + rnd() * 0.35;
            const g = createGrid();
            for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) g[r][c] = rnd() < density ? 1 : 0;
            const empties: Array<[number, number]> = [];
            for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) if (g[r][c] === 0) empties.push([c, r]);
            if (empties.length === 0) continue;
            const [c, r] = empties[Math.floor(rnd() * empties.length)];
            const onGround = rnd() < 0.5;
            const x = c - 0.3 + rnd() * 0.9; // the body centre stays in column c; the body may straddle two columns
            const player = at(c, r, onGround, x);
            const want = reference(g, c, r, onGround, x);
            const got = pickCrumbleCell(g, player);
            if (isSealed(g, player) !== want.sealed) expect.fail(`sealed mismatch on field #${n}`);
            if (JSON.stringify(got) !== JSON.stringify(want.cell)) {
                expect.fail(`target mismatch on field #${n}: got ${JSON.stringify(got)}, want ${JSON.stringify(want.cell)}`);
            }
            if (want.sealed) sealed++;
            else open++;
            if (want.cell) withTarget++;
        }
        expect(sealed).toBeGreaterThan(200);
        expect(open).toBeGreaterThan(200);
        expect(withTarget).toBe(sealed);
    });
});

describe('Crumble timing (60 fps)', () => {
    /** Steps a fresh timer `n` frames on example A with the climber inside. */
    const run = (n: number): { crumble: Crumble; grid: Grid } => {
        const crumble = new Crumble();
        const grid = exampleA();
        for (let i = 0; i < n; i++) crumble.step(grid, at(4, 18), DT);
        return { crumble, grid };
    };

    it('shows no warning during the first 59 sealed frames', () => {
        const { crumble } = run(59);
        expect(crumble.target).toBeNull();
        expect(crumble.sealedFor).toBeCloseTo(59 / 60, 9);
    });

    it('starts the warning on the 60th sealed frame, at t = 0 on the chosen cell', () => {
        const { crumble } = run(60);
        expect(crumble.target).toEqual({ c: 4, r: 15, t: 0 });
    });

    it('keeps the cell until the 179th frame and removes it on the 180th', () => {
        const before = run(179);
        expect(before.crumble.target?.t).toBeCloseTo(119 / 60, 9);
        expect(before.grid[15][4]).toBe(1);

        const after = run(180);
        expect(after.grid[15][4]).toBe(0);
        expect(after.crumble.target).toBeNull();
        expect(after.crumble.removed).toBe(1);
        expect(after.crumble.sealedFor).toBe(0);
    });

    it('starts counting again from the frame after the cell vanished while still sealed in (example B)', () => {
        const crumble = new Crumble();
        const grid = exampleB();
        for (let i = 0; i < 180; i++) crumble.step(grid, at(4, 17), DT);
        expect(grid[18][5]).toBe(0); // the vanished cell
        expect(crumble.sealedFor).toBe(0); // the frame it vanished adds nothing
        crumble.step(grid, at(4, 17), DT);
        expect(crumble.sealedFor).toBeCloseTo(DT, 12);
        expect(crumble.target).toBeNull();
        for (let i = 1; i < 60; i++) crumble.step(grid, at(4, 17), DT);
        expect(crumble.target).not.toBeNull(); // next warning on the 60th frame after (the 240th overall)
    });

    it('counts the dt it is given: two 0.5 s steps reach STUCK_TIME, four more remove the cell', () => {
        const crumble = new Crumble();
        const grid = exampleA();
        crumble.step(grid, at(4, 18), 0.5);
        expect(crumble.target).toBeNull();
        crumble.step(grid, at(4, 18), 0.5);
        expect(crumble.target).toEqual({ c: 4, r: 15, t: 0 });
        for (let i = 0; i < 3; i++) crumble.step(grid, at(4, 18), 0.5);
        expect(grid[15][4]).toBe(1);
        crumble.step(grid, at(4, 18), 0.5);
        expect(grid[15][4]).toBe(0);
    });

    it('is not thrown off by float rounding: 80 steps of 0.0125 s sum to just under 1 s, 160 more to just under 2 s', () => {
        let sum = 0;
        for (let i = 0; i < 80; i++) sum += 0.0125;
        expect(sum).toBeLessThan(P.STUCK_TIME); // 0.9999999999999984: the tolerance has to absorb this
        const crumble = new Crumble();
        const grid = exampleA();
        for (let i = 0; i < 79; i++) crumble.step(grid, at(4, 18), 0.0125);
        expect(crumble.target).toBeNull();
        crumble.step(grid, at(4, 18), 0.0125);
        expect(crumble.target).toEqual({ c: 4, r: 15, t: 0 });
        for (let i = 0; i < 159; i++) crumble.step(grid, at(4, 18), 0.0125);
        expect(grid[15][4]).toBe(1);
        crumble.step(grid, at(4, 18), 0.0125); // t sums to 1.999999999999995 here
        expect(grid[15][4]).toBe(0);
    });

    it('cancels the warning and resets the count when the pocket opens, then counts from zero', () => {
        const crumble = new Crumble();
        const grid = exampleA();
        for (let i = 0; i < 100; i++) crumble.step(grid, at(4, 18), DT);
        expect(crumble.target).not.toBeNull();
        grid[15][5] = 0; // another cap cell goes: the pocket now reaches row 0
        crumble.step(grid, at(4, 18), DT);
        expect(crumble.target).toBeNull();
        expect(crumble.sealedFor).toBe(0);
        grid[15][5] = 1; // sealed again
        for (let i = 0; i < 59; i++) crumble.step(grid, at(4, 18), DT);
        expect(crumble.target).toBeNull();
        crumble.step(grid, at(4, 18), DT);
        expect(crumble.target).not.toBeNull();
    });

    it('does nothing while the climber is not sealed in', () => {
        const crumble = new Crumble();
        const grid = createGrid();
        for (let i = 0; i < 300; i++) crumble.step(grid, at(4, 18), DT);
        expect(crumble.target).toBeNull();
        expect(crumble.sealedFor).toBe(0);
        expect(crumble.removed).toBe(0);
    });
});

describe('Crumble.followClears', () => {
    const warned = (): Crumble => {
        const crumble = new Crumble();
        const grid = exampleA();
        for (let i = 0; i < 70; i++) crumble.step(grid, at(4, 18), DT); // target (4,15), t = 10/60
        return crumble;
    };

    it('moves the blinking cell down by the number of cleared rows below it, keeping its time', () => {
        const crumble = warned();
        const t = crumble.target!.t;
        crumble.followClears([17, 18]);
        expect(crumble.target).toEqual({ c: 4, r: 17, t });
    });

    it('leaves the cell where it is when the cleared rows are above it', () => {
        const crumble = warned();
        crumble.followClears([3, 10]);
        expect(crumble.target).toMatchObject({ c: 4, r: 15 });
    });

    it('counts only the rows below it when rows on both sides clear', () => {
        const crumble = warned();
        crumble.followClears([4, 16]);
        expect(crumble.target).toMatchObject({ r: 16 });
    });

    it('drops the warning when its own row clears, and the next step picks a target again at t = 0', () => {
        const crumble = warned();
        crumble.followClears([15]);
        expect(crumble.target).toBeNull();
        expect(crumble.sealedFor).toBeGreaterThanOrEqual(P.STUCK_TIME - 1e-9);
        crumble.step(exampleA(), at(4, 18), DT);
        expect(crumble.target).toEqual({ c: 4, r: 15, t: 0 });
    });

    it('does nothing without a warning', () => {
        const crumble = new Crumble();
        crumble.followClears([15]);
        expect(crumble.target).toBeNull();
    });
});
