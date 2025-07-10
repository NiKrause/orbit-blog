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
  <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg w-full">
      <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-700" onclick={onClose}>
        {$_('close')}
      </button>
      {#if message}
        <p class="text-gray-700 dark:text-gray-300 mb-4">{@html message}</p>
      {/if}
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{/if}

<style>


</style> 