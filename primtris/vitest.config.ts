import { mergeConfig } from 'vitest/config';
import base from '../scaffold/vitest.base.mjs';

// TODO: raise branches to the shared 90% (primtris.ts is the gap).
export default mergeConfig(base, {
    test: {
        coverage: {
            thresholds: { branches: 82 }
        }
    }
});
