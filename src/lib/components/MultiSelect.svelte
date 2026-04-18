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
    class="min-h-[42px] w-full px-3 py-2 border rounded-md cursor-pointer flex flex-wrap gap-1 items-center"
    style="background-color: var(--bg-secondary); border-color: var(--border); color: var(--text);"
    role="button"
    tabindex="0"
    aria-expanded="{isOpen}"
    aria-haspopup="listbox"
    onclick={() => isOpen = !isOpen}
    onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen = !isOpen; } }}
  >
    {#if values.length === 0}
      <span style="color: var(--text-muted);">{placeholder}</span>
    {:else}
      {#each values as value}
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium" style="background-color: var(--bg-tertiary); color: var(--text);">
          {value}
          <button
            type="button"
            class="ml-1 hover:text-opacity-80"
            style="color: var(--accent);"
            onclick={(e) => { e.stopPropagation(); removeOption(value); }}
          >
            ×
          </button>
        </span>
      {/each}
    {/if}
    
    <!-- Dropdown arrow -->
    <svg 
      class="ml-auto h-4 w-4 transition-transform {isOpen ? 'rotate-180' : ''}" 
      style="color: var(--text-muted);"
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
    </svg>
  </div>
  
  <!-- Dropdown menu -->
  {#if isOpen}
    <div class="absolute z-10 w-full mt-1 rounded-md shadow-lg max-h-60 overflow-auto"
      style="background-color: var(--bg-secondary); border: 1px solid var(--border); color: var(--text);"
    >
      <!-- Search input -->
      <div class="p-2" style="border-bottom: 1px solid var(--border);">
        <input
          type="text"
          bind:value={searchTerm}
          placeholder="Search options..."
          class="w-full px-2 py-1 text-sm rounded"
          style="background-color: var(--bg); border: 1px solid var(--border); color: var(--text);"
        />
      </div>
      
      <!-- Options list -->
      <div class="py-1">
        {#each filteredOptions as option}
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm focus:outline-none multiselect-option"
            style="color: var(--text);"
            onclick={() => toggleOption(option)}
          >
            {option}
          </button>
        {/each}
        
        {#if filteredOptions.length === 0}
          <div class="px-3 py-2 text-sm" style="color: var(--text-secondary);">
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

  .multiselect-option {
    background-color: transparent;
    transition: background-color 0.15s ease;
  }

  .multiselect-option:hover,
  .multiselect-option:focus {
    background-color: var(--bg-hover);
  }
</style>
