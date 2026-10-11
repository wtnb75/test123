export type Locale = 'ja' | 'en';

export type TextKey =
    | 'subtitle'
    | 'selectHint'
    | 'clear'
    | 'gameOver'
    | 'reselectDigits'
    | 'checkInput'
    | 'normalMode'
    | 'hardMode';

const JA: Record<TextKey, string> = {
    subtitle: 'N桁の素数を当てよう',
    selectHint: '2 / 3 / 4 / 5 / 6 を選択',
    clear: 'Clear',
    gameOver: 'GameOver',
    reselectDigits: '桁数を選び直す',
    checkInput: '入力を確認してください',
    normalMode: 'ノーマル',
    hardMode: 'ハード'
};

const EN: Record<TextKey, string> = {
    subtitle: 'Guess the N-digit prime',
    selectHint: 'Choose 2 / 3 / 4 / 5 / 6',
    clear: 'Clear',
    gameOver: 'GameOver',
    reselectDigits: 'Choose digits again',
    checkInput: 'Please check your input',
    normalMode: 'Normal',
    hardMode: 'Hard'
};

/** `ja` when the browser language starts with "ja", otherwise `en`. */
export const detectLocale = (): Locale => {
    const lang = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ja';
    return lang.startsWith('ja') ? 'ja' : 'en';
};

export const translate = (locale: Locale, key: TextKey): string => (locale === 'ja' ? JA[key] : EN[key]);
