import { describe, expect, it } from 'vitest';

// Every non-test source file of the game, read as text (Vite inlines them; no Node API needed).
const SOURCES = import.meta.glob(['./**/*.ts', '!./**/*.test.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

describe('persistence (docs/spec.md "保存するもの")', () => {
    it('calls the browser storage API only from the best-record module', () => {
        const files = Object.keys(SOURCES);
        expect(files.length).toBeGreaterThan(10);
        expect(files).toContain('./scenes/Title.ts'); // the Scenes are included, not just the logic
        expect(files).toContain('./logic/best.ts');
        const offenders = files.filter((f) => /localStorage|sessionStorage|indexedDB/i.test(SOURCES[f]));
        expect(offenders).toEqual(['./logic/best.ts']);
    });

    it('lets only the Result Scene reach the best record (Title, demo, Game and the rules never call it)', () => {
        const users = Object.keys(SOURCES).filter(
            (f) => f !== './logic/best.ts' && /resolveBest|browserStorage|logic\/best/.test(SOURCES[f]),
        );
        expect(users).toEqual(['./scenes/Result.ts']);
    });
});
