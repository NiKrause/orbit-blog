import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

const file = fileURLToPath(new URL('package.json', import.meta.url));
const json = readFileSync(file, 'utf8');
const pkg = JSON.parse(json);

export default defineConfig({
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
    })
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/lib/index.ts'),
      name: 'OrbitBlog  ',
      fileName: 'index'
    },
    rollupOptions: {
      // Externalisiere Abhängigkeiten, die nicht gebündelt werden sollen
      external: [
        'svelte',
        '@orbitdb/core',
        'helia',
        'libp2p',
        '@libp2p/tcp',
        '@libp2p/webrtc',
        '@libp2p/websockets',
        '@libp2p/webtransport',
        '@chainsafe/libp2p-gossipsub',
        '@chainsafe/libp2p-noise',
        '@chainsafe/libp2p-yamux',
        '@helia/unixfs',
        '@libp2p/bootstrap',
        '@libp2p/crypto',
        '@multiformats/multiaddr',
        'fs',
        'node:fs/promises',
        'node:fs',
        'vm',
        'os'
      ],
      output: {
        // Globale Variablen für UMD-Build
        globals: {
          svelte: 'Svelte',
          '@orbitdb/core': 'OrbitDB',
          'helia': 'Helia',
          'libp2p': 'Libp2p'
        }
      }
    }
  },
  resolve: {
    alias: {
      path: 'path-browserify',
      'node:path': 'path-browserify',
      buffer: 'buffer/',
      'safe-buffer': 'safe-buffer',
      '$lib': path.resolve(__dirname, 'src/lib')
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
    ]
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  }
})
