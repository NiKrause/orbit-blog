<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { currentTheme, applyTheme } from './themeStore.js';

  let unsubscribe: () => void;

  onMount(() => {
    unsubscribe = currentTheme.subscribe((theme) => {
      if (theme) {
        applyTheme(theme);
      }
    });
  });

  onDestroy(() => {
    unsubscribe?.();
  });
</script>

<slot />
