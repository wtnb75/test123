import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    define: {
        'import.meta.env.VITE_DEV_IGNORE_VERIFIED': JSON.stringify('true'),
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        port: 8080
    }
});
