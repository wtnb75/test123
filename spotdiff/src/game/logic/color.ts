/** HSL (h in degrees, s and l in 0-1) to a 0xRRGGBB number. */
export const hslToHex = (h: number, s: number, l: number): number => {
    const hh = ((h % 360) + 360) % 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
        const k = (n + hh / 30) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    const to = (v: number) => Math.round(v * 255);
    return (to(f(0)) << 16) | (to(f(8)) << 8) | to(f(4));
};
