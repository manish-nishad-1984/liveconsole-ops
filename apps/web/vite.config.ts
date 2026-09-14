import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * The workspace packages are consumed as TypeScript source, so they are aliased to
 * their `src` entry points rather than resolved through `node_modules`. Vite
 * transpiles them along with the app, which keeps the dev loop free of a build
 * step for shared code.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    // Surfaced in the app footer so a support call can identify the build.
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@liveconsole-ops/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@liveconsole-ops/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  server: {
    port: 5273,
    strictPort: true,
    proxy: {
      // Same-origin API calls in development, so the refresh cookie is first-party.
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          table: ['@tanstack/react-table'],
        },
      },
    },
  },
});
