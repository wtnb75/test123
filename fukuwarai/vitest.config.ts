import { mergeConfig } from 'vitest/config';
import base from '../scaffold/vitest.base.mjs';

// drawing.ts is Phaser drawing glue with no unit-testable logic.
export default mergeConfig(base, {
    test: {
        coverage: {
            exclude: ['src/game/drawing.ts']
        }
    }
});
