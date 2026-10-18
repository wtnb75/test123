export type Locale = 'ja' | 'en';

export type TextKey =
    | 'clear'
    | 'gameOver'
    | 'reselectDigits'
    | 'checkInput'
    | 'normalMode'
    | 'hardMode'
    | 'dailyMode';

const JA: Record<TextKey, string> = {
    clear: 'Clear',
    gameOver: 'GameOver',
    reselectDigits: '桁数を選び直す',
    checkInput: '入力を確認してください',
    normalMode: 'ノーマル',
    hardMode: 'ハード',
    dailyMode: 'デイリー'
};

const EN: Record<TextKey, string> = {
    clear: 'Clear',
    gameOver: 'GameOver',
    reselectDigits: 'Choose digits again',
    checkInput: 'Please check your input',
    normalMode: 'Normal',
    hardMode: 'Hard',
    dailyMode: 'Daily'
};

/** `ja` when the browser language starts with "ja", otherwise `en`. */
export const detectLocale = (): Locale => {
    const lang = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'ja';
    return lang.startsWith('ja') ? 'ja' : 'en';
};

export const translate = (locale: Locale, key: TextKey): string => (locale === 'ja' ? JA[key] : EN[key]);
