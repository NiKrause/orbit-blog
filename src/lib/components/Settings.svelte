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

<div class="card p-5 {$isRTL ? 'rtl' : 'ltr'}" data-testid="settings-container">
  <h2 class="text-lg font-semibold mb-4" style="color: var(--text);" data-testid="settings-title">{$_('settings')}</h2>
  
  <!-- Blog Settings -->
  <div class="settings-section">
    <button class="settings-header" onclick={() => toggleSection('blogSettings')} data-testid="blog-settings-accordion">
      <span class="text-sm font-medium" style="color: var(--text);">{$_('blog_settings')}</span>
      <svg class="w-3 h-3 transition-transform" style="color: var(--text-muted);" class:rotate-180={openSections.blogSettings} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {#if openSections.blogSettings}
      <div class="settings-content">
        <div class="flex items-start gap-4">
          <div class="flex flex-col items-center gap-2">
            <div class="w-20 h-20 rounded-full overflow-hidden flex-shrink-0" style="background-color: var(--bg-tertiary);">
              {#await getImageUrlFromHelia($profilePictureCid, fs)}
                <div class="w-full h-full flex items-center justify-center"></div>
              {:then imageUrl}
                {#if imageUrl}
                  <img src={imageUrl} alt="Profile" class="w-full h-full object-cover" onload={() => { console.log('Image loaded successfully from Helia'); }} />
                {:else}
                  <div class="w-full h-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" style="color: var(--text-muted);" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                  </div>
                {/if}
              {:catch error}
                <div class="w-full h-full flex items-center justify-center"><span class="text-xs" style="color: var(--danger);">Error</span></div>
              {/await}
            </div>
            <input type="file" id="profile-picture" class="hidden" accept="image/*" onchange={handleProfilePictureUpload} />
            <label for="profile-picture" class="btn-primary btn-sm cursor-pointer">{$profilePictureCid ? $_('change_picture') : $_('upload_picture')}</label>
            {#if errorMessage}<p class="text-xs" style="color: var(--danger);">{errorMessage}</p>{/if}
          </div>
          <div class="flex-1 space-y-3">
            <div>
              <label for="blog-name-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('blog_name')}</label>
              <input id="blog-name-input" type="text" class="input" value={$blogName} data-testid="blog-name-input" onchange={(event: Event) => { const target = event.target as HTMLInputElement; $settingsDB?.put({ _id: 'blogName', value: target.value }) }} />
            </div>
            <div>
              <label for="blog-description-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('blog_description')}</label>
              <input id="blog-description-input" type="text" class="input" value={$blogDescription} data-testid="blog-description-input" onchange={(event: Event) => { const target = event.target as HTMLInputElement; $settingsDB?.put({ _id: 'blogDescription', value: target.value }) }} />
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Language Settings -->
  <div class="settings-section">
    <button class="settings-header" onclick={() => toggleSection('languages')} ontouchend={(e) => {e.preventDefault(); toggleSection('languages')}}>
      <span class="text-sm font-medium" style="color: var(--text);">{$_('enabled_languages')}</span>
      <svg class="w-3 h-3 transition-transform" style="color: var(--text-muted);" class:rotate-180={openSections.languages} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {#if openSections.languages}
      <div class="settings-content">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
          {#each Object.entries(LANGUAGES) as [code, name]}
            <label class="flex items-center gap-2 p-2 rounded-md cursor-pointer" style="background-color: var(--bg-tertiary);">
              <input type="checkbox" checked={$enabledLanguages.includes(code)} onchange={() => toggleLanguage(code)} class="rounded" style="border-color: var(--border); color: var(--accent);" />
              <span class="text-xs" style="color: var(--text-secondary);">{name}</span>
            </label>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Categories -->
  <div class="settings-section">
    <button class="settings-header" onclick={() => toggleSection('categories')} data-testid="categories">
      <span class="text-sm font-medium" style="color: var(--text);">{$_('post_categories')}</span>
      <svg class="w-3 h-3 transition-transform" style="color: var(--text-muted);" class:rotate-180={openSections.categories} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {#if openSections.categories}
      <div class="settings-content">
        <div class="flex gap-2 mb-3">
          <input type="text" class="input flex-1" placeholder={$_('new_category')} bind:value={newCategory} onkeydown={(event) => event.key === 'Enter' && addCategory()} data-testid="new-category-input" />
          <button class="btn-primary btn-sm" onclick={addCategory} data-testid="add-category-button">{$_('add')}</button>
        </div>
        <div class="flex flex-wrap gap-1.5">
          {#each $categories as category}
            <div class="badge flex items-center gap-1" data-testid="category-item">
              <span>{category}</span>
              <button class="btn-icon p-0" style="color: var(--danger); min-width: auto; min-height: auto;" onclick={() => removeCategory(category)} data-testid="remove-category-button-{category}">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Identity -->
  <div class="settings-section">
    <button class="settings-header" onclick={() => toggleSection('identity')}>
      <span class="text-sm font-medium" style="color: var(--text);">{$_('identity')}</span>
      <svg class="w-3 h-3 transition-transform" style="color: var(--text-muted);" class:rotate-180={openSections.identity} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {#if openSections.identity}
      <div class="settings-content">
        <div class="flex items-center gap-2">
          <span class="text-xs" style="color: var(--text-muted);">{$_('did')}:</span>
          <input type="text" size={60} readonly value={did} class="input flex-1 font-mono text-xs" />
          <button class="btn-icon" onclick={() => copyToClipboard(did)}>
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Security -->
  <div class="settings-section">
    <button class="settings-header" onclick={() => toggleSection('security')}>
      <span class="text-sm font-medium" style="color: var(--text);">{$_('security')}</span>
      <svg class="w-3 h-3 transition-transform" style="color: var(--text-muted);" class:rotate-180={openSections.security} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {#if openSections.security}
      <div class="settings-content">
        <label for="seed-phrase-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('seed_phrase')}</label>
        <div class="flex items-center gap-2">
          <input id="seed-phrase-input" type="{showSeedPhrase ? 'text' : 'password'}" class="input flex-1 font-mono text-xs" value={$seedPhrase || ''} />
          <button class="btn-icon" onclick={toggleSeedVisibility} aria-label={showSeedPhrase ? $_('hide_seed_phrase') : $_('show_seed_phrase')}>
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
          </button>
          <button class="btn-outline btn-sm" onclick={() => showChangePasswordModal = true}>{$_('change_password')}</button>
        </div>
      </div>
    {/if}
  </div>

  <!-- AI Settings -->
  <div class="settings-section">
    <button class="settings-header" onclick={() => toggleSection('aiSettings')}>
      <span class="text-sm font-medium" style="color: var(--text);">{$_('ai_translation_settings')}</span>
      <svg class="w-3 h-3 transition-transform" style="color: var(--text-muted);" class:rotate-180={openSections.aiSettings} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {#if openSections.aiSettings}
      <div class="settings-content space-y-3">
        <div>
          <label for="ai-api-key-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('ai_api_key')}</label>
          <input id="ai-api-key-input" type="password" class="input" value={$aiApiKey} onchange={(event: Event) => { const target = event.target as HTMLInputElement; localStorage.setItem('aiApiKey', target.value); $aiApiKey = target.value; }} />
        </div>
        <div>
          <label for="ai-api-url-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('ai_api_url')}</label>
          <input id="ai-api-url-input" type="text" class="input" value={$aiApiUrl} onchange={(event: Event) => { const target = event.target as HTMLInputElement; localStorage.setItem('aiApiUrl', target.value); $aiApiUrl = target.value; }} />
        </div>
      </div>
    {/if}
  </div>
</div>

{#if showChangePasswordModal}
  <div class="fixed inset-0 flex items-center justify-center z-50" style="background-color: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px);">
    <div class="card p-6 max-w-md w-full mx-4" style="box-shadow: var(--shadow-lg);">
      <h2 class="text-lg font-semibold mb-4" style="color: var(--text);">{$_('change_password')}</h2>
      
      <form onsubmit={preventDefault(changePassword)} class="space-y-4">
        <div>
          <label for="new-password-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('new_password')}</label>
          <input id="new-password-input" type="password" bind:value={newPassword} class="input" placeholder={$_('enter_new_password')} />
        </div>
        <div>
          <label for="confirm-password-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('confirm_new_password')}</label>
          <input id="confirm-password-input" type="password" bind:value={confirmNewPassword} class="input" placeholder={$_('confirm_new_password_placeholder')} />
        </div>
        {#if errorMessage}<div class="text-sm" style="color: var(--danger);">{errorMessage}</div>{/if}
        {#if successMessage}<div class="text-sm" style="color: var(--success);">{successMessage}</div>{/if}
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-outline" onclick={() => showChangePasswordModal = false}>{$_('cancel')}</button>
          <button type="submit" class="btn-primary">{$_('change_password')}</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .rotate-180 { transform: rotate(180deg); }

  .settings-section {
    border-bottom: 1px solid var(--border-subtle);
  }
  .settings-section:last-of-type {
    border-bottom: none;
  }
  .settings-header {
    width: 100%;
    padding: 0.75rem 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    background: none;
    border: none;
  }
  .settings-header:hover {
    background: none;
  }
  .settings-content {
    padding: 0 0 0.75rem 0;
  }

  :global([dir="rtl"]) .flex { flex-direction: row-reverse; }
  :global([dir="rtl"]) .text-left { text-align: right; }
</style> 
