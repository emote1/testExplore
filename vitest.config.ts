import { defineConfig } from 'vitest/config';

export default defineConfig({
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
    environment: 'node',
  },
});
