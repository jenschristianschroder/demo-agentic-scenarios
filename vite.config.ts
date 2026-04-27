import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        // Increase proxy timeout for long-running SSE connections
        // (gpt-image-2 generation can take 60-180s+ per iteration)
        timeout: 600_000,
      },
      '/health': 'http://localhost:3001',
    },
  },
});
