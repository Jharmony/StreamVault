import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
export default defineConfig({
    plugins: [react(), nodePolyfills()],
    base: './',
    optimizeDeps: {
        exclude: ['rpc-websockets'],
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
        alias: [
            { find: '@', replacement: '/src' },
            // Order matters: the more specific deep import must come first.
            { find: 'rpc-websockets/dist/lib/client/websocket.browser', replacement: 'rpc-websockets/dist/lib/client/websocket.browser.cjs' },
            { find: 'rpc-websockets/dist/lib/client', replacement: 'rpc-websockets/dist/lib/client.cjs' },
        ],
    },
});
