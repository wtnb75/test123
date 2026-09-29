// Shared Vite production config for every game. Games re-export this from
// their own vite/config.prod.mjs and may extend it.
//
// Two build flavours:
//  - default (`npm run build`): Phaser is bundled and dist/ runs on its own.
//  - SHARED_VENDOR=1 (`task build`): Phaser is left out and loaded through an import map from
//    <site>/vendor/, one copy for every game; the result goes to dist-shared/ so dist/ stays standalone.
import { phaserVendorFile, resolvePhaser, VENDOR_URL_PREFIX } from './vendor.mjs';

const sharedVendor = process.env.SHARED_VENDOR === '1';

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = "---------------------------------------------------------";
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);

            process.stdout.write(`✨ Done ✨\n`);
        }
    };
};

/** Points the bare `phaser` import at the shared copy; the import map must come before any module script. */
const sharedPhaser = () => {
    const { version } = resolvePhaser(process.cwd());
    const imports = { phaser: `${VENDOR_URL_PREFIX}${phaserVendorFile(version)}` };
    return {
        name: 'shared-phaser',
        transformIndexHtml: {
            order: 'pre',
            handler: () => [{
                tag: 'script',
                attrs: { type: 'importmap' },
                children: JSON.stringify({ imports }),
                injectTo: 'head-prepend'
            }]
        }
    };
};

export default {
    base: './',
    logLevel: 'warning',
    build: {
        outDir: sharedVendor ? 'dist-shared' : 'dist',
        rollupOptions: {
            external: sharedVendor ? ['phaser'] : [],
            output: {
                manualChunks: (id) => {
                    if (id.includes('/node_modules/phaser/')) {
                        return 'phaser';
                    }
                    return undefined;
                }
            }
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2
            },
            mangle: true,
            format: {
                comments: false
            }
        }
    },
    plugins: [
        phasermsg(),
        ...(sharedVendor ? [sharedPhaser()] : [])
    ]
};
