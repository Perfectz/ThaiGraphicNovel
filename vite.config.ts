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
  build: {
    // Split heavy vendor dependencies into named chunks for long-term browser caching
    // and to keep the initial JS small. Three.js especially benefits — it changes far
    // less often than app code, so a stable vendor hash means returning visitors skip
    // re-downloading ~400kb of engine.
    rolldownOptions: {
      checks: {
        // Large GLB/audio files are expected in this game build; Vite's asset
        // plugin will spend measurable time copying them even when healthy.
        pluginTimings: false,
      },
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('node_modules/three/examples') || id.includes('node_modules\\three\\examples')) {
            return 'vendor-three-examples';
          }
          if (id.includes('node_modules/three') || id.includes('node_modules\\three')) return 'vendor-three-core';
          if (id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react-dom';
          if (/node_modules[\\/]react[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('zustand')) return 'vendor-zustand';
          return 'vendor';
        },
      },
    },
    // Keep the threshold at Vite's practical default; Three.js is split above
    // so real regressions still show up instead of being hidden.
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    cssCodeSplit: true,
  },
});
