<script lang="ts">
  import { settings, persistentSeedPhrase } from './store';
  import { updateSettings } from './orbitdb';
</script>

<div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
  <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Settings</h2>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Blog Name</label>
    <input type="text" class="w-full p-2 border rounded" bind:value={$settings.blogName} on:input={(e) => updateSettings('blogName', e.target.value)} />
  </div>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Blog Description</label>
    <input type="text" class="w-full p-2 border rounded" bind:value={$settings.blogDescription} on:input={(e) => updateSettings('blogDescription', e.target.value)} />
  </div>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Seed Phrase</label>
    <div class="flex items-center">
      <input type="text" class="w-full p-2 border rounded" bind:value={$settings.seedPhrase} on:input={(e) => updateSettings('seedPhrase', e.target.value)} />
      <label class="ml-2 text-gray-700 dark:text-gray-300">
        <input type="checkbox" bind:checked={$persistentSeedPhrase} class="mr-1" />
        Persistent
      </label>
    </div>
  </div>
</div>

<style>
  /* Add any additional styles here */
</style> 