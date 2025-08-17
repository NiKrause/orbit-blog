<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { preventDefault } from 'svelte/legacy';
  import { settingsDB, profilePictureCid, blogName, blogDescription, categories, seedPhrase, libp2p, orbitdb, enabledLanguages, aiApiKey, aiApiUrl, identity, isRTL, mediaDB, helia } from '../store.js';
  import { encryptSeedPhrase } from '../cryptoUtils.js';
  import { LANGUAGES } from '../i18n/index.js';
  import { unixfs, type UnixFS } from '@helia/unixfs';
  import { onMount, onDestroy } from 'svelte';
  import { getImageUrlFromHelia, revokeImageUrl } from '../utils/mediaUtils.js';
  import { info, debug, error } from '../utils/logger.js'
  let persistentSeedPhrase = false; // Default to true since we're always encrypting now
  let showChangePasswordModal = $state(false);
  let newPassword = $state('');
  let confirmNewPassword = $state('');
  let errorMessage = $state('');
  let successMessage = $state('');
  let showSeedPhrase = $state(false); // State to toggle visibility
  let newCategory = $state(''); // For adding new categories
  let peerId = $libp2p?.peerId?.toString();
  let did = $orbitdb?.identity?.id;

  // Add accordion state
  let openSections = $state({
    languages: false,
    blogSettings: false,
    categories: false,
    identity: false,
    security: false,
    aiSettings: false
  });

  
  let uploading = $state(false);
  let fs: UnixFS = $state(); // UnixFS instance

  onMount(async () => {
    info('Component mounted, checking for existing profile picture');
    if ($settingsDB) {
      const result = await $settingsDB.get('profilePicture');
      info('Retrieved profile picture from settings:', result);
      if (result?.value?.value) {
        $profilePictureCid = result.value.value;
        info('Set profile picture CID from settings:', $profilePictureCid);
      }
    } else {
      info('SettingsDB not initialized during mount');
    }
    
    if ($helia) {
      fs = unixfs($helia as any);
      info('UnixFS initialized during mount');
    } else {
      info('Helia not initialized during mount');
    }
  });

  function toggleSection(section: keyof typeof openSections) {
    openSections[section] = !openSections[section];
  }

  // Function to toggle language
  function toggleLanguage(lang: string) {
    if ($enabledLanguages.includes(lang)) {
      $enabledLanguages = $enabledLanguages.filter((l: string) => l !== lang);
    } else {
      $enabledLanguages = [...$enabledLanguages, lang];
    }
  }

  async function changePassword() {
    errorMessage = '';
    successMessage = '';
    
    if (!$seedPhrase) {
      errorMessage = $_('no_seed_phrase_available');
      return;
    }
    
    if (newPassword.length < 8) {
      errorMessage = $_('password_min_length');
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      errorMessage = $_('passwords_do_not_match');
      return;
    }
    
    try {
      const encryptedPhrase = await encryptSeedPhrase($seedPhrase, newPassword);
      localStorage.setItem('encryptedSeedPhrase', encryptedPhrase);
      successMessage = $_('password_changed_successfully');
      setTimeout(() => {
        showChangePasswordModal = false;
        successMessage = '';
      }, 2000);
    } catch (error) {
      error('Error changing password:', error);
      errorMessage = $_('failed_to_change_password');
    }
  }

  function toggleSeedVisibility() {
    showSeedPhrase = !showSeedPhrase;
  }

  function addCategory() {
    if (newCategory.trim() && !$categories.includes(newCategory.trim())) {
      $categories = [...$categories, newCategory.trim()];
      $settingsDB?.put({ _id: 'categories', value: $categories });
      //log the settingsDB address
      debug('settingsDB address', $settingsDB?.address.toString())
      newCategory = '';
    }
  }

  function removeCategory(category: string) {
    $categories = $categories.filter(c => c !== category);
    $settingsDB?.put({ _id: 'categories', value: $categories });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      info('Text copied to clipboard:', text);
    }).catch(err => {
      console.error('Error copying text to clipboard:', err);
    });
  }

  async function handleProfilePictureUpload(event) {
    const file = event.target.files[0];
    info('File selected:', file);

    if (!file || !file.type.startsWith('image/')) {
      errorMessage = $_('please_select_image');
      info('Invalid file type or no file selected');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      errorMessage = $_('image_too_large');
      info('File too large:', file.size);
      return;
    }

    if (!$mediaDB || !$helia) {
      errorMessage = $_('media_db_not_initialized');
      info('MediaDB or Helia not initialized:', { mediaDB: !!$mediaDB, helia: !!$helia });
      return;
    }

    if (!fs) {
      fs = unixfs($helia as any);
      info('UnixFS initialized');
    }

    uploading = true;
    errorMessage = '';

    try {
      // Read file as arrayBuffer
      const buffer = await file.arrayBuffer();
      const fileBytes = new Uint8Array(buffer);
      info('File read as bytes, size:', fileBytes.length);

      // Add to IPFS
      const cid = await fs.addBytes(fileBytes);
      info('File added to IPFS, CID:', cid.toString());

      // Store metadata in OrbitDB
      const mediaId = crypto.randomUUID();
      await $mediaDB.put({
        _id: mediaId,
        name: file.name,
        type: file.type,
        size: file.size,
        cid: cid.toString(),
        createdAt: new Date().toISOString()
      });
      info('Media metadata stored in OrbitDB:', mediaId);

      // Store profile picture reference in settings
      await $settingsDB.put({ _id: 'profilePicture', value: cid.toString() });
      info('Profile picture CID stored in settings:', cid.toString());
      
      $profilePictureCid = cid.toString();
      info('Profile picture CID updated in component state:', $profilePictureCid);
    } catch (error) {
      error('Error uploading profile picture:', error);
      errorMessage = error.message || $_('failed_to_upload');
    } finally {
      uploading = false;
    }
  }

  onDestroy(() => {
    if ($profilePictureCid) {
      getImageUrlFromHelia($profilePictureCid, fs).then(url => {
        if (url) revokeImageUrl(url);
      });
    }
  });
</script>

<div class="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 {$isRTL ? 'rtl' : 'ltr'}" data-testid="settings-container">
  <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white" data-testid="settings-title">{$_('settings')}</h2>
  
  <!-- Blog Settings Accordion -->
  <div class="mb-2 border rounded-lg overflow-hidden">
    <button 
      class="w-full p-4 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
      onclick={() => toggleSection('blogSettings')}
      data-testid="blog-settings-accordion"
    >
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
          <path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" />
        </svg>
        <span class="font-semibold text-gray-900 dark:text-white">{$_('blog_settings')}</span>
      </div>
      <span class="transform transition-transform duration-200 text-gray-900 dark:text-white" class:rotate-180={openSections.blogSettings}>▼</span>
    </button>
    {#if openSections.blogSettings}
      <div class="p-4 border-t">
        <div class="flex items-start space-x-4">
          <!-- Profile Picture Section -->
          <div class="flex flex-col items-center space-y-2">
            <div class="w-32 h-32 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 relative">
              {#await getImageUrlFromHelia($profilePictureCid, fs)}
                <div class="w-full h-full flex items-center justify-center">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                </div>
              {:then imageUrl}
                {#if imageUrl}
                  <img 
                    src={imageUrl}
                    alt="Profile" 
                    class="w-full h-full object-cover"
                    onload={() => {
                      console.log('Image loaded successfully from Helia');
                    }}
                  />
                {:else}
                  <div class="w-full h-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                    </svg>
                  </div>
                {/if}
              {:catch error}
                <div class="w-full h-full flex items-center justify-center text-red-500">
                  <span class="text-sm">Error loading image</span>
                </div>
              {/await}
            </div>
            <input
              type="file"
              id="profile-picture"
              class="hidden"
              accept="image/*"
              onchange={handleProfilePictureUpload}
            />
            <label
              for="profile-picture"
              class="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-1 px-3 rounded transition-colors"
            >
              {$profilePictureCid ? $_('change_picture') : $_('upload_picture')}
            </label>
            {#if errorMessage}
              <p class="text-red-500 text-sm">{errorMessage}</p>
            {/if}
          </div>

          <!-- Blog Info Section -->
          <div class="flex-1 space-y-4">
            <div>
              <label for="blog-name-input" class="block text-gray-700 dark:text-gray-300">{$_('blog_name')}</label>
              <input 
                id="blog-name-input"
                type="text" 
                class="w-full p-2 border rounded" 
                value={$blogName} 
                data-testid="blog-name-input"
                onchange={(event: Event) => {
                  const target = event.target as HTMLInputElement;
                  $settingsDB?.put({ _id: 'blogName', value: target.value })
                }}
              />
            </div>
            <div>
              <label for="blog-description-input" class="block text-gray-700 dark:text-gray-300">{$_('blog_description')}</label>
              <input 
                id="blog-description-input"
                type="text" 
                class="w-full p-2 border rounded" 
                value={$blogDescription} 
                data-testid="blog-description-input"
                onchange={(event: Event) => {
                  const target = event.target as HTMLInputElement;
                  $settingsDB?.put({ _id: 'blogDescription', value: target.value })
                }}
              />
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Language Settings Accordion -->
  <div class="mb-2 border rounded-lg overflow-hidden">
    <button 
      class="w-full p-4 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
      onclick={() => toggleSection('languages')}
      ontouchend={(e) => {e.preventDefault(); toggleSection('languages')}}
    >
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389 21.034 21.034 0 01-.554-.6 19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" clip-rule="evenodd" />
        </svg>
        <span class="font-semibold text-gray-900 dark:text-white">{$_('enabled_languages')}</span>
      </div>
      <span class="transform transition-transform duration-200 text-gray-900 dark:text-white" class:rotate-180={openSections.languages}>▼</span>
    </button>
    {#if openSections.languages}
      <div class="p-4 border-t">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          {#each Object.entries(LANGUAGES) as [code, name]}
            <label class="flex items-center space-x-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
              <input
                type="checkbox"
                checked={$enabledLanguages.includes(code)}
                onchange={() => toggleLanguage(code)}
                class="form-checkbox h-4 w-4 text-blue-600"
              />
              <span class="text-gray-700 dark:text-gray-300">{name}</span>
            </label>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Categories Accordion -->
  <div class="mb-2 border rounded-lg overflow-hidden">
    <button 
      class="w-full p-4 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
      onclick={() => toggleSection('categories')}
      data-testid="categories"
    >
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
        </svg>
        <span class="font-semibold text-gray-900 dark:text-white">{$_('post_categories')}</span>
      </div>
      <span class="transform transition-transform duration-200 text-gray-900 dark:text-white" class:rotate-180={openSections.categories}>▼</span>
    </button>
    {#if openSections.categories}
      <div class="p-4 border-t">
        <div class="flex mb-2">
          <input
            type="text"
            class="flex-grow p-2 border rounded-l"
            placeholder={$_('new_category')}
            bind:value={newCategory} 
            onkeydown={(event) => event.key === 'Enter' && addCategory()}
            data-testid="new-category-input"
          />
          <button 
            class="bg-blue-500 text-white p-2 rounded-r"
            onclick={addCategory}
            data-testid="add-category-button"
          >
            {$_('add')}
          </button>
        </div>
        <div class="flex flex-wrap gap-2 mt-2">
          {#each $categories as category}
            <div class="bg-gray-200 dark:bg-gray-700 rounded-full px-3 py-1 flex items-center" data-testid="category-item">
              <span class="mr-2">{category}</span>
              <button 
                class="text-red-500 hover:text-red-700"
                onclick={() => removeCategory(category)}
                data-testid="remove-category-button-{category}"
              >
                ×
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Identity Accordion -->
  <div class="mb-2 border rounded-lg overflow-hidden">
    <button 
      class="w-full p-4 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
      onclick={() => toggleSection('identity')}
    >
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 4h3a3 3 0 006 0h3a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2.5 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm2.45 4a2.5 2.5 0 10-4.9 0h4.9zM12 9a1 1 0 100 2h3a1 1 0 100-2h-3zm-1 4a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" clip-rule="evenodd" />
        </svg>
        <span class="font-semibold text-gray-900 dark:text-white">{$_('identity')}</span>
      </div>
      <span class="transform transition-transform duration-200 text-gray-900 dark:text-white" class:rotate-180={openSections.identity}>▼</span>
    </button>
    {#if openSections.identity}
      <div class="p-4 border-t">
        <div class="flex items-center space-x-2">
          <span class="text-gray-600 dark:text-gray-400">{$_('did')}:</span>
          <input
            type="text"
            size={60}
            readonly
            value={did}
            class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm"
          />
          <button onclick={() => copyToClipboard(did)} class="text-gray-500 hover:text-gray-700">
            📋
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Security Settings Accordion -->
  <div class="mb-2 border rounded-lg overflow-hidden">
    <button 
      class="w-full p-4 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
      onclick={() => toggleSection('security')}
    >
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
        </svg>
        <span class="font-semibold text-gray-900 dark:text-white">{$_('security')}</span>
      </div>
      <span class="transform transition-transform duration-200 text-gray-900 dark:text-white" class:rotate-180={openSections.security}>▼</span>
    </button>
    {#if openSections.security}
      <div class="p-4 border-t">
        <label for="seed-phrase-input" class="block text-gray-700 dark:text-gray-300">{$_('seed_phrase')}</label>
        <div class="flex items-center">
          <input id="seed-phrase-input" type="{showSeedPhrase ? 'text' : 'password'}" class="w-full p-2 border rounded" value={$seedPhrase || ''} />
          <button 
            class="ml-2 p-2 rounded"
            onclick={toggleSeedVisibility}
            aria-label={showSeedPhrase ? $_('hide_seed_phrase') : $_('show_seed_phrase')}
            style="background-color: {!showSeedPhrase ? '#4CAF50' : '#f44336'}; color: white;"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </button>
          <button 
            class="ml-2 bg-blue-500 text-white p-2 rounded"
            onclick={() => showChangePasswordModal = true}
          >
            {$_('change_password')}
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- AI Settings Accordion -->
  <div class="mb-2 border rounded-lg overflow-hidden">
    <button 
      class="w-full p-4 text-left bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center"
      onclick={() => toggleSection('aiSettings')}
    >
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10.496 2.132a1 1 0 00-.992 0l-7 4A1 1 0 003 8v7a1 1 0 100 2h14a1 1 0 100-2V8a1 1 0 00.496-1.868l-7-4zM6 9a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1zm3 1a1 1 0 012 0v3a1 1 0 11-2 0v-3zm5-1a1 1 0 00-1 1v3a1 1 0 102 0v-3a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span class="font-semibold text-gray-900 dark:text-white">{$_('ai_translation_settings')}</span>
      </div>
      <span class="transform transition-transform duration-200 text-gray-900 dark:text-white" class:rotate-180={openSections.aiSettings}>▼</span>
    </button>
    {#if openSections.aiSettings}
      <div class="p-4 border-t">
        <div class="space-y-4">
          <div>
            <label for="ai-api-key-input" class="block text-gray-700 dark:text-gray-300">{$_('ai_api_key')}</label>
            <input 
              id="ai-api-key-input"
              type="password" 
              class="w-full p-2 border rounded dark:bg-gray-700" 
              value={$aiApiKey} 
              onchange={(event: Event) => {
                const target = event.target as HTMLInputElement;
                localStorage.setItem('aiApiKey', target.value);
                $aiApiKey = target.value;
              }}
            />
          </div>
          <div>
            <label for="ai-api-url-input" class="block text-gray-700 dark:text-gray-300">{$_('ai_api_url')}</label>
            <input 
              id="ai-api-url-input"
              type="text" 
              class="w-full p-2 border rounded dark:bg-gray-700" 
              value={$aiApiUrl} 
              onchange={(event: Event) => {
                const target = event.target as HTMLInputElement;
                localStorage.setItem('aiApiUrl', target.value);
                $aiApiUrl = target.value;
              }}
            />
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if showChangePasswordModal}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
      <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">{$_('change_password')}</h2>
      
      <form onsubmit={preventDefault(changePassword)} class="space-y-4">
        <div>
          <label for="new-password-input" class="block text-gray-700 dark:text-gray-300 mb-1">{$_('new_password')}</label>
          <input
            id="new-password-input"
            type="password"
            bind:value={newPassword}
            class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder={$_('enter_new_password')}
          />
        </div>
        
        <div>
          <label for="confirm-password-input" class="block text-gray-700 dark:text-gray-300 mb-1">{$_('confirm_new_password')}</label>
          <input
            id="confirm-password-input"
            type="password"
            bind:value={confirmNewPassword}
            class="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder={$_('confirm_new_password_placeholder')}
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
            onclick={() => showChangePasswordModal = false}
          >
            {$_('cancel')}
          </button>
          <button 
            type="submit"
            class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            {$_('change_password')}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .rotate-180 {
    transform: rotate(180deg);
  }

  /* RTL specific styles */
  :global([dir="rtl"]) .flex {
    flex-direction: row-reverse;
  }

  :global([dir="rtl"]) .space-x-2 > * + * {
    margin-right: 0.5rem;
    margin-left: 0;
  }

  :global([dir="rtl"]) .gap-2 > * + * {
    margin-right: 0.5rem;
    margin-left: 0;
  }

  :global([dir="rtl"]) .text-left {
    text-align: right;
  }

</style> 