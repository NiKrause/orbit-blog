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

<div class:hidden={!isOpen} class="fixed inset-0 flex justify-center items-center z-50" style="background-color: rgba(0,0,0,0.5); backdrop-filter: blur(4px);">
  <div class="card p-5 max-w-lg w-full mx-4 {$isRTL ? 'rtl' : 'ltr'}">
    <h2 class="text-lg font-semibold mb-3" style="color: var(--text);">{title}</h2>
    
    <div class="space-y-3">
      {#if children}
        {@render children()}
      {/if}

      {#if showOptions}
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="dropLocal" bind:checked={dropLocal} class="rounded" style="accent-color: var(--accent);">
            <span class="text-sm" style="color: var(--text-secondary);">{$_('drop_local_database_copies')}</span>
          </label>
          
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" id="unpinVoyager" bind:checked={unpinVoyager} class="rounded" style="accent-color: var(--accent);">
            <span class="text-sm" style="color: var(--text-secondary);">{$_('unpin_from_voyager_node')}</span>
          </label>
        </div>
      {/if}

      <div class="flex gap-3 mt-4">
        <button class="btn-danger" onclick={handleConfirm}>{$_('confirm')}</button>
        <button class="btn-ghost" onclick={onCancel}>{$_('cancel')}</button>
      </div>
    </div>
  </div>
</div>

<style>
  :global([dir="rtl"]) .flex { flex-direction: row-reverse; }
</style> 
