/// <reference types="vitest" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
  server: {
    proxy: {
      '/graphql': {
        target: 'https://squid.subsquid.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/graphql/, '/reef-explorer/graphql'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
