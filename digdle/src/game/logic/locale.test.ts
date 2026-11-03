import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLocale, translate, validationMessage, type TextKey } from './locale';

const KEYS: TextKey[] = ['clear', 'gameOver', 'reselectDigits', 'checkInput', 'normalMode', 'hardMode', 'dailyMode'];

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('detectLocale', () => {
    it('ブラウザの言語が ja で始まれば日本語（大文字・地域つきでも）', () => {
        const results = ['ja', 'ja-JP', 'JA', 'Ja-jp'].map((language) => {
            vi.stubGlobal('navigator', { language });
            return detectLocale();
        });
        expect(results).toEqual(['ja', 'ja', 'ja', 'ja']);
    });

    it('それ以外の言語（en-US・fr・zh-CN）は英語', () => {
        const results = ['en-US', 'fr', 'zh-CN', 'jv'].map((language) => {
            vi.stubGlobal('navigator', { language });
            return detectLocale();
        });
        expect(results).toEqual(['en', 'en', 'en', 'en']);
    });

    it('navigator が無い環境では日本語として扱う', () => {
        vi.stubGlobal('navigator', undefined);
        expect(detectLocale()).toBe('ja');
    });
});

describe('translate: stats texts', () => {
    it('gives the empty, clear and confirm texts in Japanese (the confirm text breaks after 押すと)', () => {
        expect(translate('ja', 'statsEmpty')).toBe('戦績は空です');
        expect(translate('ja', 'statsClear')).toBe('戦績を消す');
        expect(translate('ja', 'statsClearConfirm')).toBe('もう 1 回押すと\nすべて消えます');
    });

    it('gives the empty, clear and confirm texts in English', () => {
        expect(translate('en', 'statsEmpty')).toBe('No stats');
        expect(translate('en', 'statsClear')).toBe('Clear stats');
        expect(translate('en', 'statsClearConfirm')).toBe('Press again to erase all');
    });
});

describe('validationMessage: 通知の文は理由のコードから作られ、表の文と 1 字も違わない', () => {
    it('桁数不一致: 日本語は N のまま、英語はラウンドの桁数、桁数が無ければ一般文', () => {
        const reason = { code: 'length' } as const;
        expect(validationMessage('ja', reason, 4)).toBe('N桁の数字を入力してください');
        expect(validationMessage('ja', reason)).toBe('N桁の数字を入力してください');
        expect(validationMessage('en', reason, 4)).toBe('Enter a 4-digit number');
        expect(validationMessage('en', reason)).toBe('Enter the required number of digits');
    });

    it('非素数: 分解があれば括弧で続け、無ければ文だけ', () => {
        const withFactors = { code: 'not-prime', factorization: '15 = 3 x 5' } as const;
        expect(validationMessage('ja', withFactors, 2)).toBe('素数を入力してください (15 = 3 x 5)');
        expect(validationMessage('en', withFactors, 2)).toBe('Enter a prime number (15 = 3 x 5)');
        expect(validationMessage('ja', { code: 'not-prime' }, 2)).toBe('素数を入力してください');
        expect(validationMessage('en', { code: 'not-prime' }, 2)).toBe('Enter a prime number');
    });

    it('ハードモード: 位置固定と数字包含の文', () => {
        expect(validationMessage('ja', { code: 'hard-green' }, 4)).toBe('ハードモード: 確定した位置の数字を変えられません');
        expect(validationMessage('en', { code: 'hard-green' }, 4)).toBe('Hard mode: confirmed digits must stay in place');
        expect(validationMessage('ja', { code: 'hard-yellow' }, 4)).toBe('ハードモード: 判明した数字を必ず含めてください');
        expect(validationMessage('en', { code: 'hard-yellow' }, 4)).toBe('Hard mode: must include all revealed digits');
    });

    it('理由のコードが無いとき（playing 以外への送信）は入力確認の文', () => {
        expect(validationMessage('ja', undefined, 4)).toBe('入力を確認してください');
        expect(validationMessage('en', undefined, 4)).toBe('Please check your input');
    });
});

describe('translate', () => {
    it('Title の文言（モード）は日本語と英語で表のとおり', () => {
        expect([translate('ja', 'normalMode'), translate('ja', 'hardMode'), translate('ja', 'dailyMode')])
            .toEqual(['ノーマル', 'ハード', 'デイリー']);
        expect([translate('en', 'normalMode'), translate('en', 'hardMode'), translate('en', 'dailyMode')])
            .toEqual(['Normal', 'Hard', 'Daily']);
    });

    it('結果表示の Clear / GameOver は言語によらず同じ', () => {
        expect([translate('ja', 'clear'), translate('en', 'clear')]).toEqual(['Clear', 'Clear']);
        expect([translate('ja', 'gameOver'), translate('en', 'gameOver')]).toEqual(['GameOver', 'GameOver']);
    });

    it('「桁数を選び直す」と入力確認の文言は言語ごとに空でない', () => {
        expect([translate('ja', 'reselectDigits'), translate('en', 'reselectDigits')]).toEqual([
            '桁数を選び直す', 'Choose digits again'
        ]);
        for (const key of KEYS) {
            expect(translate('ja', key).length).toBeGreaterThan(0);
            expect(translate('en', key).length).toBeGreaterThan(0);
        }
    });
});
