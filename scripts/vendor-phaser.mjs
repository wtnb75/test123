#!/usr/bin/env node
// Copies the Phaser build each game was built against into <outDir> (default output/vendor), named by
// version. Games built with SHARED_VENDOR=1 point their import map at these files.
// Usage: node scripts/vendor-phaser.mjs <outDir> <gameDir>...
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { phaserVendorFile, resolvePhaser } from '../scaffold/vite/vendor.mjs';

const [outDir, ...games] = process.argv.slice(2);
if (!outDir || games.length === 0) {
    console.error('usage: vendor-phaser.mjs <outDir> <gameDir>...');
    process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const copied = new Map();
for (const game of games) {
    const { version, file } = resolvePhaser(resolve(game));
    if (copied.has(version)) continue;
    const dest = join(outDir, phaserVendorFile(version));
    copyFileSync(file, dest);
    copied.set(version, dest);
    console.log(`${game}: phaser ${version} -> ${dest}`);
}
