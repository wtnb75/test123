import { describe, expect, it } from 'vitest';
import {
    clearHeading, fitFontSize, FIRST_STAGE, HEADING_MAX_SIZE, HEADING_MAX_WIDTH, HEADING_MIN_SIZE, hudText,
    resultPrompt, stageAfter, type StageStart,
} from './stage';

describe('stageAfter (docs/spec/stages.md "ステージ番号の持ち方")', () => {
    it('starts at stage 1 from the Title whatever stage was being played', () => {
        expect(FIRST_STAGE).toBe(1);
        expect(stageAfter('start', 1)).toBe(1);
        expect(stageAfter('start', 7)).toBe(1);
    });

    it('goes on to stage n + 1 after a clear: 1 -> 2, 2 -> 3, 998 -> 999', () => {
        expect(stageAfter('next', 1)).toBe(2);
        expect(stageAfter('next', 2)).toBe(3);
        expect(stageAfter('next', 998)).toBe(999);
    });

    it('keeps the stage for "again" (a retry after a loss, or R after a clear), at stage 1 and at stage 5', () => {
        expect(stageAfter('again', 1)).toBe(1);
        expect(stageAfter('again', 5)).toBe(5);
    });

    it('forgets the stage when going back to the Title', () => {
        expect(stageAfter('title', 12)).toBe(1);
    });

    it('walks a whole session: START, clear, clear, lose and retry, back to the Title, START', () => {
        const path: [StageStart, number][] = [
            ['start', 1], ['next', 2], ['next', 3], ['again', 3], ['again', 3], ['title', 1], ['start', 1],
        ];
        let stage = 1;
        for (const [how, expected] of path) {
            stage = stageAfter(how, stage);
            expect(stage).toBe(expected);
        }
    });
});

describe('texts (docs/spec/stages.md テスト観点)', () => {
    it('builds the HUD line with the stage, a full-width space and the height', () => {
        expect(hudText(1, 0, 15)).toBe('ステージ 1　高さ 0 / 15');
        expect(hudText(12, 7, 15)).toBe('ステージ 12　高さ 7 / 15');
    });

    it('builds the demo HUD without a stage', () => {
        expect(hudText(null, 7, 15)).toBe('高さ 7 / 15');
    });

    it('builds the cleared heading with the stage that was cleared', () => {
        expect(clearHeading(1)).toBe('ステージ 1 クリア！');
        expect(clearHeading(12)).toBe('ステージ 12 クリア！');
    });

    it('prompts for the next stage after a clear and keeps the retry prompt after a loss', () => {
        expect(resultPrompt(true)).toBe('タップ / スペースで次のステージへ');
        expect(resultPrompt(false)).toBe('タップ / R / スペースでリトライ');
    });
});

describe('fitFontSize (the cleared heading must fit 340 px, 18.3 to 40 px)', () => {
    // Independent model of Phaser's text width: full-width glyphs are 1 em, digits and the space 0.55 em.
    const widthOf = (text: string) => (size: number) => {
        let em = 0;
        for (const ch of text) em += /[0-9 ]/.test(ch) ? 0.55 : 1;
        return em * size;
    };
    // Brute force written separately from the implementation: scan every whole size upwards.
    const oracle = (measure: (s: number) => number): number => {
        let best = HEADING_MIN_SIZE;
        for (let s = 19; s <= HEADING_MAX_SIZE; s++) if (measure(s) <= HEADING_MAX_WIDTH) best = s;
        return best;
    };

    it('has the numbers the spec states', () => {
        expect(HEADING_MAX_SIZE).toBe(40);
        expect(HEADING_MIN_SIZE).toBe(18.3);
        expect(HEADING_MAX_WIDTH).toBe(340);
    });

    it('shrinks "ステージ 1 クリア！" below 40 px, because it is wider than 340 px there', () => {
        const measure = widthOf(clearHeading(1));
        expect(measure(40)).toBeGreaterThan(HEADING_MAX_WIDTH);
        const size = fitFontSize(measure, HEADING_MAX_WIDTH);
        expect(size).toBeLessThan(40);
        expect(measure(size)).toBeLessThanOrEqual(HEADING_MAX_WIDTH);
        expect(measure(size + 1)).toBeGreaterThan(HEADING_MAX_WIDTH);
    });

    it('fits stages 1, 99 and 999 within 340 px and never under the 18.3 px floor', () => {
        for (const stage of [1, 9, 10, 99, 100, 999]) {
            const measure = widthOf(clearHeading(stage));
            const size = fitFontSize(measure, HEADING_MAX_WIDTH);
            expect(size).toBeGreaterThanOrEqual(HEADING_MIN_SIZE);
            expect(size).toBeLessThanOrEqual(HEADING_MAX_SIZE);
            expect(measure(size)).toBeLessThanOrEqual(HEADING_MAX_WIDTH);
        }
    });

    it('agrees with the brute-force oracle for many text widths, and exercises both the shrinking and the floor', () => {
        let shrunk = 0;
        let atFloor = 0;
        for (let em = 4; em <= 40; em += 0.5) {
            const measure = (s: number) => em * s;
            const size = fitFontSize(measure, HEADING_MAX_WIDTH);
            if (size !== oracle(measure)) expect.fail(`em ${em}: ${size} != ${oracle(measure)}`);
            if (size < HEADING_MAX_SIZE) shrunk++;
            if (size === HEADING_MIN_SIZE) atFloor++;
        }
        expect(shrunk).toBeGreaterThan(0);
        expect(atFloor).toBeGreaterThan(0);
    });

    it('returns the largest size when the text already fits, and the floor when nothing fits', () => {
        expect(fitFontSize(() => 100, 340)).toBe(40);
        expect(fitFontSize(() => 1000, 340)).toBe(HEADING_MIN_SIZE);
    });

    it('accepts the width exactly equal to the limit', () => {
        expect(fitFontSize((s) => (s === 33 ? 340 : s < 33 ? 100 : 400), 340)).toBe(33);
    });
});
