import base from '../../scaffold/vite/config.dev.mjs';

export default {
    ...base,
    define: {
        'import.meta.env.VITE_DEV_IGNORE_VERIFIED': JSON.stringify('true'),
    },
};
