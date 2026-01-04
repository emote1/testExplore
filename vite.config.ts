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
            // Support both path-based gateways (http/https://host/ipfs/<cid>/...)
            // and subdomain gateways (http/https://<cid>.ipfs.<host>/...)
            // Allow uppercase letters in subdomain CIDs for broader compatibility.
            urlPattern: /^https?:\/\/(?:[^/]+\/ipfs\/.*|[A-Za-z0-9]+\.ipfs\.[^/]+\/.*)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'ipfs',
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              // Avoid caching 206 (partial content) to reduce ERR_CACHE_OPERATION_NOT_SUPPORTED
              // for video range requests from gateways.
              cacheableResponse: { statuses: [0, 200] },
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
        // Polyfill Node 'buffer' for libraries that reference it
        buffer: 'buffer',
      },
      dedupe: [
        'react',
        'react-dom',
        '@apollo/client',
        'graphql',
        // Ensure only a single copy of Polkadot packages is bundled
        '@polkadot/api',
        '@polkadot/api-base',
        '@polkadot/api-derive',
        '@polkadot/keyring',
        '@polkadot/rpc-core',
        '@polkadot/rpc-provider',
        '@polkadot/rpc-augment',
        '@polkadot/types',
        '@polkadot/types-known',
        '@polkadot/util',
        '@polkadot/util-crypto',
      ],
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React libraries
            'react-vendor': ['react', 'react-dom'],
            // GraphQL and Apollo
            'apollo-vendor': ['@apollo/client', 'graphql', 'graphql-ws'],
            // TanStack ecosystem
            'tanstack-vendor': [
              '@tanstack/react-query',
              '@tanstack/react-table',
              '@tanstack/react-virtual',
            ],
            // Polkadot/Reef libraries
            'polkadot-vendor': [
              '@polkadot/util-crypto',
              '@reef-chain/util-lib',
            ],
            // UI libraries
            'ui-vendor': [
              'recharts',
              'lucide-react',
              'clsx',
              'tailwind-merge',
              'class-variance-authority',
            ],
            // State management
            'state-vendor': ['zustand'],
          },
        },
        plugins: rollupPlugins,
      },
    },
    optimizeDeps: {
      include: ['@apollo/client', 'graphql', 'buffer'],
    },
  };
});
