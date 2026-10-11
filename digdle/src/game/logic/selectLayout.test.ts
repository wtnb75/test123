import { describe, expect, it } from 'vitest';
import {
    computeSelectLayout,
    DIGIT_OPTIONS,
    digitFromKey,
    isDigitOption,
    modeFromData,
    TITLE_NARROW_WIDTH
} from './selectLayout';

const digitRects = (width: number, height: number) =>
    computeSelectLayout(width, height).digitButtons.map(({ digit, rect }) => [digit, rect.x, rect.y]);

describe('computeSelectLayout: wide screen (1024 x 768)', () => {
    const layout = computeSelectLayout(1024, 768);

    it('名前・副題・ヒントの縦位置は 115 / 173 / 215（floor(768 x 0.15) = 115 から 58・42 ずつ下）', () => {
        expect([layout.nameY, layout.subtitleY, layout.hintY]).toEqual([115, 173, 215]);
    });

    it('モード切替は 130 x 44 の 2 ボタンで、隙間 16 のまま水平中央に並ぶ（左がノーマル、右がハード）', () => {
        expect(layout.modeButtons.normal).toEqual({ x: 374, y: 267, width: 130, height: 44 });
        expect(layout.modeButtons.hard).toEqual({ x: 520, y: 267, width: 130, height: 44 });
        expect(layout.modeButtons.hard.y).toBe(layout.modeButtons.normal.y);
    });

    it('桁数ボタンは 100 x 64・隙間 16 の 1 行で、左から 2・3・4・5・6、水平中央（564 px 幅）に並ぶ', () => {
        expect(layout.narrow).toBe(false);
        expect(digitRects(1024, 768)).toEqual([
            [2, 230, 339],
            [3, 346, 339],
            [4, 462, 339],
            [5, 578, 339],
            [6, 694, 339]
        ]);
        expect(layout.digitButtons.every(({ rect }) => rect.width === 100 && rect.height === 64)).toBe(true);
    });
});

describe('computeSelectLayout: narrow screen (390 x 844)', () => {
    const layout = computeSelectLayout(390, 844);

    it('縦位置は floor(844 x 0.15) = 126 から 58・42・52 ずつ下がる', () => {
        expect([layout.nameY, layout.subtitleY, layout.hintY, layout.modeButtons.normal.y]).toEqual([126, 184, 226, 278]);
    });

    it('桁数ボタンは 90 x 64・隙間 12 の 3 + 2 の格子で、3 列分（294 px）を水平中央に置き、2 行目は 1 行目の左端に揃う', () => {
        expect(layout.narrow).toBe(true);
        expect(digitRects(390, 844)).toEqual([
            [2, 48, 350],
            [3, 150, 350],
            [4, 252, 350],
            [5, 48, 426],
            [6, 150, 426]
        ]);
        expect(layout.digitButtons.every(({ rect }) => rect.width === 90 && rect.height === 64)).toBe(true);
    });

    it('モード切替の位置は幅だけで決まる（左端 57、右端 203）', () => {
        expect([layout.modeButtons.normal.x, layout.modeButtons.hard.x]).toEqual([57, 203]);
    });
});

describe('computeSelectLayout: boundaries', () => {
    it('幅 559 は narrow（3 + 2）、560 は 1 行', () => {
        expect(TITLE_NARROW_WIDTH).toBe(560);
        expect(computeSelectLayout(559, 800).narrow).toBe(true);
        expect(computeSelectLayout(560, 800).narrow).toBe(false);
    });

    it('幅 559 では 2 行目（5・6）が 1 行目より 76 px 下にある（高さ 64 + 隙間 12）', () => {
        const rects = computeSelectLayout(559, 800).digitButtons.map(({ rect }) => rect);
        expect(rects[3].y - rects[0].y).toBe(76);
        expect(rects[0].y).toBe(rects[2].y);
    });

    it('幅 560 では 1 行の幅 564 が画面より 4 px 広く、左端は -2 になる（縮小しない）', () => {
        const rects = computeSelectLayout(560, 800).digitButtons.map(({ rect }) => rect);
        expect(rects[0].x).toBe(-2);
        expect(rects[4].x + rects[4].width).toBe(562);
    });

    it('名前の縦位置は 72 を下限とし、高さ 400 では floor(60) でなく 72 になる', () => {
        expect(computeSelectLayout(800, 400).nameY).toBe(72);
        expect(computeSelectLayout(800, 600).nameY).toBe(90);
    });

    it('高さが足りなくても縮小せず、ボタンは画面の外へはみ出す（高さ 400・narrow の 2 行目は 436）', () => {
        const rects = computeSelectLayout(390, 400).digitButtons.map(({ rect }) => rect);
        expect(rects[3].y + rects[3].height).toBe(436);
    });
});

describe('digitFromKey', () => {
    it('キー 2〜6 は対応する桁数になる', () => {
        expect(['2', '3', '4', '5', '6'].map(digitFromKey)).toEqual([2, 3, 4, 5, 6]);
    });

    it('キー 0・1・7・8・9 は開始しない', () => {
        expect(['0', '1', '7', '8', '9'].map(digitFromKey)).toEqual([null, null, null, null, null]);
    });

    it('数字以外のキー（Enter・Backspace・文字・複数桁・空文字）は開始しない', () => {
        expect(['Enter', 'Backspace', 'a', '22', ''].map(digitFromKey)).toEqual([null, null, null, null, null]);
    });

    it('数として 2〜6 に読める文字列（"2.0"・"3 "・"4e0"）でも、1 文字の数字キーでなければ開始しない', () => {
        expect(['2.0', '3 ', '4e0'].map(digitFromKey)).toEqual([null, null, null]);
    });
});

describe('isDigitOption', () => {
    it('2〜6 の整数だけを選べる桁数として認める', () => {
        expect(DIGIT_OPTIONS).toEqual([2, 3, 4, 5, 6]);
        expect([1, 2, 3, 4, 5, 6, 7].filter(isDigitOption)).toEqual([2, 3, 4, 5, 6]);
    });

    it('文字列・小数・null・undefined は認めない', () => {
        expect(['3', 2.5, null, undefined, NaN].some(isDigitOption)).toBe(false);
    });
});

describe('modeFromData', () => {
    it('データが無い・mode が無い・hard 以外のときはノーマルになる', () => {
        expect([undefined, {}, { mode: 'x' }, { mode: 'normal' }, { mode: null }].map(modeFromData)).toEqual([
            'normal', 'normal', 'normal', 'normal', 'normal'
        ]);
    });

    it('mode が hard のときだけハードになる', () => {
        expect(modeFromData({ mode: 'hard' })).toBe('hard');
    });
});
