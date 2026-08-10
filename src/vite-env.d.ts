/// <reference types="vite/client" />

// Optional on purpose: a fresh clone has no .env, and constants.ts turns a
// missing value into an on-screen explanation rather than a crash.
interface ImportMetaEnv {
  readonly VITE_WEBHOOK_URL: string | undefined;
  readonly VITE_SUPABASE_URL: string | undefined;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
