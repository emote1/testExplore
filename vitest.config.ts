import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    include: [
      'tests/unit/**/*.{spec,test}.ts?(x)',
      'src/**/*.{spec,test}.ts?(x)',
    ],
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
      'dist/**',
    ],
    environment: 'jsdom', // Для React компонентов
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
