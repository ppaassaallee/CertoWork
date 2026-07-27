import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
          if (id.includes('node_modules/.pnpm/@firebase+firestore')) return 'firebase-firestore';
          if (id.includes('node_modules/.pnpm/@firebase+auth')) return 'firebase-auth';
          if (
            id.includes('node_modules/.pnpm/@firebase+app') ||
            id.includes('node_modules/.pnpm/@firebase+component') ||
            id.includes('node_modules/.pnpm/@firebase+logger') ||
            id.includes('node_modules/.pnpm/@firebase+util')
          ) {
            return 'firebase-core';
          }
          if (id.includes('node_modules/.pnpm/firebase@')) return 'firebase';
          if (id.includes('node_modules/.pnpm/motion@')) return 'motion';
          if (id.includes('node_modules/.pnpm/lucide-react@')) return 'icons';
          if (id.includes('node_modules/.pnpm/recharts@')) return 'charts';
          if (
            id.includes('node_modules/.pnpm/react@') ||
            id.includes('node_modules/.pnpm/react-dom@') ||
            id.includes('node_modules/.pnpm/react-router')
          ) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
});
