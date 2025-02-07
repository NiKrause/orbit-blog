<script>
  export let isOpen = false;
  export let onClose = () => {};
</script>

{#if isOpen}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-lg w-full">
      <button class="absolute top-2 right-2 text-gray-500 hover:text-gray-700" on:click={onClose}>
        &times;
      </button>
      <slot></slot>
    </div>
  </div>
{/if}

<style>
  /* Add any additional styles here */
</style> 