/// <reference types="vite/client" />

// Garante que import.meta.env é reconhecido pelo TypeScript
interface ImportMetaEnv {
  readonly VITE_GAS_URL: string
  readonly VITE_SHEETS_API_KEY: string
  readonly VITE_TELEGRAM_API_BASE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
