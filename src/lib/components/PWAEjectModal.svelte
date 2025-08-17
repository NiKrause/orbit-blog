<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { ejectPWA, getStorageEstimate } from '$lib/utils/pwaEject.js';
  import { info } from '$lib/utils/logger.js';

  const dispatch = createEventDispatcher();

  let isEjecting = $state(false);
  let ejectProgress = $state('');
  let storageEstimate = $state<StorageEstimate | null>(null);
  
  let selectedOptions = $state({
    clearServiceWorker: true,
    clearIndexedDB: true,
    clearLocalStorage: true,
    clearOrbitDB: true,
    clearHelia: true
  });

  // Load storage estimate on mount
  $effect(() => {
    getStorageEstimate().then(estimate => {
      storageEstimate = estimate;
    });
  });

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async function handleEject() {
    if (!confirm($_('eject_final_confirmation'))) {
      return;
    }
    
    isEjecting = true;
    ejectProgress = $_('eject_starting');
    
    try {
      // Add progress tracking
      const progressSteps = [
        $_('eject_clearing_service_worker'),
        $_('eject_clearing_databases'),
        $_('eject_clearing_local_storage'),
        $_('eject_clearing_orbit_data'),
        $_('eject_clearing_ipfs_data')
      ];

      let stepIndex = 0;
      const progressInterval = setInterval(() => {
        if (stepIndex < progressSteps.length) {
          ejectProgress = progressSteps[stepIndex];
          stepIndex++;
        }
      }, 800);

      await ejectPWA(selectedOptions);
      
      clearInterval(progressInterval);
      ejectProgress = $_('eject_complete');
      
      // The ejectPWA function will reload the page
    } catch (error) {
      console.error('Eject failed:', error);
      ejectProgress = $_('eject_failed') + ': ' + error.message;
      isEjecting = false;
    }
  }

  function handleCancel() {
    dispatch('close');
  }
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
    <div class="p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center space-x-3">
          <div class="flex-shrink-0">
            <!-- Eject icon -->
            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M7 11l5-5m0 0l5 5m-5-5v12"/>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {$_('eject_pwa_title')}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {$_('eject_pwa_subtitle')}
            </p>
          </div>
        </div>
        
        {#if !isEjecting}
          <button
            onclick={handleCancel}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={$_('close')}
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        {/if}
      </div>

      {#if isEjecting}
        <!-- Progress display -->
        <div class="text-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p class="text-gray-700 dark:text-gray-300 font-medium">{ejectProgress}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {$_('eject_please_wait')}
          </p>
        </div>
      {:else}
        <!-- Main content -->
        <div class="space-y-6">
          <!-- Warning -->
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800 dark:text-red-200">
                  {$_('eject_warning_title')}
                </h3>
                <div class="mt-2 text-sm text-red-700 dark:text-red-300">
                  <ul class="list-disc pl-5 space-y-1">
                    <li>{$_('eject_warning_data')}</li>
                    <li>{$_('eject_warning_posts')}</li>
                    <li>{$_('eject_warning_settings')}</li>
                    <li>{$_('eject_warning_media')}</li>
                    <li>{$_('eject_warning_irreversible')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <!-- Storage info -->
          {#if storageEstimate}
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                {$_('storage_usage')}
              </h4>
              <div class="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                {#if storageEstimate.usage}
                  <p>{$_('current_usage')}: <span class="font-mono">{formatBytes(storageEstimate.usage)}</span></p>
                {/if}
                {#if storageEstimate.quota}
                  <p>{$_('storage_quota')}: <span class="font-mono">{formatBytes(storageEstimate.quota)}</span></p>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Options -->
          <div>
            <h4 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {$_('eject_options')}
            </h4>
            <div class="space-y-3">
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={selectedOptions.clearServiceWorker}
                  class="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {$_('eject_clear_service_worker')}
                </span>
              </label>
              
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={selectedOptions.clearIndexedDB}
                  class="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {$_('eject_clear_indexed_db')}
                </span>
              </label>
              
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={selectedOptions.clearLocalStorage}
                  class="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {$_('eject_clear_local_storage')}
                </span>
              </label>
              
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={selectedOptions.clearOrbitDB}
                  class="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {$_('eject_clear_orbit_db')}
                </span>
              </label>
              
              <label class="flex items-center">
                <input 
                  type="checkbox" 
                  bind:checked={selectedOptions.clearHelia}
                  class="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {$_('eject_clear_helia_data')}
                </span>
              </label>
            </div>
          </div>

          <!-- Backup suggestion -->
          <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>{$_('backup_recommendation')}:</strong> {$_('backup_recommendation_text')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onclick={handleCancel}
            class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            {$_('cancel')}
          </button>
          <button
            onclick={handleEject}
            class="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            {$_('eject_pwa_confirm')}
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
