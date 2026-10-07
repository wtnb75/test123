import { describe, expect, it } from 'vitest';
import type { Diff } from './generate';
import { judgeClick } from './judge';
import { LayoutKind, hitPanel, layoutFor, toCanvas } from './layout';

const diffs: Diff[] = [
    { kind: 'color', index: 0, x: 10, y: 10, r: 5 },
    { kind: 'missing', index: 3, x: 200, y: 200, r: 30 },
];
const none = new Set<number>();

describe('judgeClick', () => {
    it('returns the index of the difference whose circle contains the point', () => {
        expect(judgeClick(diffs, none, 10, 10)).toBe(0);
        expect(judgeClick(diffs, none, 210, 190)).toBe(1);
    });

    it('counts a point exactly on the circle boundary as a hit (3-4-5 triangle)', () => {
        expect(judgeClick(diffs, none, 13, 14)).toBe(0);
    });

    it('misses just beyond the boundary', () => {
        expect(judgeClick(diffs, none, 13, 14.01)).toBe(-1);
    });

    it('misses where there is no difference', () => {
        expect(judgeClick(diffs, none, 100, 100)).toBe(-1);
    });

    it('skips already found differences', () => {
        expect(judgeClick(diffs, new Set([0]), 10, 10)).toBe(-1);
        expect(judgeClick(diffs, new Set([0]), 200, 200)).toBe(1);
    });

    it('returns -1 when there are no differences', () => {
        expect(judgeClick([], none, 0, 0)).toBe(-1);
    });
});

describe('judging a tap on the enlarged portrait and wide panels (regression: logic coordinates are unchanged)', () => {
    // A known hit circle: centre (100, 100), radius 40, in panel-local units.
    const circle: Diff[] = [{ kind: 'color', index: 0, x: 100, y: 100, r: 40 }];

    const judgeAt = (kind: LayoutKind, panel: number, lx: number, ly: number) => {
        const layout = layoutFor(kind);
        const at = toCanvas(layout, panel, lx, ly);
        const hit = hitPanel(layout, at.x, at.y);
        return hit ? judgeClick(circle, none, hit.x, hit.y) : -2;
    };

    it.each<LayoutKind>(['landscape', 'portrait', 'wide'])('hits at the circle edge on both panels and misses just beyond it (%s)', (kind) => {
        for (const panel of [0, 1]) {
            expect(judgeAt(kind, panel, 140, 100)).toBe(0);
            expect(judgeAt(kind, panel, 140.5, 100)).toBe(-1);
            expect(judgeAt(kind, panel, 100, 60)).toBe(0);
            expect(judgeAt(kind, panel, 100, 59.5)).toBe(-1);
        }
    });

    it('gives the same verdict in every layout for the same panel-local point', () => {
        for (const [lx, ly] of [[100, 100], [139, 100], [141, 100], [130, 125], [0, 0], [400, 400]]) {
            expect(judgeAt('portrait', 1, lx, ly)).toBe(judgeAt('landscape', 1, lx, ly));
            expect(judgeAt('wide', 1, lx, ly)).toBe(judgeAt('landscape', 1, lx, ly));
        }
    });
});
