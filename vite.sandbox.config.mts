// Temporary config for Claude's sandbox preview (safe to delete).
// Same as vite.config.ts but with the dep-optimizer cache moved out of
// node_modules/.vite, which is read-only in the sandbox mount.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  cacheDir: '/tmp/vite-cache',
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/.claude/**', '**/.codex/**', '**/.agents/**', '**/.git/**', '**/node_modules/**'],
    },
  },
});
