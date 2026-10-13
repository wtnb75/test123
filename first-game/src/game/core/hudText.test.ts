import { describe, expect, it } from 'vitest';
import {
    GOAL_MESSAGE,
    KEY_HINT,
    LEGEND_TEXT,
    diedMessage,
    fitFontSize,
    flagMessage,
    flagModeMessage,
    hudRowWidth,
    initialInputKind,
    inputKindOfKey,
    inputKindOfPointer,
    invalidStageMessage,
    jumpMessage,
    resultMessage,
    stageStartMessage,
    statusLine
} from './hudText';

// Expected strings are the ones written in docs/spec.md "メッセージの文言".
describe('resultMessage', () => {
    it('says how many cells a move opened, singular for one', () => {
        expect(resultMessage('alive', undefined, 1, 'touch')).toBe('You open 1 cell.');
        expect(resultMessage('alive', undefined, 2, 'touch')).toBe('You open 2 cells.');
    });

    it('says "You move." when a move opened nothing new', () => {
        expect(resultMessage('alive', undefined, 0, 'keys')).toBe('You move.');
    });

    it('names the wall when the move left the board', () => {
        expect(resultMessage('alive', 'out-of-bounds', 0, 'keys')).toBe('There is a wall there.');
    });

    it('describes a chord that opened cells and one that opened none', () => {
        expect(resultMessage('alive', 'auto-opened', 3, 'keys')).toBe('You open 3 cells.');
        expect(resultMessage('alive', 'auto-opened', 1, 'keys')).toBe('You open 1 cell.');
        expect(resultMessage('alive', 'auto-opened', 0, 'keys')).toBe('Nothing to chord here.');
    });

    it('counts the flagged mines of an auto-flag chord with the right plural', () => {
        expect(resultMessage('alive', 'auto-flagged', 1, 'keys')).toBe('You flag 1 mine.');
        expect(resultMessage('alive', 'auto-flagged', 2, 'keys')).toBe('You flag 2 mines.');
    });

    it('maps the chord refusals to their sentences', () => {
        expect(resultMessage('alive', 'not-enough-info', 0, 'keys')).toBe("You can't tell yet.");
        expect(resultMessage('alive', 'chord-not-available', 0, 'keys')).toBe('Nothing to chord here.');
        expect(resultMessage('alive', 'flag-overflow', 0, 'keys')).toBe('Too many flags around you.');
    });

    it('reports a death by any cause with the same sentence, by input kind', () => {
        for (const tag of ['bomb-without-flag', 'false-flag', undefined]) {
            expect(resultMessage('dead', tag, 0, 'keys')).toBe('You died. [R]etry [T]itle, any key: new game');
            expect(resultMessage('dead', tag, 0, 'touch')).toBe('You died.');
        }
    });

    it('reports reaching the goal without a cell count', () => {
        expect(resultMessage('goal', undefined, 5, 'keys')).toBe('You reach the goal.');
        expect(GOAL_MESSAGE).toBe('You reach the goal.');
    });

    it('lets a death win over a goal-or-open count in the same result', () => {
        expect(resultMessage('dead', 'auto-opened', 4, 'touch')).toBe(diedMessage('touch'));
    });
});

describe('fixed sentences', () => {
    it('shows the key hint at a stage start for keys and the stage line for touch', () => {
        expect(stageStartMessage('keys', 7)).toBe('Move: arrows/QWEA-XZDC  Flag: Shift+dir  Chord: S');
        expect(stageStartMessage('keys', 7)).toBe(KEY_HINT);
        expect(stageStartMessage('touch', 7)).toBe('You enter stage 7.');
    });

    it('formats the stage jump, the invalid stage and the flag mode', () => {
        expect(jumpMessage(12)).toBe('You jump to stage 12.');
        expect(invalidStageMessage(100)).toBe('Stage must be 1-100.');
        expect(flagModeMessage(true)).toBe('Flag mode on.');
        expect(flagModeMessage(false)).toBe('Flag mode off.');
    });

    it('tells a set flag, an unset flag and a flag operation that changed nothing apart', () => {
        expect(flagMessage(true)).toBe('You flag the cell.');
        expect(flagMessage(false)).toBe('You unflag the cell.');
        expect(flagMessage(null)).toBe("You can't flag there.");
    });

    it('keeps the legend short enough for the narrowest screen', () => {
        expect(LEGEND_TEXT).toBe('Orange=mine Green=safe Purple=bad flag');
        // 12 px monospace: 0.6 em per char, 320 px wide screen minus 2 x 20 px margin.
        expect(LEGEND_TEXT.length * 0.6 * 12).toBeLessThanOrEqual(320 - 40);
    });
});

describe('statusLine', () => {
    it('writes stage, score (stage - 1) and high score in the rogue format', () => {
        expect(statusLine(5, 9)).toBe('Stage:5  Score:4  High:9');
        expect(statusLine(1, 0)).toBe('Stage:1  Score:0  High:0');
        expect(statusLine(100, 12)).toBe('Stage:100  Score:99  High:12');
    });
});

describe('fitFontSize', () => {
    const modelWidth = (text: string) => (size: number) => (text.length * 6 * size) / 10;

    it('keeps 18 px when the text just fits (24 chars x 0.6 x 18 = 259.2 <= 260)', () => {
        expect(fitFontSize(modelWidth('Stage:1  Score:0  High:0'), 260)).toEqual({ size: 18, wrap: false });
    });

    it('steps down 1 px at a time to the largest size that fits (28 chars: 15 px at 260)', () => {
        expect(fitFontSize(modelWidth('Stage:100  Score:99  High:99'), 260)).toEqual({ size: 15, wrap: false });
    });

    it('falls back to 14 px and asks for wrapping when 14 px does not fit (28 chars at 190)', () => {
        expect(fitFontSize(modelWidth('Stage:100  Score:99  High:99'), 190)).toEqual({ size: 14, wrap: true });
    });

    it('accepts the exact boundary of 14 px without wrapping', () => {
        // 28 x 0.6 x 14 = 235.2
        expect(fitFontSize(modelWidth('Stage:100  Score:99  High:99'), 235.2)).toEqual({ size: 14, wrap: false });
    });
});

describe('hudRowWidth', () => {
    it('leaves room for the STAGE button, the right margin and the gap', () => {
        expect(hudRowWidth(390, 82)).toBe(260);
        expect(hudRowWidth(1280, 90)).toBe(1142);
        expect(hudRowWidth(320, 82)).toBe(190);
    });
});

describe('input kind', () => {
    it('starts as touch when the device has touch points and as keys otherwise', () => {
        expect(initialInputKind(5)).toBe('touch');
        expect(initialInputKind(1)).toBe('touch');
        expect(initialInputKind(0)).toBe('keys');
        expect(initialInputKind(undefined)).toBe('keys');
    });

    it('switches to keys on a key press and on a mouse press, to touch on a finger', () => {
        expect(inputKindOfKey()).toBe('keys');
        expect(inputKindOfPointer(false)).toBe('keys');
        expect(inputKindOfPointer(true)).toBe('touch');
    });
});
