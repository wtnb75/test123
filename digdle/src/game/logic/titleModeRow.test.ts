import { describe, expect, it } from 'vitest';
import { computeTitleLayout, modeButtonWidth, modeLabelFontSize, modeLabelRoom, modeRowWidth } from './titleLayout';

describe('the mode label shrinks from 16 px to 12 px to fit its button', () => {
    // A label four full-width characters wide: its width is 4 × size.
    const fourCharWidth = (size: number): number => 4 * size;

    it('stays at 16 px when it already fits', () => {
        expect(modeLabelFontSize(fourCharWidth, 64)).toBe(16);
        expect(modeLabelFontSize(fourCharWidth, 200)).toBe(16);
    });

    it('shrinks by 1 px until the label fits (60 px room gives 15 px, 52 px gives 13 px)', () => {
        expect(modeLabelFontSize(fourCharWidth, 60)).toBe(15);
        expect(modeLabelFontSize(fourCharWidth, 52)).toBe(13);
    });

    it('stops at 12 px even when the label is still too wide (the 2-column button of 56 px leaves 48 px)', () => {
        expect(modeLabelFontSize(fourCharWidth, 48)).toBe(12);
        expect(modeLabelFontSize(fourCharWidth, 10)).toBe(12);
    });
});

describe('the mode row with the 💡 toggle (docs/spec.md: 配置)', () => {
    it('is 302 px wide where the column allows it, and the column width where it does not', () => {
        expect(modeRowWidth(375)).toBe(302);
        expect(modeRowWidth(236)).toBe(236);
    });

    it('gives each mode button 78 px in the full row, 56 px in the 2-column minimum, and 48 px at the floor', () => {
        expect(modeButtonWidth(302)).toBe(78);
        expect(modeButtonWidth(236)).toBe(56);
        expect(modeButtonWidth(212)).toBe(48);
        // Never wider than 78 px, even if a wider row were passed in (the layout itself caps the row at 302 px).
        expect(modeButtonWidth(400)).toBe(78);
        expect(modeButtonWidth(248)).toBe(60);
    });

    it('leaves 8 px less than the button for a mode label (78 → 70, 56 → 48, 48 → 40)', () => {
        expect(modeLabelRoom(78)).toBe(70);
        expect(modeLabelRoom(56)).toBe(48);
        expect(modeLabelRoom(48)).toBe(40);
    });

    it('puts the 44 px toggle at the right end of a 375 px stacked row (x 294 to 338, y 109)', () => {
        const layout = computeTitleLayout(375, 550);
        expect(layout.candidateButton).toEqual({ x: 294, y: 109, width: 44, height: 44 });
    });

    it('puts the toggle at the right end of the 2-column minimum row (x 200 to 244) at 504 px', () => {
        const layout = computeTitleLayout(504, 180);
        expect(layout.arrangement).toBe('columns');
        expect(layout.candidateButton.x).toBe(200);
        expect(layout.candidateButton.x + layout.candidateButton.width).toBe(244);
    });
});
