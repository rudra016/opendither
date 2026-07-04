/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REMOVE_BG_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
