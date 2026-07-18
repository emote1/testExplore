import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin as RollupPlugin } from 'rollup';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.REEF_EXPLORER_PROXY_TARGET ?? '';
  const proxyPath = env.REEF_EXPLORER_PROXY_PATH ?? '/v1/graphql';
  const proxyAdminSecret = env.REEF_EXPLORER_ADMIN_SECRET ?? '';
  const stakingSummaryProxyTarget = env.STAKING_SUMMARY_PROXY_TARGET ?? '';
  const stakingSummaryProxyPath = env.STAKING_SUMMARY_PROXY_PATH ?? '/v1/staking/summary';
  const evmRpcTarget = env.VITE_REEF_EVM_RPC_URL ?? 'https://rpc.reefscan.com';

  const plugins = [
    // Dev-only crash guard: an abrupt client disconnect (browser killed
    // mid-request, e.g. by Playwright) surfaces as 'read ECONNRESET' on a raw
    // socket with no 'error' listener — the per-proxy handlers below never see
    // it, and Node kills the dev server. Swallow exactly that; rethrow the rest.
    {
      name: 'dev-ignore-econnreset',
      apply: 'serve' as const,
      configureServer() {
        process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
          if (err?.code === 'ECONNRESET') {
            console.warn('[vite-dev] ignored ECONNRESET (client disconnected)');
            return;
          }
          throw err;
        });
      },
    },
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

  // An upstream connection reset ('read ECONNRESET') is emitted as an 'error'
  // event on the proxy socket; with no listener Node crashes the whole dev
  // server. Swallow + log instead.
  interface DevProxyInstance {
    on(event: 'error', cb: (err: { code?: string; message?: string }) => void): void;
    on(event: 'proxyReq', cb: (proxyReq: { setHeader: (name: string, value: string) => void }) => void): void;
  }
  const swallowProxyErrors = (proxyInstance: DevProxyInstance) => {
    proxyInstance.on('error', (err) => {
      console.warn('[vite-proxy]', err?.code ?? err?.message ?? err);
    });
  };

  const proxy: Record<string, unknown> = {
    '/api/reef-evm-rpc': {
      target: evmRpcTarget,
      changeOrigin: true,
      secure: false,
      ws: false,
      rewrite: () => '/',
      configure: swallowProxyErrors,
    },
  };

  if (proxyTarget) {
    proxy['/api/reef-explorer'] = {
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
      ws: false,
      rewrite: () => proxyPath,
      configure: (proxyInstance: DevProxyInstance) => {
        swallowProxyErrors(proxyInstance);
        if (!proxyAdminSecret) return;
        proxyInstance.on('proxyReq', (proxyReq) => {
          proxyReq.setHeader('x-hasura-admin-secret', proxyAdminSecret);
        });
      },
    };
  }

  if (stakingSummaryProxyTarget) {
    proxy['/api/staking-summary'] = {
      target: stakingSummaryProxyTarget,
      changeOrigin: true,
      secure: false,
      ws: false,
      rewrite: () => stakingSummaryProxyPath,
      configure: swallowProxyErrors,
    };
  }

  return {
    plugins,
    server: {
      proxy,
    },
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
            'tanstack-vendor': ['@tanstack/react-query'],
            // Polkadot/Reef libraries
            'polkadot-vendor': ['@polkadot/util-crypto'],
            // UI libraries
            'ui-vendor': ['lucide-react'],
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
