export type Rng = () => number;

/** Seeded PRNG: the same seed always yields the same sequence in [0, 1). */
export const mulberry32 = (seed: number): Rng => {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

const mix = (h: number, v: number): number => {
    let x = Math.imul(h ^ (v >>> 0), 0x9e3779b1);
    x ^= x >>> 15;
    x = Math.imul(x, 0x85ebca6b);
    x ^= x >>> 13;
    return x >>> 0;
};

/** Seed of stage `stage` of set `setNo` on date `date` (YYYYMMDD); depends only on the triple. */
export const seedFor = (date: number, setNo: number, stage: number): number =>
    mix(mix(mix(0x811c9dc5, date), setNo), stage);

/** Local date as the integer YYYYMMDD. */
export const dateToYmd = (d: Date): number => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

export const between = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);

export const shuffle = <T>(arr: readonly T[], rng: Rng): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
