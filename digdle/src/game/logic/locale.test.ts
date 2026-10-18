import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectLocale, translate, type TextKey } from './locale';

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
