import { describe, expect, it } from 'vitest';
import {
    BOARD_TOP, computeGameLayout, computeToastPlacement, pickToastFontSize, TOAST_MAX_BOX_HEIGHT, TOAST_PADDING_Y,
    toastBoxWidth
} from './gameLayout';

/** Attempts per digit count (spec: ルール). */
const ROWS_BY_DIGITS: Record<number, number> = { 2: 3, 3: 4, 4: 5, 5: 6, 6: 7 };

const layoutFor = (width: number, height: number, digits: number) =>
    computeGameLayout(width, height, ROWS_BY_DIGITS[digits], digits);

describe('computeGameLayout: portrait key height', () => {
    it('SE (375 x 550) では計算値 35 を持ち上げて 44 になる', () => {
        expect(layoutFor(375, 550, 4).keyboardButtonHeight).toBe(44);
    });

    it('高さが 686 では 44、687 では 45 になる（floor((H × 0.22 − 16) / 3) の境界）', () => {
        expect(layoutFor(400, 686, 4).keyboardButtonHeight).toBe(44);
        expect(layoutFor(400, 687, 4).keyboardButtonHeight).toBe(45);
    });

    it('上限は 54 で、822 でも 823 でも 54 のまま', () => {
        expect(layoutFor(400, 822, 4).keyboardButtonHeight).toBe(54);
        expect(layoutFor(400, 823, 4).keyboardButtonHeight).toBe(54);
        expect(layoutFor(390, 844, 4).keyboardButtonHeight).toBe(54);
    });
});

describe('computeGameLayout: SE (375 x 550) 手計算の値', () => {
    it('N=6（7 行）は隙間 6・セル 41', () => {
        const layout = layoutFor(375, 550, 6);
        expect(layout.boardGap).toBe(6);
        expect(layout.boardCellSize).toBe(41);
    });

    it('N=4（5 行）は隙間 9・セル 58', () => {
        const layout = layoutFor(375, 550, 4);
        expect(layout.boardGap).toBe(9);
        expect(layout.boardCellSize).toBe(58);
    });

    it('キーボード全体は 148 px で、画面の下端から外側の余白 8 px の位置に置く', () => {
        const layout = layoutFor(375, 550, 6);
        expect(layout.keyboardStartY).toBe(550 - 8 - 148);
    });
});

describe('computeGameLayout: 他の画面', () => {
    it('スマホ縦 390 x 844 の N=6 はセル 45・隙間 10（従来と同じ）', () => {
        const layout = layoutFor(390, 844, 6);
        expect(layout.boardCellSize).toBe(45);
        expect(layout.boardGap).toBe(10);
    });

    it('横長 667 x 310 の N=4 は右ドックで、キー高さ 36・セル 42・隙間 6（従来と同じ）', () => {
        const layout = layoutFor(667, 310, 4);
        expect(layout.keyboardDock).toBe('right');
        expect(layout.keyboardButtonHeight).toBe(36);
        expect(layout.boardCellSize).toBe(42);
        expect(layout.boardGap).toBe(6);
        expect(layout.keyboardStartX).toBe(514);
        expect(layout.keyboardStartY).toBe(72);
    });

    it('横長 1280 x 720 の N=4 は右ドックで、キー高さ 64・セル 92・キーボードの位置 (1046, 148)（従来と同じ）', () => {
        const layout = layoutFor(1280, 720, 4);
        expect(layout.keyboardButtonHeight).toBe(64);
        expect(layout.boardCellSize).toBe(92);
        expect(layout.keyboardStartX).toBe(1046);
        expect(layout.keyboardStartY).toBe(148);
    });

    it('縦向きの題名は左の幅の中央・画面の縦の中央に置く（SE: x = 8 + 18、y = 275）', () => {
        const layout = layoutFor(375, 550, 4);
        expect(layout.leftTitleX).toBe(26);
        expect(layout.leftTitleY).toBe(275);
    });
});

describe('computeGameLayout: キーボードの置き場所', () => {
    it('高さが幅より大きいときだけ下ドック、同じ（正方形）なら右ドック', () => {
        expect(layoutFor(500, 501, 4).keyboardDock).toBe('bottom');
        expect(layoutFor(500, 500, 4).keyboardDock).toBe('right');
    });
});

describe('computeGameLayout: 縦長では全ての行がキーボードより上に見える', () => {
    const screens: Array<[number, number]> = [[375, 550], [390, 844], [360, 640]];

    for (const [width, height] of screens) {
        for (const digits of [2, 3, 4, 5, 6]) {
            it(`${width} x ${height} の N=${digits} は盤面が通知の帯の下からキーボードの上までに収まる`, () => {
                const layout = layoutFor(width, height, digits);
                expect(layout.boardStartY).toBeGreaterThanOrEqual(BOARD_TOP);
                expect(layout.boardStartY + layout.boardHeight).toBeLessThanOrEqual(layout.keyboardStartY);
            });
        }
    }
});

describe('computeGameLayout: 全ての画面で盤面とキーボードは通知の帯（y 0〜60）の下から始まる', () => {
    const screens: Array<[number, number]> = [[375, 550], [390, 844], [667, 310], [1280, 720]];

    for (const [width, height] of screens) {
        for (const digits of [2, 3, 4, 5, 6]) {
            it(`${width} x ${height} の N=${digits}`, () => {
                const layout = layoutFor(width, height, digits);
                expect(layout.boardStartY).toBeGreaterThanOrEqual(60);
                expect(layout.keyboardStartY).toBeGreaterThanOrEqual(60);
            });
        }
    }

    it('SE (375 x 550) の N=4 は盤面を左の題名と右端の余白の間で水平に中央寄せする', () => {
        // board width 4 * 58 + 3 * 9 = 259; area 51..360 (width 309); start x = 51 + floor((309 - 259) / 2) = 76
        const layout = layoutFor(375, 550, 4);
        expect(layout.boardWidth).toBe(259);
        expect(layout.boardStartX).toBe(76);
        expect(layout.boardCenterX).toBe(76 + 259 / 2);
    });
});

describe('computeToastPlacement', () => {
    it('文字の折り返し幅は最大幅から横の余白 14 × 2 を引いた値（SE は 234）', () => {
        for (const width of [320, 375, 390, 667, 1280]) {
            const { textWidth, maxBoxWidth } = computeToastPlacement(width);
            expect(textWidth + 2 * 14).toBe(maxBoxWidth);
        }
        expect(computeToastPlacement(375).textWidth).toBe(234);
    });

    it('SE (375) では中心 (187, 30)・背景の最大幅 262（W − 112 = 263 を偶数に切り下げ）', () => {
        expect(computeToastPlacement(375)).toMatchObject({ centerX: 187, centerY: 30, maxBoxWidth: 262 });
    });

    it('背景の最大幅は偶数で、両端が整数の x で 🏠 / ◀️ の外側の端（x = 56 と W − 56）の内側に収まる', () => {
        for (const width of [320, 375, 390, 667, 1280]) {
            const { centerX, maxBoxWidth } = computeToastPlacement(width);
            expect(maxBoxWidth % 2).toBe(0);
            expect(centerX - maxBoxWidth / 2).toBeGreaterThanOrEqual(56);
            expect(centerX + maxBoxWidth / 2).toBeLessThanOrEqual(width - 56);
        }
    });

    it('帯の中央に置いた最大の高さ 58 px は、盤面の上端 60 px より上に収まる', () => {
        const { centerY } = computeToastPlacement(375);
        expect(centerY - TOAST_MAX_BOX_HEIGHT / 2).toBeGreaterThanOrEqual(0);
        expect(centerY + TOAST_MAX_BOX_HEIGHT / 2).toBeLessThanOrEqual(BOARD_TOP);
    });

    it('極端に狭い幅でも、折り返し幅は 1 文字分（20）以上、背景の最大幅は 2 以上になる', () => {
        const placement = computeToastPlacement(50);
        expect(placement.textWidth).toBe(20);
        expect(placement.maxBoxWidth).toBe(2);
    });
});

describe('toastBoxWidth', () => {
    it('文字の幅 + 横の余白 28 を偶数に切り上げる（文字 100 → 128、文字 101 → 130）', () => {
        expect(toastBoxWidth(100, 262)).toBe(128);
        expect(toastBoxWidth(101, 262)).toBe(130);
        expect(toastBoxWidth(100.4, 262)).toBe(130);
    });

    it('最大幅を超えない（文字 234 → 262、文字 300 → 262）', () => {
        expect(toastBoxWidth(234, 262)).toBe(262);
        expect(toastBoxWidth(300, 262)).toBe(262);
    });
});

describe('pickToastFontSize', () => {
    it('背景の高さが 58 px 以下なら 16 px のまま', () => {
        expect(pickToastFontSize(() => 58)).toBe(16);
    });

    it('16 px で 59 px になるときは 1 px 小さくする（15 px で 58 px なら 15）', () => {
        expect(pickToastFontSize((size) => (size === 16 ? 59 : 58))).toBe(15);
    });

    it('文字の高さに比例するときは、収まる最大の大きさを選ぶ', () => {
        // 3 lines of `size` plus the padding: 56 px at 16 px, so it fits as is
        expect(pickToastFontSize((s) => 3 * s + TOAST_PADDING_Y * 2)).toBe(16);
        // 4 lines of `size`: 56 px only at 14 px
        expect(pickToastFontSize((s) => 4 * s)).toBe(14);
    });

    it('どれだけ高くても 12 px で止まり、それより小さいサイズでは測らない', () => {
        const measured: number[] = [];
        const size = pickToastFontSize((s) => {
            measured.push(s);
            return 200;
        });
        expect(size).toBe(12);
        expect(Math.min(...measured)).toBe(13);
    });
});
