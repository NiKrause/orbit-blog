<script lang="ts">

  import { generateMnemonic } from 'bip39'
  import { settingsDB, blogName, blogDescription, postsDBAddress } from './store';

  let seedPhrase = localStorage.getItem('seedPhrase') || generateMnemonic() //please don't put the seedphrase in the db
  let persistentSeedPhrase = localStorage.getItem('seedPhrase')?true:false;
  $: localStorage.setItem('seedPhrase', seedPhrase);
  $: (!persistentSeedPhrase)?localStorage.removeItem('seedPhrase'):null;
</script>

<div class="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
  <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Settings</h2>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Blog Name</label>
    <input type="text" class="w-full p-2 border rounded" 
        value={$blogName} on:input={ event => $settingsDB?.put({ _id: 'blogName', value: event.target.value })}
      />
  </div>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Blog Description</label>
      <input type="text" class="w-full p-2 border rounded" value={$blogDescription} on:input={ event => $settingsDB?.put({ _id: 'blogDescription', value: event.target.value })}/>
  </div>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Seed Phrase</label>
    <div class="flex items-center">
      <input type="text" class="w-full p-2 border rounded" bind:value={seedPhrase} />
      <label class="ml-2 text-gray-700 dark:text-gray-300">
        <input type="checkbox" bind:checked={persistentSeedPhrase} class="mr-1" />
        {persistentSeedPhrase ? 'Persistent' : 'Temporary'}
      </label>
    </div>
  </div>
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Posts DB Address</label>
    <input type="text" class="w-full p-2 border rounded" value={$postsDBAddress} readonly />
    <button class="bg-blue-500 text-white p-2 rounded" on:click={() => {
        $settingsDB?.put({ _id: 'postsDBAddress', value: $postsDBAddress })
        console.log('stored postsDBAddress in settingsDB', $postsDBAddress)
        $settingsDB?.all().then(contents => {
          console.log('contents', contents)
        })
      }}>Store Posts DB Address</button>
  </div>
</div>

<style>
  /* Add any additional styles here */
</style> 