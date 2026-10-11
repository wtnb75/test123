import { describe, expect, it } from 'vitest';

// Every non-test source file of the game, read as text (Vite inlines them; no Node API needed).
// The shared title-demo package drives the Title demo, so its source is included.
const SOURCES = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '../../../shared/title-demo/src/*.ts', '!../../../shared/title-demo/src/*.test.ts'], {
    query: '?raw',
    import: 'default',
    eager: true,
}) as Record<string, string>;

describe('persistence (docs/spec.md "永続化: なし")', () => {
    it('uses no browser storage anywhere in the game code (the Title demo included)', () => {
        const files = Object.keys(SOURCES);
        expect(files.length).toBeGreaterThan(10);
        expect(files).toContain('./scenes/Title.ts'); // the Scenes are included, not just the logic
        expect(files).toContain('../../../shared/title-demo/src/director.ts'); // and the shared demo flow
        const offenders = files.filter((f) => /localStorage|sessionStorage|indexedDB/i.test(SOURCES[f]));
        expect(offenders).toEqual([]);
    });
});
