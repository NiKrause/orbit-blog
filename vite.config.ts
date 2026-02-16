import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import wasm from 'vite-plugin-wasm';
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import path from 'path';

const file = fileURLToPath(new URL('package.json', import.meta.url));
const json = readFileSync(file, 'utf8');
const pkg = JSON.parse(json);

export default defineConfig(({ command, mode }) => {
  const isLib = mode === 'lib'

  const commonConfig = {
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
      !isLib && VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // Use a checked-in manifest file for stability (and to match simple-todo).
        manifest: false,
        workbox: {
          // Keep offline support while avoiding caching large/local OrbitDB/IPFS directories.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
          globIgnores: ['**/orbitdb/**', '**/ipfs/**', '**/node_modules/**'],
          additionalManifestEntries: [{ url: 'index.html', revision: null }],
          runtimeCaching: [
            {
              // Cache navigation for instant offline loading, but don't interfere with IPFS/OrbitDB URLs.
              urlPattern: ({ request }) =>
                request.mode === 'navigate' &&
                !request.url.includes('/ipfs/') &&
                !request.url.includes('/orbitdb/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'navigation-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
                },
                cacheableResponse: { statuses: [0, 200] }
              },
            },
            {
              // Static assets (JS/CSS/fonts) should be cache-first.
              urlPattern: ({ request }) =>
                request.destination === 'style' ||
                request.destination === 'script' ||
                request.destination === 'font',
              handler: 'CacheFirst',
              options: {
                cacheName: 'assets-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
                }
              },
            },
            {
              // Images can be cached longer; keep counts bounded.
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 24 * 60 * 60 // 60 days
                }
              }
            }
          ],
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true
        },
        devOptions: {
          // Avoid SW/cache interference in normal dev and e2e; enable explicitly when needed.
          enabled: process.env.PWA_DEV === 'true',
          type: 'module'
        }
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        path: 'path-browserify',
        'node:path': 'path-browserify',
        buffer: 'buffer/',
        'safe-buffer': 'safe-buffer',
        // Avoid esbuild "direct-eval" warning from protobufjs optional dependency resolver.
        // In the browser bundle we don't need Node-style runtime requires for optional deps.
        ...(!isLib
          ? { '@protobufjs/inquire': path.resolve(__dirname, 'src/shims/protobufjs-inquire.ts') }
          : {}),
        '$lib': path.resolve(__dirname, 'src/lib')
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        // Silence dependency warning from protobufjs ("Use of eval ... strongly discouraged").
        // This is a third-party dependency used in the browser bundle.
        logOverride: {
          'direct-eval': 'silent',
        },
        define: {
          global: 'globalThis',
        },
        format: 'esm',
        plugins: [],
      },
      include: ['path-browserify', 'bip39']
    },
    esbuild: {
      logOverride: {
        'direct-eval': 'silent',
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    }
  }

  if (isLib) {
    return {
      ...commonConfig,
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/lib/index.ts'),
          name: 'LeSpaceBlog',
          fileName: 'index'
        },
        rollupOptions: {
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
            globals: {
              svelte: 'Svelte',
              '@orbitdb/core': 'OrbitDB',
              'helia': 'Helia',
              'libp2p': 'Libp2p'
            }
          }
        }
      }
    }
  }

  // Web app build config
  return {
    ...commonConfig,
    base: './',
    build: {
      target: 'esnext',
      assetsDir: 'assets',
      rollupOptions: {
        external: [
          'fs',
          'node:fs/promises',
          'node:fs',
          'vm',
          'os'
        ],
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            if (
              id.includes('/@orbitdb/') ||
              id.includes('/orbitdb/') ||
              id.includes('/helia/') ||
              id.includes('/libp2p/') ||
              id.includes('/multiformats/')
            ) return 'p2p'

            if (id.includes('/mermaid/')) return 'mermaid'
            if (id.includes('/katex/')) return 'katex'
            if (id.includes('/cytoscape/') || id.includes('/cose-bilkent/')) return 'cytoscape'

            if (
              id.includes('/svelte/') ||
              id.includes('/svelte-') ||
              id.includes('/carbon-icons-svelte/')
            ) return 'ui'

            if (
              id.includes('/marked/') ||
              id.includes('/dompurify/') ||
              id.includes('/date-fns/') ||
              id.includes('/luxon/')
            ) return 'content'

            return undefined
          },
          assetFileNames: 'assets/[name].[ext]'
        }
      },
      chunkSizeWarningLimit: 2000
    }
  }
})
