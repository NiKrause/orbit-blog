import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    // Generiere TypeScript-Definitionen
    // enableTypeChecking: true
  }
}
