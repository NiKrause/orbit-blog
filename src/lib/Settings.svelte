<script lang="ts">

  import { generateMnemonic } from 'bip39'
  import { settingsDB, blogName, blogDescription, postsDBAddress, categories } from './store';
  import { encryptSeedPhrase } from './cryptoUtils';

  export let seedPhrase: string | null = localStorage.getItem('seedPhrase') || generateMnemonic();
  
  let persistentSeedPhrase = true; // Default to true since we're always encrypting now
  let showChangePasswordModal = false;
  let newPassword = '';
  let confirmNewPassword = '';
  let errorMessage = '';
  let successMessage = '';
  let showSeedPhrase = false; // State to toggle visibility
  let newCategory = ''; // For adding new categories
  
  async function changePassword() {
    errorMessage = '';
    successMessage = '';
    
    if (!seedPhrase) {
      errorMessage = 'No seed phrase available';
      return;
    }
    
    if (newPassword.length < 8) {
      errorMessage = 'Password must be at least 8 characters long';
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      errorMessage = 'Passwords do not match';
      return;
    }
    
    try {
      const encryptedPhrase = await encryptSeedPhrase(seedPhrase, newPassword);
      localStorage.setItem('encryptedSeedPhrase', encryptedPhrase);
      successMessage = 'Password changed successfully';
      setTimeout(() => {
        showChangePasswordModal = false;
        successMessage = '';
      }, 2000);
    } catch (error) {
      console.error('Error changing password:', error);
      errorMessage = 'Failed to change password';
    }
  }

  function toggleSeedVisibility() {
    showSeedPhrase = !showSeedPhrase;
  }

  function addCategory() {
    if (newCategory.trim() && !$categories.includes(newCategory.trim())) {
      $categories = [...$categories, newCategory.trim()];
      $settingsDB?.put({ _id: 'categories', value: $categories });
      newCategory = '';
    }
  }

  function removeCategory(category: string) {
    $categories = $categories.filter(c => c !== category);
    $settingsDB?.put({ _id: 'categories', value: $categories });
  }
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

  <!-- New categories section -->
  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300 mb-2">Post Categories</label>
    <div class="flex mb-2">
      <input 
        type="text" 
        class="flex-grow p-2 border rounded-l" 
        placeholder="New category" 
        bind:value={newCategory} 
      />
      <button 
        class="bg-blue-500 text-white p-2 rounded-r"
        on:click={addCategory}
      >
        Add
      </button>
    </div>
    <div class="flex flex-wrap gap-2 mt-2">
      {#each $categories as category}
        <div class="bg-gray-200 dark:bg-gray-700 rounded-full px-3 py-1 flex items-center">
          <span class="mr-2">{category}</span>
          <button 
            class="text-red-500 hover:text-red-700"
            on:click={() => removeCategory(category)}
          >
            ×
          </button>
        </div>
      {/each}
    </div>
  </div>

  <div class="mb-4">
    <label class="block text-gray-700 dark:text-gray-300">Seed Phrase (Encrypted and Stored Securely)</label>
    <div class="flex items-center">
      <input type="{showSeedPhrase ? 'text' : 'password'}" class="w-full p-2 border rounded" value={seedPhrase || ''} readonly />
      <button 
        class="ml-2 p-2 rounded"
        on:click={toggleSeedVisibility}
        style="background-color: {!showSeedPhrase ? '#4CAF50' : '#f44336'}; color: white;"
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <!-- Eye Icon -->
          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
        </svg>
      </button>
      <button 
        class="ml-2 bg-blue-500 text-white p-2 rounded"
        on:click={() => showChangePasswordModal = true}
      >
        Change Password
      </button>
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

{#if showChangePasswordModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
      <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Change Password</h2>
      
      <form on:submit|preventDefault={changePassword} class="space-y-4">
        <div>
          <label class="block text-gray-700 dark:text-gray-300 mb-1">New Password</label>
          <input 
            type="password" 
            bind:value={newPassword}
            class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Enter new password"
          />
        </div>
        
        <div>
          <label class="block text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
          <input 
            type="password" 
            bind:value={confirmNewPassword}
            class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Confirm new password"
          />
        </div>
        
        {#if errorMessage}
          <div class="text-red-500">{errorMessage}</div>
        {/if}
        
        {#if successMessage}
          <div class="text-green-500">{successMessage}</div>
        {/if}
        
        <div class="flex justify-end space-x-2">
          <button 
            type="button"
            class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
            on:click={() => showChangePasswordModal = false}
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Change Password
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* Add any additional styles here */
</style> 