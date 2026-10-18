import { describe, it, expect } from 'vitest';
import { dropHintFor } from './dropHint';
import { regionForY } from './regions';
import { DROP_HINT_LABEL_FONT_PX, GAME_WIDTH, TRAY_TOP_Y } from './constants';

describe('dropHintFor', () => {
    it('tells the player that releasing in the placement area confirms, with a solid line', () => {
        expect(dropHintFor('placement')).toEqual({
            label: 'ここで離すと確定',
            dashed: false,
            color: 0x2a9d8f,
        });
    });

    it('tells the player that releasing in the tray does not confirm, with a dashed line', () => {
        expect(dropHintFor('tray')).toEqual({
            label: '確定しない（やり直せる）',
            dashed: true,
            color: 0xe76f51,
        });
    });

    it('distinguishes the two states by label and line shape, not by color alone', () => {
        const confirm = dropHintFor('placement');
        const tray = dropHintFor('tray');
        expect(confirm.label).not.toBe(tray.label);
        expect(confirm.dashed).not.toBe(tray.dashed);
        expect(confirm.color).not.toBe(tray.color);
    });

    it('keeps the longest label within the screen width at the label font size', () => {
        const longest = Math.max(dropHintFor('placement').label.length, dropHintFor('tray').label.length);
        expect(longest * DROP_HINT_LABEL_FONT_PX).toBeLessThanOrEqual(GAME_WIDTH);
    });

    it.each([
        [0, 'ここで離すと確定', false],
        [699, 'ここで離すと確定', false],
        [700, '確定しない（やり直せる）', true],
        [960, '確定しない（やり直せる）', true],
    ])('shows y=%i as "%s" (dashed=%s), the same side the drop decision uses', (y, label, dashed) => {
        const hint = dropHintFor(regionForY(y, TRAY_TOP_Y));
        expect(hint.label).toBe(label);
        expect(hint.dashed).toBe(dashed);
    });
});
