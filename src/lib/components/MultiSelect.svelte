<script lang="ts">
  interface Props {
    values?: string[];
    options?: string[];
    placeholder?: string;
    id?: string;
  }
  
  let { values = $bindable([]), options = [], placeholder = 'Select options...', id = '' }: Props = $props();
  
  let isOpen = $state(false);
  let searchTerm = $state('');
  
  let filteredOptions = $derived(options.filter(option => 
    option.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !values.includes(option)
  ));
  
  function toggleOption(option: string) {
    if (values.includes(option)) {
      values = values.filter(v => v !== option);
    } else {
      values = [...values, option];
    }
  }
  
  function removeOption(option: string) {
    values = values.filter(v => v !== option);
  }
  
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.multiselect-container')) {
      isOpen = false;
    }
  }
</script>

<svelte:document on:click={handleClickOutside} />

<div class="multiselect-container relative" {id}>
  <!-- Selected values display -->
  <div 
    class="min-h-[42px] w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer flex flex-wrap gap-1 items-center"
    onclick={() => isOpen = !isOpen}
  >
    {#if values.length === 0}
      <span class="text-gray-500 dark:text-gray-400">{placeholder}</span>
    {:else}
      {#each values as value}
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100">
          {value}
          <button
            type="button"
            class="ml-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-200 dark:hover:text-white"
            onclick={(e) => { e.stopPropagation(); removeOption(value); }}
          >
            ×
          </button>
        </span>
      {/each}
    {/if}
    
    <!-- Dropdown arrow -->
    <svg 
      class="ml-auto h-4 w-4 text-gray-400 dark:text-gray-300 transition-transform {isOpen ? 'rotate-180' : ''}" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </div>
  
  <!-- Dropdown menu -->
  {#if isOpen}
    <div class="absolute z-10 w-full mt-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
      <!-- Search input -->
      <div class="p-2 border-b border-gray-200 dark:border-gray-600">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder="Search options..."
          class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      
      <!-- Options list -->
      <div class="py-1">
        {#each filteredOptions as option}
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-600"
            onclick={() => toggleOption(option)}
          >
            {option}
          </button>
        {/each}
        
        {#if filteredOptions.length === 0}
          <div class="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'No matching options' : 'All options selected'}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .multiselect-container {
    position: relative;
  }
</style>
