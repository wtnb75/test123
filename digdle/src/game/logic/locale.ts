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
