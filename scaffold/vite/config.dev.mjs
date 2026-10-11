// Shared Vite dev config for every game. Games re-export this from
// their own vite/config.dev.mjs and may extend it (see kogodrop).
export default {
    base: './',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        }
    },
    server: {
        port: 8080,
        // scripts/qa/share.sh serves the dev server through a Cloudflare Quick Tunnel (random subdomain each run).
        // Only share.sh sets SHARE_TUNNEL, so a plain `npm run dev` keeps Vite's default host check.
        ...(process.env.SHARE_TUNNEL ? { allowedHosts: ['.trycloudflare.com'] } : {})
    }
};
