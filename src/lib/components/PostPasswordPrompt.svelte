<script lang="ts">
  import { preventDefault } from 'svelte/legacy';
  import { _ } from 'svelte-i18n';
  import { createEventDispatcher } from 'svelte';
  import { decryptPost } from '$lib/cryptoUtils';

  interface Props {
    post: {
      title: string;
      content: string;
    };
    mode: 'encrypt' | 'decrypt';
  }
  $effect(() => {
    console.log('post',post);
    console.log('mode', mode);
  });
  let { post, mode }: Props = $props();
  console.log('post', post);
  console.log('mode', mode);
  const dispatch = createEventDispatcher();
   
  let password = $state('');
  let errorMessage = $state('');
  let isProcessing = $state(false);
  
  async function handleSubmit() {
    errorMessage = '';
    isProcessing = true;
    
    try {
      if (mode === 'decrypt') {
        console.log('decrypting post', post, password);
        const decryptedPost = await decryptPost(post, password);
        dispatch('postDecrypted', { post: decryptedPost });
      } else {
        console.log('encrypting post submitted password', password);
        // For encryption, just pass the password back
        dispatch('passwordSubmitted', { password });
      }
    } catch (error) {
      errorMessage = mode === 'decrypt' ? $_('invalid_password') : $_('encryption_failed');
      isProcessing = false;
    }
  }
</script>

<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
    <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">
      {mode === 'decrypt' ? $_('enter_password_to_view') : $_('enter_password_to_encrypt')}
    </h2>
    
    <p class="mb-4 text-gray-700 dark:text-gray-300">
      {mode === 'decrypt' ? $_('enter_password_explanation') : $_('enter_encryption_password_explanation')}
    </p>
    
    <form onsubmit={preventDefault(handleSubmit)} class="space-y-4">
      <div>
        <label class="block text-gray-700 dark:text-gray-300 mb-1">{$_('password')}</label>
        <input 
          type="password" 
          bind:value={password}
          class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          placeholder={$_('enter_your_password')}
          autocomplete={mode === 'decrypt' ? 'current-password' : 'new-password'}
          autofocus
        />
      </div>
      
      {#if errorMessage}
        <div class="text-red-500">{errorMessage}</div>
      {/if}
      
      <div class="flex justify-end space-x-4">
        <button
          type="button"
          class="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          onclick={() => {
            console.log('cancel');
            password = '';
            errorMessage = '';
            isProcessing = false;
            dispatch('cancel');
          }}
        >
          {$_('cancel')}
        </button>
        <button
          type="submit"
          disabled={isProcessing}
          class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {isProcessing ? $_('processing') : mode === 'decrypt' ? $_('unlock') : $_('encrypt')}
        </button>
      </div>
    </form>
  </div>
</div> 