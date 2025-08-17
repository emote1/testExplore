import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const plugins = [react()];
  const rollupPlugins: any[] = [];

  if (process.env.ANALYZE) {
    try {
      const { visualizer } = await import('rollup-plugin-visualizer');
      rollupPlugins.push(
        visualizer({ filename: 'stats.html', template: 'treemap', gzipSize: true, brotliSize: true, open: true })
      );
    } catch {
      console.warn('rollup-plugin-visualizer not installed. Run: npm i -D rollup-plugin-visualizer cross-env');
    }
  }

  return {
    plugins,
    resolve: {
      alias: {
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
        'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom', '@apollo/client', 'graphql'],
    },
    build: {
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        plugins: rollupPlugins,
      },
    },
    optimizeDeps: {
      include: ['@apollo/client', 'graphql'],
    },
  };
});
