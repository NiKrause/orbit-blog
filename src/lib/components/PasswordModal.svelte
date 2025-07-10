<script lang="ts">
  import { preventDefault } from 'svelte/legacy';
  import { _ } from 'svelte-i18n';

  import { createEventDispatcher } from 'svelte';
  import { encryptSeedPhrase, decryptSeedPhrase } from '$lib/cryptoUtils';
  
  interface Props {
    isNewUser?: boolean;
    encryptedSeedPhrase?: string | null;
  }

  let { isNewUser = false, encryptedSeedPhrase = null }: Props = $props();
  
  const dispatch = createEventDispatcher();
  
  let password = $state('');
  let confirmPassword = $state('');
  let errorMessage = $state('');
  let isProcessing = $state(false);
  
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
    } catch (_error) {
      console.error('Password processing error:', _error);
      errorMessage = 'An error occurred. Please try again.';
      isProcessing = false;
    }
  }
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
    <span class="relative top-0 right-0 text-xs text-gray-500">Le SpaceDB Blog v{__APP_VERSION__}</span>
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white relative">
      {isNewUser ? $_('create_password_generate_seed_phrase') : $_('enter_password_decrypt_seed')}
 
    </h2>
    
    <p class="mb-4 text-gray-700 dark:text-gray-300">
      {isNewUser
        ? $_('create_password_explanation')
        : $_('enter_password_explanation')}
    </p>
    
    <form onsubmit={preventDefault(handleSubmit)} class="space-y-4">
      <div>
        <label for="password-input" class="block text-gray-700 dark:text-gray-300 mb-1">{$_('password')}</label>
        <input 
          id="password-input"
          type="password" 
          bind:value={password}
          class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder={$_('enter_your_password')}
          autocomplete="current-password"
        />
      </div>
      
      {#if isNewUser}
        <div>
          <label for="confirm-password-input" class="block text-gray-700 dark:text-gray-300 mb-1">{$_('confirm_password')}</label>
          <input 
            id="confirm-password-input"
            type="password" 
            bind:value={confirmPassword}
            class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder={$_('confirm_your_password')}
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
          {isProcessing ? $_('processing') : isNewUser ? $_('create') : $_('unlock')}
        </button>
      </div>
    </form>
  </div>
</div> 