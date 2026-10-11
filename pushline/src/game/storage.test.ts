import { describe, expect, it } from 'vitest';

// Every non-test source file of the game, read as text (Vite inlines them; no Node API needed).
const SOURCES = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

describe('persistence (docs/spec.md "保存するもの")', () => {
    it('uses no browser storage anywhere in the game code', () => {
        const files = Object.keys(SOURCES);
        expect(files.length).toBeGreaterThan(10);
        expect(files).toContain('./scenes/Title.ts'); // the Scenes are included, not just the logic
        const offenders = files.filter((f) => /localStorage|sessionStorage|indexedDB/i.test(SOURCES[f]));
        expect(offenders).toEqual([]);
    });
});
