<script lang="ts">
  import { _ } from 'svelte-i18n';
  interface Props {
    isOpen?: boolean;
    onClose?: any;
    children?: import('svelte').Snippet;
    message?: string;
  }

  let { isOpen = false, onClose = () => {}, children, message = '' }: Props = $props();
</script>

{#if isOpen}
  <div class="fixed inset-0 flex justify-center items-center z-50" style="background-color: rgba(0,0,0,0.5); backdrop-filter: blur(4px);">
    <div class="card p-5 max-w-lg w-full mx-4 relative">
      <button class="btn-icon absolute top-3 right-3" onclick={onClose} aria-label={$_('close')}>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      {#if message}
        <p class="text-sm mb-4" style="color: var(--text-secondary);">{@html message}</p>
      {/if}
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{/if} 
