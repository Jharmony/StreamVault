import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [react(), nodePolyfills()],
  base: './',
  optimizeDeps: {
    esbuildOptions: {
      external: [
        'rpc-websockets/dist/lib/client',
        'rpc-websockets/dist/lib/client/websocket.browser',
      ],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  resolve: {
    alias: {
      '@': '/src',
      '@solana/web3.js': '/src/shims/solana-web3.ts',
      'rpc-websockets/dist/lib/client': '/src/shims/rpc-websockets-client.ts',
      'rpc-websockets/dist/lib/client/websocket.browser': '/src/shims/rpc-websockets-client.ts',
    },
  },
});
