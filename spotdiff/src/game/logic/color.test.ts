import { describe, expect, it } from 'vitest';
import { hslToHex } from './color';

describe('hslToHex', () => {
    it('maps the primary hues at full saturation to pure red, green and blue', () => {
        expect(hslToHex(0, 1, 0.5)).toBe(0xff0000);
        expect(hslToHex(120, 1, 0.5)).toBe(0x00ff00);
        expect(hslToHex(240, 1, 0.5)).toBe(0x0000ff);
    });

    it('maps zero saturation to a gray of the given lightness', () => {
        expect(hslToHex(0, 0, 0)).toBe(0x000000);
        expect(hslToHex(200, 0, 1)).toBe(0xffffff);
        expect(hslToHex(77, 0, 0.5)).toBe(0x808080);
    });

    it('maps the secondary hues to yellow, cyan and magenta', () => {
        expect(hslToHex(60, 1, 0.5)).toBe(0xffff00);
        expect(hslToHex(180, 1, 0.5)).toBe(0x00ffff);
        expect(hslToHex(300, 1, 0.5)).toBe(0xff00ff);
    });

    it('wraps hues outside 0-359 around the color wheel', () => {
        expect(hslToHex(360, 1, 0.5)).toBe(0xff0000);
        expect(hslToHex(-120, 1, 0.5)).toBe(0x0000ff);
        expect(hslToHex(480, 1, 0.5)).toBe(0x00ff00);
    });

    it('lightens toward white and darkens toward black', () => {
        expect(hslToHex(0, 1, 0.75)).toBe(0xff8080);
        expect(hslToHex(0, 1, 0.25)).toBe(0x800000);
    });
});
