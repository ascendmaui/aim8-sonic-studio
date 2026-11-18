import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// AIM-8 Sonic Studio (open-source, BYOK).
// No environment variables are read at build time and nothing is injected into the bundle.
// Users enter their own Kie.ai and Gemini keys in the app; keys live only in their browser.
export default defineConfig({
  server: { port: 3344, host: '0.0.0.0' },
  preview: { port: 5555, host: '0.0.0.0' },
  plugins: [react()],
  define: {
    // Legacy `process.env.*` reads in shared code resolve to empty strings.
    'process.env': '{}',
  },
  optimizeDeps: { include: ['lamejs'] },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          genai: ['@google/genai'],
        },
      },
    },
  },
});
