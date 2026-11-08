/** Relative luminance of a 0xRRGGBB colour (WCAG 2.x). */
export function luminance(rgb: number): number {
    const channel = (shift: number): number => {
        const c = ((rgb >> shift) & 0xff) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/** WCAG contrast ratio of two 0xRRGGBB colours (1 to 21). */
export function contrastRatio(a: number, b: number): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** HSV-style saturation of a 0xRRGGBB colour, 0 to 1. */
export function saturation(rgb: number): number {
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    const max = Math.max(r, g, b);
    return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
}
