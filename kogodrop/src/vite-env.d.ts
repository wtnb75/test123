/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_DEV_IGNORE_VERIFIED?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
