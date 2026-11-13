import { describe, expect, it } from 'vitest';
import { HELP_LINES, HINT_LINES, hudText, resultInputOpen, resultLayout, resultTexts, titleLayout } from './layout';

describe('titleLayout (centre y; H = 528 example from the spec)', () => {
    it('places the name, sub, stage, 5 help lines 24 apart, and START 130 from the bottom', () => {
        const l = titleLayout(528);
        expect([l.nameY, l.subY, l.stageY]).toEqual([100, 140, 170]);
        expect([0, 1, 2, 3, 4].map(l.helpY)).toEqual([218, 242, 266, 290, 314]);
        expect(l.buttonY).toBe(398);
    });

    it('keeps START in the bottom third and below the last help line (H = 520 and 528)', () => {
        for (const h of [520, 528, 779]) {
            const l = titleLayout(h);
            expect(l.buttonY - 28).toBeGreaterThanOrEqual((2 * h) / 3);
            expect(l.buttonY - 28).toBeGreaterThan(l.helpY(4) + 7);
        }
        expect(titleLayout(520).buttonY).toBe(390);
    });
});

describe('best row layout (docs/spec.md Title / Result)', () => {
    it('puts the Title best row 26 px above START top: 344 / 595 / 336 for H = 528 / 779 / 520', () => {
        expect(titleLayout(528).bestY).toBe(344);
        expect(titleLayout(779).bestY).toBe(595);
        expect(titleLayout(520).bestY).toBe(336);
    });

    it('keeps the Title best row (16 px text, ±10) clear of the last help line and START, also at H = 520', () => {
        for (const h of [520, 528, 779]) {
            const l = titleLayout(h);
            expect(l.bestY - 10).toBeGreaterThan(l.helpY(4) + 9);
            expect(l.bestY + 10).toBeLessThan(l.buttonY - 28);
        }
    });

    it('puts the Result best row at 272 and 60 px or more above the retry button top (H = 520, 528, 779)', () => {
        for (const h of [520, 528, 779]) {
            const l = resultLayout(h);
            expect(l.bestY).toBe(272);
            expect(l.retryY - 28 - (l.bestY + 11)).toBeGreaterThanOrEqual(60);
            expect(l.bestY - 11).toBeGreaterThan(l.heightY + 11);
        }
    });
});

describe('resultLayout (H = 528 example from the spec)', () => {
    it('places the texts and the two buttons', () => {
        const l = resultLayout(528);
        expect([l.stageY, l.titleY, l.reasonY, l.heightY]).toEqual([100, 146, 196, 232]);
        expect([l.retryY, l.titleButtonY]).toEqual([388, 458]);
    });

    it('leaves 14 px between the buttons and keeps them inside the screen, also at H = 520', () => {
        for (const h of [520, 528, 779]) {
            const l = resultLayout(h);
            expect(l.titleButtonY - 28 - (l.retryY + 28)).toBe(14);
            expect(l.titleButtonY + 28).toBeLessThan(h);
            expect(l.retryY - 28).toBeGreaterThan(l.heightY + 9);
        }
    });
});

describe('texts', () => {
    it('shows the help in 5 lines and the hint in 2', () => {
        expect(HELP_LINES).toEqual([
            '左右にスワイプして動く',
            'タップでジャンプ',
            '空中でタップすると足場ができる',
            '弾をよけて、200 m 上のゴールをめざそう',
            'PC: ← → で移動、Space でジャンプ・足場',
        ]);
        expect(HINT_LINES).toEqual(['左右にスワイプで移動', 'タップ: ジャンプ ／ 空中で足場']);
    });

    it('builds the HUD text against the goal height', () => {
        expect(hudText(0)).toBe('0 / 200 m');
        expect(hudText(137)).toBe('137 / 200 m');
    });

    it('builds the Result texts for each outcome', () => {
        expect(resultTexts('clear', 200)).toEqual({
            title: 'クリア！',
            reason: 'ゴールにとうたつ！',
            height: '高さ 200 / 200 m',
        });
        expect(resultTexts('hit', 137)).toEqual({
            title: 'ゲームオーバー',
            reason: '弾に当たった',
            height: '高さ 137 / 200 m',
        });
        expect(resultTexts('left-behind', 12)).toEqual({
            title: 'ゲームオーバー',
            reason: '下に取り残された',
            height: '高さ 12 / 200 m',
        });
    });
});

describe('resultInputOpen (guard of 500 ms)', () => {
    it('is closed before 500 ms and open from exactly 500 ms', () => {
        expect(resultInputOpen(0)).toBe(false);
        expect(resultInputOpen(499)).toBe(false);
        expect(resultInputOpen(500)).toBe(true);
    });
});
