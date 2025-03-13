import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm';
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const file = fileURLToPath(new URL('package.json', import.meta.url));
const json = readFileSync(file, 'utf8');
const pkg = JSON.parse(json);


export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    wasm(),
    nodePolyfills({
      include: [
        'path', 
        'util', 
        'buffer', 
        'process', 
        'events',
        'crypto',
        'os', 
        'stream', 
        'string_decoder',
        'readable-stream',
        'safe-buffer'
      ],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    VitePWA({ 
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Orbit Blog',
        short_name: 'OrbitDB',
        description: 'A local-first, peer-to-peer blog powered by OrbitDB',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/orbit192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/orbit512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Set to 5 MiB
      }
    })
  ],
  build: {
    target: 'esnext',
    assetsDir: 'assets',
    rollupOptions: {
      external: [
        // Exclude Node.js built-ins that are used by @orbitdb/voyager but not needed in browser
        'fs',
        'node:fs/promises',
        'node:fs',
        'vm',
        'os'
      ],
      output: {
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      path: 'path-browserify',
      'node:path': 'path-browserify',
      stream: 'readable-stream',
      'node:stream': 'readable-stream',
      'readable-stream': 'readable-stream',
      util: 'util/',
      'node:util': 'util/',
      buffer: 'buffer/',
      'safe-buffer': 'safe-buffer'
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      format: 'esm',
      plugins: [],
    },
    include: [
      'path-browserify', 
      'path-browserify', 'stream-browserify', 'util',
      'readable-stream',
      'safe-buffer',
      'buffer'
    ]
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    // Define global variables that might be expected by Node.js modules
    // 'process.env': {},
    // 'global': 'window',
    // 'Buffer': ['buffer', 'Buffer'],
  }
})
