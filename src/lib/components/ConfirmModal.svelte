<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { isRTL } from '$lib/store.js';
  
  interface Props {
    isOpen?: boolean;
    onConfirm?: (options: { dropLocal: boolean; unpinVoyager: boolean }) => void;
    onCancel?: () => void;
    title?: string;
    showOptions?: boolean;
    children?: import('svelte').Snippet;
  }

  let { 
    isOpen = false, 
    onConfirm = () => {}, 
    onCancel = () => {}, 
    title = "",
    showOptions = false,
    children
  }: Props = $props();

  let dropLocal = $state(true);
  let unpinVoyager = $state(true);

  function handleConfirm() {
    onConfirm({ dropLocal, unpinVoyager });
  }

  $effect(() => {
    if (isOpen) {
      // Reset checkboxes when modal opens
      dropLocal = true;
      unpinVoyager = true;
    }
  });
</script>

<div class:hidden={!isOpen} class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg w-full {$isRTL ? 'rtl' : 'ltr'}">
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h2>
    
    <div class="space-y-4">
      {#if children}
        {@render children()}
      {/if}

      {#if showOptions}
        <div class="space-y-2">
          <div class="flex items-center {$isRTL ? 'space-x-reverse' : 'space-x-2'}">
            <input 
              type="checkbox" 
              id="dropLocal" 
              bind:checked={dropLocal}
              class="rounded border-gray-300"
            >
            <label for="dropLocal" class="text-gray-700 dark:text-gray-300">
              {$_('drop_local_database_copies')}
            </label>
          </div>
          
          <div class="flex items-center {$isRTL ? 'space-x-reverse' : 'space-x-2'}">
            <input 
              type="checkbox" 
              id="unpinVoyager" 
              bind:checked={unpinVoyager}
              class="rounded border-gray-300"
            >
            <label for="unpinVoyager" class="text-gray-700 dark:text-gray-300">
              {$_('unpin_from_voyager_node')}
            </label>
          </div>
        </div>
      {/if}

      <div class="flex {$isRTL ? 'space-x-reverse' : 'space-x-4'} mt-4">
        <button 
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          onclick={handleConfirm}
        >
          {$_('confirm')}
        </button>
        <button 
          class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          onclick={onCancel}
        >
          {$_('cancel')}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  /* RTL specific styles */
  :global([dir="rtl"]) .flex {
    flex-direction: row-reverse;
  }

  :global([dir="rtl"]) .space-x-2 > * + * {
    margin-right: 0.5rem;
    margin-left: 0;
  }

  :global([dir="rtl"]) .space-x-4 > * + * {
    margin-right: 1rem;
    margin-left: 0;
  }
</style> 