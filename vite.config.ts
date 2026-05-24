import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/realtime': 'http://localhost:8787',
      '/api/whisper': 'http://localhost:8788',
    },
  },
});
