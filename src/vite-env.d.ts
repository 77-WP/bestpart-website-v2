/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_FORCE_CLOSED_UNTIL?: string
  readonly VITE_PREVIEW_OPEN?: string
  readonly VITE_VERCEL_ENV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
