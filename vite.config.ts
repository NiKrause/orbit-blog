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
        devOptions: {
          enabled: true
        },
        manifest: {
          name: 'Le Space Blog',
          short_name: 'Le Space Blog',
          description: 'A local-first and peer-to-peer blogging application that leverages OrbitDB for peer-to-peer data replication and IPFS for content storage.',
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
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /\/api\//,
              handler: 'NetworkOnly'
            },
            {
              urlPattern: /\/(.*)/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 300
                }
              }
            }
          ],
          skipWaiting: true,
          clientsClaim: true
        }
      })
    ].filter(Boolean),
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
      include: ['path-browserify']
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
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
          manualChunks: {
            'vendor': [
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
              '@helia/unixfs'
            ],
            'ui': [
              'svelte',
              'carbon-icons-svelte',
              'marked',
              'dompurify'
            ]
          },
          assetFileNames: 'assets/[name].[ext]'
        }
      },
      chunkSizeWarningLimit: 1000
    }
  }
})
