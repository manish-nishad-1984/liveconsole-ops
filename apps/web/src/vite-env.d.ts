/// <reference types="vite/client" />

/** Injected by `define` in vite.config.ts and shown in the app footer. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
