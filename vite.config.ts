import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin as RollupPlugin } from 'rollup';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const plugins = [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        navigateFallback: '/index.html',
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Cache IPFS content with stale-while-revalidate
            // Support both path-based gateways (https://host/ipfs/<cid>/...) and subdomain gateways (https://<cid>.ipfs.<host>/...)
            urlPattern: /^https:\/\/(?:[^/]+\/ipfs\/.*|[a-z0-9]+\.ipfs\.[^/]+\/.*)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ipfs',
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: { statuses: [0, 200, 206] },
            },
          },
        ],
      },
      manifest: {
        name: 'Reef Web3 History',
        short_name: 'Reef NFTs',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0b0f19',
        background_color: '#ffffff',
      },
    }),
  ];
  const rollupPlugins: RollupPlugin[] = [];

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
