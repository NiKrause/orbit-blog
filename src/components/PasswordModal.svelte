<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { encryptSeedPhrase, decryptSeedPhrase } from '../lib/cryptoUtils';
  
  export let isNewUser = false;
  export let encryptedSeedPhrase: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  let password = '';
  let confirmPassword = '';
  let errorMessage = '';
  let isProcessing = false;
  
  async function handleSubmit() {
    errorMessage = '';
    isProcessing = true;
    
    try {
      if (isNewUser) {
        if (password.length < 8) {
          errorMessage = 'Password must be at least 8 characters long';
          isProcessing = false;
          return;
        }
        
        if (password !== confirmPassword) {
          errorMessage = 'Passwords do not match';
          isProcessing = false;
          return;
        }
        
        // Generate new seed phrase and encrypt it
        dispatch('seedPhraseCreated', { password });
      } else {
        // Try to decrypt existing seed phrase
        if (!encryptedSeedPhrase) {
          errorMessage = 'No encrypted seed phrase found';
          isProcessing = false;
          return;
        }
        
        try {
          const decryptedSeedPhrase = await decryptSeedPhrase(encryptedSeedPhrase, password);
          dispatch('seedPhraseDecrypted', { seedPhrase: decryptedSeedPhrase });
        } catch (error) {
          errorMessage = 'Invalid password. Please try again.';
          isProcessing = false;
        }
      }
    } catch (error) {
      console.error('Password processing error:', error);
      errorMessage = 'An error occurred. Please try again.';
      isProcessing = false;
    }
  }
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">
      {isNewUser ? 'Create Password & Generate Seed Phrase' : 'Enter Password & Decrypt Seed Phrase'} ( {__APP_VERSION__} )
    </h2>
    
    <p class="mb-4 text-gray-700 dark:text-gray-300">
      {isNewUser 
        ? 'Please create a password to encrypt a newly generated a new seed phrase. You will need this password to access your blog in the future. The password is not transmitted over the network. You can switch off the network to proof that the password is not transmitted.'
        : 'Please enter your password to decrypt your seed phrase in order to activate your identity. The password is not transmitted over the network. You can switch off the network to proof that the password is not transmitted.'}
    </p>
    
    <form on:submit|preventDefault={handleSubmit} class="space-y-4">
      <div>
        <label class="block text-gray-700 dark:text-gray-300 mb-1">Password</label>
        <input 
          type="password" 
          bind:value={password}
          class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder="Enter your password"
          autocomplete="current-password"
          autofocus
        />
      </div>
      
      {#if isNewUser}
        <div>
          <label class="block text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
          <input 
            type="password" 
            bind:value={confirmPassword}
            class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="Confirm your password"
            autocomplete="new-password"
          />
        </div>
      {/if}
      
      {#if errorMessage}
        <div class="text-red-500">{errorMessage}</div>
      {/if}
      
      <div class="flex justify-end">
        <button 
          type="submit"
          class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : isNewUser ? 'Create' : 'Unlock'}
        </button>
      </div>
    </form>
  </div>
</div> 