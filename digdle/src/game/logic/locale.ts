import type { ValidationReason } from '../types';

export type Locale = 'ja' | 'en';

export type TextKey =
    | 'clear'
    | 'gameOver'
    | 'reselectDigits'
    | 'checkInput'
    | 'normalMode'
    | 'hardMode'
    | 'dailyMode'
    | 'statsEmpty'
    | 'statsClear'
    | 'statsClearConfirm'
    | 'copy'
    | 'copyFailed';

const JA: Record<TextKey, string> = {
    clear: 'Clear',
    gameOver: 'GameOver',
    reselectDigits: '桁数を選び直す',
    checkInput: '入力を確認してください',
    normalMode: 'ノーマル',
    hardMode: 'ハード',
    dailyMode: 'デイリー',
    statsEmpty: '戦績は空です',
    statsClear: '戦績を消す',
    statsClearConfirm: 'もう 1 回押すと\nすべて消えます',
    copy: 'コピー',
    copyFailed: 'コピーできませんでした'
};

const EN: Record<TextKey, string> = {
    clear: 'Clear',
    gameOver: 'GameOver',
    reselectDigits: 'Choose digits again',
    checkInput: 'Please check your input',
    normalMode: 'Normal',
    hardMode: 'Hard',
    dailyMode: 'Daily',
    statsEmpty: 'No stats',
    statsClear: 'Clear stats',
    statsClearConfirm: 'Press again to erase all',
    copy: 'Copy',
    copyFailed: 'Could not copy'
};

/** `ja` when the browser language starts with "ja", otherwise `en`. */
export const detectLocale = (): Locale => {
    const lang = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ja';
    return lang.startsWith('ja') ? 'ja' : 'en';
};

export const translate = (locale: Locale, key: TextKey): string => (locale === 'ja' ? JA[key] : EN[key]);

const withFactorization = (base: string, reason: { factorization?: string }): string =>
    (reason.factorization ? `${base} (${reason.factorization})` : base);

/**
 * The notice text for a rejected guess. `digits` is the round's digit count
 * (absent when there is no round); only the English length message uses it.
 * Without a reason (a guess sent to a round that is not `playing`) it is the generic "check your input".
 */
export const validationMessage = (locale: Locale, reason: ValidationReason | undefined, digits?: number): string => {
    if (reason === undefined) {
        return translate(locale, 'checkInput');
    }

    const ja = locale === 'ja';
    switch (reason.code) {
        case 'length':
            if (ja) {
                return 'N桁の数字を入力してください';
            }
            return digits ? `Enter a ${digits}-digit number` : 'Enter the required number of digits';
        case 'not-prime':
            return withFactorization(ja ? '素数を入力してください' : 'Enter a prime number', reason);
        case 'hard-green':
            return ja ? 'ハードモード: 確定した位置の数字を変えられません' : 'Hard mode: confirmed digits must stay in place';
        case 'hard-yellow':
            return ja ? 'ハードモード: 判明した数字を必ず含めてください' : 'Hard mode: must include all revealed digits';
    }
};
