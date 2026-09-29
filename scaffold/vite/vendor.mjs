// Shared helpers for the "shared Phaser" build (SHARED_VENDOR=1): one copy of Phaser is served from
// <site>/vendor/ and every game loads it through an import map, instead of bundling its own.
import { createRequire } from 'node:module';
import { join } from 'node:path';

/** File name of the shared Phaser build for a version. The version is in the name, so a bump busts caches. */
export function phaserVendorFile(version) {
    return `phaser-${version}.esm.min.js`;
}

/** Where a game's index.html finds the vendor directory: games sit at <site>/<game>/, vendor at <site>/vendor/. */
export const VENDOR_URL_PREFIX = '../vendor/';

/** Resolves Phaser as `gameDir` sees it: its version and the ES module build to publish. */
export function resolvePhaser(gameDir) {
    const require = createRequire(join(gameDir, 'package.json'));
    const pkgPath = require.resolve('phaser/package.json');
    const { version } = require(pkgPath);
    return { version, file: join(pkgPath, '..', 'dist', 'phaser.esm.min.js') };
}
