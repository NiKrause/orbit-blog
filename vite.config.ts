import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
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
    nodePolyfills(),
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
      }
    })
  ],
  build: {
    target: 'esnext',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	}
})
