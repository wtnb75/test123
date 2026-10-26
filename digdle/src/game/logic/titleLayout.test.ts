import { describe, expect, it } from 'vitest';
import { computeTitleLayout } from './titleLayout';

/** The numbers a spec table lists for a screen: arrangement, name y, mode top, digit top, digit width, demo. */
const summary = (width: number, height: number) => {
    const layout = computeTitleLayout(width, height);

    return {
        arrangement: layout.arrangement,
        nameY: layout.name.y,
        modeTop: layout.modeButtons.normal.y,
        digitTop: layout.digitButtons[0].rect.y,
        digitW: layout.digitButtons[0].rect.width,
        demo: layout.demo
    };
};

describe('computeTitleLayout: stacked', () => {
    it('iPhone SE 縦 375 x 550: y0 = 27 で、名前 71・モード 111・桁数 167・デモの上端 235（盤面 194 x 244、左 90）', () => {
        expect(summary(375, 550)).toEqual({
            arrangement: 'stacked',
            nameY: 71,
            modeTop: 111,
            digitTop: 167,
            digitW: 64,
            demo: { cell: 44, gap: 6, left: 90, top: 235, width: 194, height: 244 }
        });
    });

    it('375 x 550 のモード切替は 78 x 40・隙間 8 の 3 ボタンで左端 62・148・234（右端 312）、桁数ボタンは 64 x 52・隙間 8 で左端 11 から並ぶ', () => {
        const layout = computeTitleLayout(375, 550);
        expect(layout.name).toEqual({ x: 187, y: 71 });
        expect(layout.modeButtons.normal).toEqual({ x: 36, y: 111, width: 78, height: 40 });
        expect(layout.modeButtons.hard).toEqual({ x: 122, y: 111, width: 78, height: 40 });
        expect(layout.modeButtons.daily).toEqual({ x: 208, y: 111, width: 78, height: 40 });
        expect(layout.digitButtons.map(({ digit, rect }) => [digit, rect.x])).toEqual([
            [2, 11], [3, 83], [4, 155], [5, 227], [6, 299]
        ]);
        expect(layout.digitButtons.every(({ rect }) => rect.y === 167 && rect.width === 64 && rect.height === 52)).toBe(true);
    });

    it('390 x 844: y0 = 125 で、名前 169・モード 209・桁数 265・デモの上端 333（左 98）', () => {
        expect(summary(390, 844)).toEqual({
            arrangement: 'stacked',
            nameY: 169,
            modeTop: 209,
            digitTop: 265,
            digitW: 64,
            demo: { cell: 44, gap: 6, left: 98, top: 333, width: 194, height: 244 }
        });
    });

    it('1280 x 720: y0 = 84 で、名前 128・モード 168・桁数 224・デモ (543, 292)', () => {
        expect(summary(1280, 720)).toEqual({
            arrangement: 'stacked',
            nameY: 128,
            modeTop: 168,
            digitTop: 224,
            digitW: 64,
            demo: { cell: 44, gap: 6, left: 543, top: 292, width: 194, height: 244 }
        });
    });

    it('高さ 388 はセル 28 の縦並びでちょうど入り、y0 = 0（デモの上端 208）', () => {
        expect(summary(1280, 388)).toEqual({
            arrangement: 'stacked',
            nameY: 44,
            modeTop: 84,
            digitTop: 140,
            digitW: 64,
            demo: { cell: 28, gap: 6, left: 575, top: 208, width: 130, height: 164 }
        });
    });

    it('y0 は 3 で割った切り捨て（375 x 551 の y0 = floor(83 / 3) = 27）、奇数の幅の左端も切り捨て（391 x 844 の盤面の左 98、中心 x 195 のモードの左 floor(195 − 151) = 44）', () => {
        expect(computeTitleLayout(375, 551).name.y).toBe(71);

        const wide = computeTitleLayout(391, 844);
        expect(wide.demo?.left).toBe(98);
        expect(wide.modeButtons.normal.x).toBe(44);
    });

    it('桁数ボタンの幅は列の幅に合わせて縮み（幅 320 は floor((320 − 48) / 5) = 54）、64 を超えない', () => {
        expect(summary(320, 700).digitW).toBe(54);
        expect(summary(1280, 700).digitW).toBe(64);
    });

    it('極端に狭い幅でも、桁数ボタンの幅は最低 1 px（幅 40 は floor((40 − 48) / 5) が負）', () => {
        expect(summary(40, 700).digitW).toBe(1);
    });
});

describe('computeTitleLayout: two columns', () => {
    it('高さ 387 は縦並びのセルが 27 で入らず、2 列になる（左の列の中心 x 320、右にデモ (863, 71)）', () => {
        const layout = computeTitleLayout(1280, 387);
        expect(summary(1280, 387)).toEqual({
            arrangement: 'columns',
            nameY: 130,
            modeTop: 170,
            digitTop: 226,
            digitW: 64,
            demo: { cell: 44, gap: 6, left: 863, top: 71, width: 194, height: 244 }
        });
        expect(layout.name.x).toBe(320);
        expect(layout.modeButtons.normal.x).toBe(169);
    });

    it('iPhone SE 横を想定した 667 x 310: 左の列の中心 x 166、名前 92・モード 132・桁数 188、桁数ボタンの幅 53、デモ (403, 33)', () => {
        const layout = computeTitleLayout(667, 310);
        expect(summary(667, 310)).toEqual({
            arrangement: 'columns',
            nameY: 92,
            modeTop: 132,
            digitTop: 188,
            digitW: 53,
            demo: { cell: 44, gap: 6, left: 403, top: 33, width: 194, height: 244 }
        });
        expect(layout.name.x).toBe(166);
        expect(layout.digitButtons[0].rect.x).toBe(17);
        expect([layout.modeButtons.normal.x, layout.modeButtons.hard.x, layout.modeButtons.daily.x]).toEqual([15, 101, 187]);
    });

    it('2 列のセルは高さ 196 で 28（表示）、195 で 27（デモなし）', () => {
        expect(computeTitleLayout(1280, 196).demo).toEqual({ cell: 28, gap: 6, left: 895, top: 16, width: 130, height: 164 });
        expect(computeTitleLayout(1280, 196).arrangement).toBe('columns');
        expect(computeTitleLayout(1280, 195).demo).toBeNull();
    });

    it('2 列にするには桁数ボタンの幅が 40 以上（幅 528 は 40 で 2 列、527 は 39 で入らない）', () => {
        expect(computeTitleLayout(528, 300).arrangement).toBe('columns');
        expect(computeTitleLayout(528, 300).demo).not.toBeNull();
        expect(computeTitleLayout(527, 300).demo).toBeNull();
    });
});

describe('computeTitleLayout: without the demo', () => {
    it('360 x 300 は縦並びでセルも 2 列の桁数ボタンの幅も足りず、デモなし（y0 = 30、名前 74・モード 114・桁数 170、桁数ボタンの幅 62）', () => {
        expect(summary(360, 300)).toEqual({
            arrangement: 'stacked',
            nameY: 74,
            modeTop: 114,
            digitTop: 170,
            digitW: 62,
            demo: null
        });
    });

    it('高さ 192 以上ならデモなしでも縦並び（1280 x 195 は y0 = floor((195 − 208) / 3) が負なので 0）', () => {
        expect(summary(1280, 195)).toMatchObject({ arrangement: 'stacked', nameY: 44, demo: null });
        expect(summary(1280, 192).arrangement).toBe('stacked');
    });

    it('高さ 192 未満は桁数ボタンが切れる縦並びをやめ、デモなしの 2 列にする（667 x 190: 名前 32・モード 72・桁数 128）', () => {
        expect(summary(667, 190)).toEqual({
            arrangement: 'columns',
            nameY: 32,
            modeTop: 72,
            digitTop: 128,
            digitW: 53,
            demo: null
        });
        expect(summary(1280, 191).arrangement).toBe('columns');
    });
});

describe('computeTitleLayout: low and narrow screens', () => {
    it('高さ 180 でも幅 503 は縦並び（2 列の境界は 504 の固定値）、504 は 2 列で、モードの左端 8・72・136（幅 56、右端 192）', () => {
        expect(summary(503, 180)).toMatchObject({ arrangement: 'stacked', nameY: 44, demo: null });
        const narrowest = computeTitleLayout(504, 180).modeButtons;
        expect([narrowest.normal.x, narrowest.hard.x, narrowest.daily.x]).toEqual([8, 72, 136]);
        expect(narrowest.daily.x + narrowest.daily.width).toBe(192);
        expect(summary(504, 180)).toMatchObject({ arrangement: 'columns', nameY: 27, modeTop: 67, digitTop: 123, demo: null });
    });

    it('高さ 170 未満でも、2 列の左の塊の上端は画面の上（0）より上に出ない（1280 x 100 の名前は 22）', () => {
        expect(summary(1280, 100)).toMatchObject({ arrangement: 'columns', nameY: 22, modeTop: 62, digitTop: 118, demo: null });
    });
});
