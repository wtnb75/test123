import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard, shareText, type ShareRound } from './shareText';
import type { DigitStatus } from '../types';

const row = (...colors: DigitStatus[]) => ({ colors });

describe('shareText', () => {
    it('gives the header and one row of squares per attempt (4 digits, won on the 3rd of 5)', () => {
        const round: ShareRound = {
            n: 4,
            attemptsUsed: 3,
            attemptLimit: 5,
            history: [
                row('gray', 'yellow', 'gray', 'gray'),
                row('green', 'gray', 'yellow', 'gray'),
                row('green', 'green', 'green', 'green')
            ]
        };
        expect(shareText(round)).toBe('digdle 4 3/5\n⬛🟨⬛⬛\n🟩⬛🟨⬛\n🟩🟩🟩🟩');
    });

    it('lists every attempt of a lost round, up to the limit', () => {
        const round: ShareRound = {
            n: 2,
            attemptsUsed: 3,
            attemptLimit: 3,
            history: [row('gray', 'gray'), row('yellow', 'gray'), row('gray', 'yellow')]
        };
        expect(shareText(round)).toBe('digdle 2 3/3\n⬛⬛\n🟨⬛\n⬛🟨');
    });

    it('has no words and no answer digits, so it is the same in every language', () => {
        const text = shareText({ n: 3, attemptsUsed: 1, attemptLimit: 4, history: [row('green', 'green', 'green')] });
        expect(text).toBe('digdle 3 1/4\n🟩🟩🟩');
        expect(text.replace('digdle', '')).not.toMatch(/[A-Za-z぀-ヿ一-鿿]/u);
    });
});

describe('copyToClipboard', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('resolves true when the clipboard accepts the text', async () => {
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });

        await expect(copyToClipboard('digdle 4 3/5')).resolves.toBe(true);
        expect(writeText).toHaveBeenCalledWith('digdle 4 3/5');
    });

    it('resolves false when there is no clipboard API', async () => {
        vi.stubGlobal('navigator', {});

        await expect(copyToClipboard('x')).resolves.toBe(false);
    });

    it('resolves false when the write is refused (blocked or no permission)', async () => {
        vi.stubGlobal('navigator', { clipboard: { writeText: async () => Promise.reject(new Error('NotAllowedError')) } });

        await expect(copyToClipboard('x')).resolves.toBe(false);
    });

    it('resolves false when there is no navigator at all', async () => {
        vi.stubGlobal('navigator', undefined);

        await expect(copyToClipboard('x')).resolves.toBe(false);
    });
});
