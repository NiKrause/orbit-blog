<script lang="ts">
  interface Props {
    isOpen?: boolean;
    onConfirm?: (options: { dropLocal: boolean; unpinVoyager: boolean }) => void;
    onCancel?: () => void;
    title?: string;
    showOptions?: boolean;
  }

  let { 
    isOpen = false, 
    onConfirm = () => {}, 
    onCancel = () => {}, 
    title = "",
    showOptions = false 
  }: Props = $props();

  let dropLocal = true;
  let unpinVoyager = true;

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
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg w-full">
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h2>
    
    <div class="space-y-4">
      <slot />

      {#if showOptions}
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="dropLocal" 
              bind:checked={dropLocal}
              class="rounded border-gray-300"
            >
            <label for="dropLocal" class="text-gray-700 dark:text-gray-300">
              Drop local database copies
            </label>
          </div>
          
          <div class="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="unpinVoyager" 
              bind:checked={unpinVoyager}
              class="rounded border-gray-300"
            >
            <label for="unpinVoyager" class="text-gray-700 dark:text-gray-300">
              Unpin from Voyager node
            </label>
          </div>
        </div>
      {/if}

      <div class="flex space-x-4 mt-4">
        <button 
          class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          on:click={handleConfirm}
        >
          Confirm
        </button>
        <button 
          class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          on:click={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
</div> 