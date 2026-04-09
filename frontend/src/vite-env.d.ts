/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Express API (no trailing slash). Example: https://api.example.com */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
