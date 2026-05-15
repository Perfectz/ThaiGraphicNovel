/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_REALTIME_SESSION_URL?: string;
  readonly VITE_OPENAI_WHISPER_JUDGE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
