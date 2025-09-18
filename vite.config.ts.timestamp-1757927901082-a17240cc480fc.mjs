// vite.config.ts
import { defineConfig } from "file:///C:/Users/podde/CascadeProjects/reef-web3-history-vite/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/podde/CascadeProjects/reef-web3-history-vite/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
import { VitePWA } from "file:///C:/Users/podde/CascadeProjects/reef-web3-history-vite/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\podde\\CascadeProjects\\reef-web3-history-vite";
var vite_config_default = defineConfig(async () => {
  const plugins = [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        navigateFallback: "/index.html",
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Cache IPFS content with stale-while-revalidate
            // Support both path-based gateways (http/https://host/ipfs/<cid>/...)
            // and subdomain gateways (http/https://<cid>.ipfs.<host>/...)
            // Allow uppercase letters in subdomain CIDs for broader compatibility.
            urlPattern: /^https?:\/\/(?:[^/]+\/ipfs\/.*|[A-Za-z0-9]+\.ipfs\.[^/]+\/.*)$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ipfs",
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 7 * 24 * 60 * 60
                // 7 days
              },
              // Avoid caching 206 (partial content) to reduce ERR_CACHE_OPERATION_NOT_SUPPORTED
              // for video range requests from gateways.
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: "Reef Web3 History",
        short_name: "Reef NFTs",
        start_url: "/",
        display: "standalone",
        theme_color: "#0b0f19",
        background_color: "#ffffff"
      }
    })
  ];
  const rollupPlugins = [];
  if (process.env.ANALYZE) {
    try {
      const { visualizer } = await import("file:///C:/Users/podde/CascadeProjects/reef-web3-history-vite/node_modules/rollup-plugin-visualizer/dist/plugin/index.js");
      rollupPlugins.push(
        visualizer({ filename: "stats.html", template: "treemap", gzipSize: true, brotliSize: true, open: true })
      );
    } catch {
      console.warn("rollup-plugin-visualizer not installed. Run: npm i -D rollup-plugin-visualizer cross-env");
    }
  }
  return {
    plugins,
    resolve: {
      alias: {
        "react/jsx-runtime": path.resolve(__vite_injected_original_dirname, "node_modules/react/jsx-runtime.js"),
        "react/jsx-dev-runtime": path.resolve(__vite_injected_original_dirname, "node_modules/react/jsx-dev-runtime.js"),
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      },
      dedupe: ["react", "react-dom", "@apollo/client", "graphql"]
    },
    build: {
      chunkSizeWarningLimit: 1024,
      rollupOptions: {
        plugins: rollupPlugins
      }
    },
    optimizeDeps: {
      include: ["@apollo/client", "graphql"]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxwb2RkZVxcXFxDYXNjYWRlUHJvamVjdHNcXFxccmVlZi13ZWIzLWhpc3Rvcnktdml0ZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxccG9kZGVcXFxcQ2FzY2FkZVByb2plY3RzXFxcXHJlZWYtd2ViMy1oaXN0b3J5LXZpdGVcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL3BvZGRlL0Nhc2NhZGVQcm9qZWN0cy9yZWVmLXdlYjMtaGlzdG9yeS12aXRlL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgdHlwZSB7IFBsdWdpbiBhcyBSb2xsdXBQbHVnaW4gfSBmcm9tICdyb2xsdXAnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoYXN5bmMgKCkgPT4ge1xuICBjb25zdCBwbHVnaW5zID0gW1xuICAgIHJlYWN0KCksXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAgIGluamVjdFJlZ2lzdGVyOiAnYXV0bycsXG4gICAgICB3b3JrYm94OiB7XG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgIGNsaWVudHNDbGFpbTogdHJ1ZSxcbiAgICAgICAgc2tpcFdhaXRpbmc6IHRydWUsXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gQ2FjaGUgSVBGUyBjb250ZW50IHdpdGggc3RhbGUtd2hpbGUtcmV2YWxpZGF0ZVxuICAgICAgICAgICAgLy8gU3VwcG9ydCBib3RoIHBhdGgtYmFzZWQgZ2F0ZXdheXMgKGh0dHAvaHR0cHM6Ly9ob3N0L2lwZnMvPGNpZD4vLi4uKVxuICAgICAgICAgICAgLy8gYW5kIHN1YmRvbWFpbiBnYXRld2F5cyAoaHR0cC9odHRwczovLzxjaWQ+LmlwZnMuPGhvc3Q+Ly4uLilcbiAgICAgICAgICAgIC8vIEFsbG93IHVwcGVyY2FzZSBsZXR0ZXJzIGluIHN1YmRvbWFpbiBDSURzIGZvciBicm9hZGVyIGNvbXBhdGliaWxpdHkuXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzPzpcXC9cXC8oPzpbXi9dK1xcL2lwZnNcXC8uKnxbQS1aYS16MC05XStcXC5pcGZzXFwuW14vXStcXC8uKikkLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdTdGFsZVdoaWxlUmV2YWxpZGF0ZScsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2lwZnMnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogNDAwLFxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDcgKiAyNCAqIDYwICogNjAsIC8vIDcgZGF5c1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAvLyBBdm9pZCBjYWNoaW5nIDIwNiAocGFydGlhbCBjb250ZW50KSB0byByZWR1Y2UgRVJSX0NBQ0hFX09QRVJBVElPTl9OT1RfU1VQUE9SVEVEXG4gICAgICAgICAgICAgIC8vIGZvciB2aWRlbyByYW5nZSByZXF1ZXN0cyBmcm9tIGdhdGV3YXlzLlxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZTogeyBzdGF0dXNlczogWzAsIDIwMF0gfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiAnUmVlZiBXZWIzIEhpc3RvcnknLFxuICAgICAgICBzaG9ydF9uYW1lOiAnUmVlZiBORlRzJyxcbiAgICAgICAgc3RhcnRfdXJsOiAnLycsXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjMGIwZjE5JyxcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyNmZmZmZmYnLFxuICAgICAgfSxcbiAgICB9KSxcbiAgXTtcbiAgY29uc3Qgcm9sbHVwUGx1Z2luczogUm9sbHVwUGx1Z2luW10gPSBbXTtcblxuICBpZiAocHJvY2Vzcy5lbnYuQU5BTFlaRSkge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB7IHZpc3VhbGl6ZXIgfSA9IGF3YWl0IGltcG9ydCgncm9sbHVwLXBsdWdpbi12aXN1YWxpemVyJyk7XG4gICAgICByb2xsdXBQbHVnaW5zLnB1c2goXG4gICAgICAgIHZpc3VhbGl6ZXIoeyBmaWxlbmFtZTogJ3N0YXRzLmh0bWwnLCB0ZW1wbGF0ZTogJ3RyZWVtYXAnLCBnemlwU2l6ZTogdHJ1ZSwgYnJvdGxpU2l6ZTogdHJ1ZSwgb3BlbjogdHJ1ZSB9KVxuICAgICAgKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIGNvbnNvbGUud2Fybigncm9sbHVwLXBsdWdpbi12aXN1YWxpemVyIG5vdCBpbnN0YWxsZWQuIFJ1bjogbnBtIGkgLUQgcm9sbHVwLXBsdWdpbi12aXN1YWxpemVyIGNyb3NzLWVudicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgcGx1Z2lucyxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICAncmVhY3QvanN4LXJ1bnRpbWUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3JlYWN0L2pzeC1ydW50aW1lLmpzJyksXG4gICAgICAgICdyZWFjdC9qc3gtZGV2LXJ1bnRpbWUnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3JlYWN0L2pzeC1kZXYtcnVudGltZS5qcycpLFxuICAgICAgICAnQCc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3NyYycpLFxuICAgICAgfSxcbiAgICAgIGRlZHVwZTogWydyZWFjdCcsICdyZWFjdC1kb20nLCAnQGFwb2xsby9jbGllbnQnLCAnZ3JhcGhxbCddLFxuICAgIH0sXG4gICAgYnVpbGQ6IHtcbiAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAyNCxcbiAgICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgICAgcGx1Z2luczogcm9sbHVwUGx1Z2lucyxcbiAgICAgIH0sXG4gICAgfSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIGluY2x1ZGU6IFsnQGFwb2xsby9jbGllbnQnLCAnZ3JhcGhxbCddLFxuICAgIH0sXG4gIH07XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBMlYsU0FBUyxvQkFBb0I7QUFDeFgsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUVqQixTQUFTLGVBQWU7QUFKeEIsSUFBTSxtQ0FBbUM7QUFPekMsSUFBTyxzQkFBUSxhQUFhLFlBQVk7QUFDdEMsUUFBTSxVQUFVO0FBQUEsSUFDZCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZCxnQkFBZ0I7QUFBQSxNQUNoQixTQUFTO0FBQUEsUUFDUCxrQkFBa0I7QUFBQSxRQUNsQixjQUFjO0FBQUEsUUFDZCxhQUFhO0FBQUEsUUFDYixnQkFBZ0I7QUFBQSxVQUNkO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxZQUtFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxjQUNYLFlBQVk7QUFBQSxnQkFDVixZQUFZO0FBQUEsZ0JBQ1osZUFBZSxJQUFJLEtBQUssS0FBSztBQUFBO0FBQUEsY0FDL0I7QUFBQTtBQUFBO0FBQUEsY0FHQSxtQkFBbUIsRUFBRSxVQUFVLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxZQUMxQztBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osV0FBVztBQUFBLFFBQ1gsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsTUFDcEI7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQ0EsUUFBTSxnQkFBZ0MsQ0FBQztBQUV2QyxNQUFJLFFBQVEsSUFBSSxTQUFTO0FBQ3ZCLFFBQUk7QUFDRixZQUFNLEVBQUUsV0FBVyxJQUFJLE1BQU0sT0FBTywwSEFBMEI7QUFDOUQsb0JBQWM7QUFBQSxRQUNaLFdBQVcsRUFBRSxVQUFVLGNBQWMsVUFBVSxXQUFXLFVBQVUsTUFBTSxZQUFZLE1BQU0sTUFBTSxLQUFLLENBQUM7QUFBQSxNQUMxRztBQUFBLElBQ0YsUUFBUTtBQUNOLGNBQVEsS0FBSywwRkFBMEY7QUFBQSxJQUN6RztBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0EsU0FBUztBQUFBLE1BQ1AsT0FBTztBQUFBLFFBQ0wscUJBQXFCLEtBQUssUUFBUSxrQ0FBVyxtQ0FBbUM7QUFBQSxRQUNoRix5QkFBeUIsS0FBSyxRQUFRLGtDQUFXLHVDQUF1QztBQUFBLFFBQ3hGLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUN0QztBQUFBLE1BQ0EsUUFBUSxDQUFDLFNBQVMsYUFBYSxrQkFBa0IsU0FBUztBQUFBLElBQzVEO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCx1QkFBdUI7QUFBQSxNQUN2QixlQUFlO0FBQUEsUUFDYixTQUFTO0FBQUEsTUFDWDtBQUFBLElBQ0Y7QUFBQSxJQUNBLGNBQWM7QUFBQSxNQUNaLFNBQVMsQ0FBQyxrQkFBa0IsU0FBUztBQUFBLElBQ3ZDO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
