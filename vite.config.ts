import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Match both npm (`node_modules/pkg`) and pnpm (`node_modules/.pnpm/pkg@…`) layouts. */
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;
  if (id.includes('firebase') || id.includes('@firebase')) {
    if (id.includes('firestore')) return 'firebase-firestore';
    if (id.includes('auth')) return 'firebase-auth';
    if (
      id.includes('@firebase/app') ||
      id.includes('@firebase/component') ||
      id.includes('@firebase/logger') ||
      id.includes('@firebase/util') ||
      id.includes('/firebase/app')
    ) {
      return 'firebase-core';
    }
    return 'firebase';
  }
  if (id.includes('motion') || id.includes('framer-motion')) return 'motion';
  if (id.includes('lucide-react')) return 'icons';
  if (id.includes('recharts')) return 'charts';
  if (
    id.includes('/react/') ||
    id.includes('/react-dom/') ||
    id.includes('react-router')
  ) {
    return 'react';
  }
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true
  },
  build: {
    outDir: 'dist/client',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return vendorChunk(id);
        },
      },
    },
  },
});
