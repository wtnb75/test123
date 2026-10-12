// Shared Vitest config for every game. Phaser-dependent glue (scenes, entry
// points) is excluded from coverage; the game logic must stay above 90%.
export default {
    test: {
        environment: 'node',
        // The CI runs every game's tests in parallel on a small runner; the exhaustive and
        // property tests take 1-3 s alone but can pass the default 5 s under that load.
        testTimeout: 20000,
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.d.ts',
                'src/main.ts',
                'src/game/main.ts',
                'src/game/scenes/**'
            ],
            thresholds: {
                statements: 90,
                branches: 90,
                functions: 90,
                lines: 90
            }
        }
    }
};
