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

<div class="fixed inset-0 flex items-center justify-center z-50" style="background-color: rgba(0,0,0,0.6); backdrop-filter: blur(8px);">
  <div class="card p-6 max-w-md w-full mx-4">
    <span class="text-xs" style="color: var(--text-muted);">Le SpaceDB Blog v{__APP_VERSION__}</span>
    <h2 class="text-lg font-semibold mt-2 mb-2" style="color: var(--text);">
      {isNewUser ? $_('create_password_generate_seed_phrase') : $_('enter_password_decrypt_seed')}
    </h2>
    
    <p class="text-sm mb-4" style="color: var(--text-secondary);">
      {isNewUser ? $_('create_password_explanation') : $_('enter_password_explanation')}
    </p>
    
    <form onsubmit={preventDefault(handleSubmit)} class="space-y-4">
      <div>
        <label for="password-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('password')}</label>
        <input id="password-input" type="password" bind:value={password} class="input" placeholder={$_('enter_your_password')} autocomplete="current-password" />
      </div>
      
      {#if isNewUser}
        <div>
          <label for="confirm-password-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('confirm_password')}</label>
          <input id="confirm-password-input" type="password" bind:value={confirmPassword} class="input" placeholder={$_('confirm_your_password')} autocomplete="new-password" />
        </div>
      {/if}
      
      {#if errorMessage}
        <div class="text-xs" style="color: var(--danger);">{errorMessage}</div>
      {/if}
      
      <div class="flex justify-end">
        <button type="submit" class="btn-primary" disabled={isProcessing}>
          {isProcessing ? $_('processing') : isNewUser ? $_('create') : $_('unlock')}
        </button>
      </div>
    </form>
  </div>
</div> 
