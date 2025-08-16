declare module 'svelte-icons/fa' {
  import type { SvelteComponentTyped } from 'svelte';
  
  export class FaBars extends SvelteComponentTyped<{}, {}, {}> {}
  export class FaTimes extends SvelteComponentTyped<{}, {}, {}> {}
  
  // Add other FontAwesome icons as needed
  export const FaBars: typeof FaBars;
  export const FaTimes: typeof FaTimes;
}
