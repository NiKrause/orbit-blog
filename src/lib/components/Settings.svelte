<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { settingsDB, profilePictureCid, blogName, blogDescription, categories, libp2p, orbitdb, enabledLanguages, aiApiKey, aiApiUrl, identity, isRTL, mediaDB, helia, postsDB, commentsDB } from '../store.js';
  import { LANGUAGES } from '../i18n/index.js';
  import { unixfs, type UnixFS } from '@helia/unixfs';
  import { createEventDispatcher } from 'svelte';
  import { onMount, onDestroy } from 'svelte';
  import {
    clearWebAuthnVarsigCredential,
    loadWebAuthnVarsigCredential
  } from '@le-space/orbitdb-identity-provider-webauthn-did';
  import { getImageUrlFromHelia, revokeImageUrl } from '../utils/mediaUtils.js';
  import { info, debug, error } from '../utils/logger.js'
  let {
    aclAdminMutate = null
  }: {
    aclAdminMutate?: ((kind: 'grant' | 'revoke', didValue: string) => Promise<any>) | null;
  } = $props();
  const dispatch = createEventDispatcher();
  let errorMessage = $state('');
  let hasPasskeyCredential = $state(false);
  let identityMode = $state('passkey');
  let ownerIdentityId = $state<string | null>(null);
  let storedPasskeyDid = $state<string | null>(null);
  let canActivateWriterMode = $state(false);
  let passkeyStatusReason = $state('');
  let writeAclRows = $state<Array<{ did: string; dbs: string[]; revokable: boolean }>>([]);
  let revokingDid = $state<string | null>(null);
  let newWriteDid = $state('');
  let grantingDid = $state(false);
  let blogNameDraft = $state('');
  let blogDescriptionDraft = $state('');
  let isEditingBlogName = $state(false);
  let isEditingBlogDescription = $state(false);
  let isSavingBlogName = $state(false);
  let isSavingBlogDescription = $state(false);
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

    hasPasskeyCredential = !!loadWebAuthnVarsigCredential();
    identityMode = 'passkey';
    blogNameDraft = $blogName || '';
    blogDescriptionDraft = $blogDescription || '';
    await refreshWriterModeState();
  });

  $effect(() => {
    identityMode = 'passkey';
    refreshWriterModeState();
  });

  $effect(() => {
    refreshWriteAclRows();
  });

  $effect(() => {
    if (!isEditingBlogName && !isSavingBlogName && blogNameDraft !== ($blogName || '')) {
      blogNameDraft = $blogName || '';
    }
    if (!isEditingBlogDescription && !isSavingBlogDescription && blogDescriptionDraft !== ($blogDescription || '')) {
      blogDescriptionDraft = $blogDescription || '';
    }
  });

  function shortIdentity(value?: string | null): string {
    if (!value) return 'not available';
    if (value.length <= 24) return value;
    return `${value.slice(0, 12)}...${value.slice(-8)}`;
  }

  function getAccessDbEntries() {
    const globalObj = typeof window !== 'undefined' ? (window as any) : null;
    return [
      { name: 'settings', db: globalObj?.settingsDB || $settingsDB },
      { name: 'posts', db: globalObj?.postsDB || $postsDB },
      { name: 'comments', db: globalObj?.commentsDB || $commentsDB },
      { name: 'media', db: globalObj?.mediaDB || $mediaDB }
    ];
  }

  function getAclAdminApi() {
    const globalObj = typeof window !== 'undefined' ? (window as any) : null;
    return globalObj?.__leSpaceAclAdmin || null;
  }

  async function ensureDbWithCurrentIdentity(db: any) {
    if (!db || !$orbitdb || !$identity?.id) return db;
    const currentId = db?.identity?.id;
    if (!currentId || currentId === $identity.id) return db;
    const address = db?.address?.toString?.();
    if (!address) return db;
    try {
      return await $orbitdb.open(address, { create: false });
    } catch {
      return db;
    }
  }

  async function refreshWriterModeState() {
    const credential = loadWebAuthnVarsigCredential();
    hasPasskeyCredential = !!credential;
    storedPasskeyDid = credential?.did || null;

    let ownerDid: string | null = null;
    try {
      const entry = await $settingsDB?.get?.('ownerIdentity');
      ownerDid = entry?.value?.value || null;
    } catch {}

    if (!ownerDid && $settingsDB?.access?.write?.includes?.($identity?.id)) {
      ownerDid = $identity?.id || null;
    }
    ownerIdentityId = ownerDid;

    canActivateWriterMode = false;

    if (!hasPasskeyCredential) {
      passkeyStatusReason = 'No passkey credential stored yet.';
      return;
    }

    if (!storedPasskeyDid) {
      passkeyStatusReason = 'Stored passkey has no DID.';
      return;
    }

    if (!ownerIdentityId) {
      passkeyStatusReason = 'Owner identity is not loaded yet.';
      return;
    }

    if (storedPasskeyDid !== ownerIdentityId) {
      passkeyStatusReason = 'Stored passkey DID differs from blog owner.';
      return;
    }

    passkeyStatusReason = 'Stored passkey matches owner DID.';
  }

  async function refreshWriteAclRows() {
    const dbEntries = getAccessDbEntries();
    const didToDbs = new Map<string, Set<string>>();
    for (const { name, db } of dbEntries) {
      const activeDb = await ensureDbWithCurrentIdentity(db);
      const writeSet = typeof activeDb?.access?.get === 'function'
        ? await activeDb.access.get('write')
        : new Set(activeDb?.access?.write || []);
      const writeList = Array.from(writeSet || []);
      for (const didValue of writeList) {
        if (!didToDbs.has(didValue)) didToDbs.set(didValue, new Set());
        didToDbs.get(didValue)?.add(name);
      }
    }
    writeAclRows = Array.from(didToDbs.entries())
      .map(([didValue, dbs]) => ({
        did: didValue,
        dbs: Array.from(dbs),
        revokable: didValue !== '*' && Boolean(didValue) && didValue !== storedPasskeyDid
      }))
      .sort((a, b) => a.did.localeCompare(b.did));
  }

  async function revokeWriteDid(didValue: string) {
    if (!didValue || didValue === '*' || didValue === storedPasskeyDid) return;
    revokingDid = didValue;
    errorMessage = '';
    try {
      const adminApi = getAclAdminApi();
      if (typeof aclAdminMutate === 'function') {
        const result = await aclAdminMutate('revoke', didValue);
        console.log('[Settings] revoke via passed aclAdminMutate', {
          didValue,
          activeDid: $identity?.id,
          identityMode,
          result
        });
      } else if (typeof adminApi?.revokeWriteDid === 'function') {
        const result = await adminApi.revokeWriteDid(didValue);
        console.log('[Settings] revoke via passkey-admin API', {
          didValue,
          activeDid: $identity?.id,
          identityMode,
          result
        });
      } else {
        const dbEntries = getAccessDbEntries();
        for (const { db } of dbEntries) {
          const activeDb = await ensureDbWithCurrentIdentity(db);
          const writeSet = typeof activeDb?.access?.get === 'function'
            ? await activeDb.access.get('write')
            : new Set(activeDb?.access?.write || []);
          const writeList = Array.from(writeSet || []);
          if (typeof activeDb?.access?.revoke !== 'function' || !writeList.includes(didValue)) continue;
          await activeDb.access.revoke('write', didValue);
        }
      }
      await refreshWriteAclRows();
    } catch (err: any) {
      errorMessage = err?.message || 'Failed to revoke write permission';
    } finally {
      revokingDid = null;
    }
  }

  async function grantWriteDid() {
    const didValue = (newWriteDid || '').trim();
    if (!didValue) return;
    if (!didValue.startsWith('did:')) {
      errorMessage = 'Please provide a valid DID (did:...)';
      return;
    }
    grantingDid = true;
    errorMessage = '';
    try {
      const adminApi = getAclAdminApi();
      if (typeof aclAdminMutate === 'function') {
        const result = await aclAdminMutate('grant', didValue);
        console.log('[Settings] grant via passed aclAdminMutate', {
          didValue,
          activeDid: $identity?.id,
          identityMode,
          result
        });
      } else if (typeof adminApi?.grantWriteDid === 'function') {
        const result = await adminApi.grantWriteDid(didValue);
        console.log('[Settings] grant via passkey-admin API', {
          didValue,
          activeDid: $identity?.id,
          identityMode,
          result
        });
      } else {
        const dbEntries = getAccessDbEntries();
        for (const { db } of dbEntries) {
          const activeDb = await ensureDbWithCurrentIdentity(db);
          const writeSet = typeof activeDb?.access?.get === 'function'
            ? await activeDb.access.get('write')
            : new Set(activeDb?.access?.write || []);
          const writeList = Array.from(writeSet || []);
          if (typeof activeDb?.access?.grant !== 'function' || writeList.includes(didValue)) continue;
          await activeDb.access.grant('write', didValue);
        }
      }
      newWriteDid = '';
      await refreshWriteAclRows();
    } catch (err: any) {
      errorMessage = err?.message || 'Failed to grant write permission';
    } finally {
      grantingDid = false;
    }
  }

  function activatePasskeyWriterMode() {
    console.log('[Settings] activatePasskeyWriterMode click', {
      canActivateWriterMode,
      identityMode,
      ownerIdentityId,
      storedPasskeyDid,
      activeDid: $identity?.id
    });
    const dispatched = dispatch('activatePasskeyWriter');
    console.log('[Settings] activatePasskeyWriter dispatched', { dispatched });
  }

  async function confirmPasskeyForSettingsWrite(_action: string) {
    // Writes use the active passkey DID identity.
    return;
  }

  async function persistBlogName() {
    if (isSavingBlogName) return;
    const next = (blogNameDraft || '').trim();
    if (!next || next === $blogName) {
      blogNameDraft = $blogName || '';
      return;
    }
    isSavingBlogName = true;
    try {
      await confirmPasskeyForSettingsWrite('blog name update');
      $blogName = next; // reactive immediate update
      await $settingsDB?.put({ _id: 'blogName', value: next });
    } catch (err: any) {
      console.error('Failed to update blog name:', err);
      blogNameDraft = $blogName || '';
      errorMessage = err?.message || 'Failed to update blog name';
    } finally {
      isSavingBlogName = false;
    }
  }

  async function persistBlogDescription() {
    if (isSavingBlogDescription) return;
    const next = (blogDescriptionDraft || '').trim();
    if (!next || next === $blogDescription) {
      blogDescriptionDraft = $blogDescription || '';
      return;
    }
    isSavingBlogDescription = true;
    try {
      await confirmPasskeyForSettingsWrite('blog description update');
      $blogDescription = next; // reactive immediate update
      await $settingsDB?.put({ _id: 'blogDescription', value: next });
    } catch (err: any) {
      console.error('Failed to update blog description:', err);
      blogDescriptionDraft = $blogDescription || '';
      errorMessage = err?.message || 'Failed to update blog description';
    } finally {
      isSavingBlogDescription = false;
    }
  }

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

  function resetPasskeyCredential() {
    clearWebAuthnVarsigCredential();
    sessionStorage.removeItem('passkeyIdentityDid');
    hasPasskeyCredential = false;
    storedPasskeyDid = null;
    canActivateWriterMode = false;
    passkeyStatusReason = 'No passkey credential stored.';
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
              <input
                id="blog-name-input"
                type="text"
                class="input"
                bind:value={blogNameDraft}
                data-testid="blog-name-input"
                onfocus={() => { isEditingBlogName = true; }}
                onblur={async () => { isEditingBlogName = false; await persistBlogName(); }}
                onkeydown={async (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    isEditingBlogName = false;
                    await persistBlogName();
                  }
                }}
              />
            </div>
            <div>
              <label for="blog-description-input" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('blog_description')}</label>
              <input
                id="blog-description-input"
                type="text"
                class="input"
                bind:value={blogDescriptionDraft}
                data-testid="blog-description-input"
                onfocus={() => { isEditingBlogDescription = true; }}
                onblur={async () => { isEditingBlogDescription = false; await persistBlogDescription(); }}
                onkeydown={async (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    isEditingBlogDescription = false;
                    await persistBlogDescription();
                  }
                }}
              />
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
              <button class="btn-icon p-0" style="color: var(--danger); min-width: auto; min-height: auto;" onclick={() => removeCategory(category)} data-testid="remove-category-button-{category}" aria-label={`Remove category ${category}`}>
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
          <button class="btn-icon" onclick={() => copyToClipboard(did)} aria-label="Copy DID">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          </button>
        </div>
      </div>
    {/if}
  </div>

  <!-- Security -->
  <div class="settings-section" data-testid="security-settings-section">
    <button class="settings-header" data-testid="security-settings-accordion" onclick={() => toggleSection('security')}>
      <span class="text-sm font-medium" style="color: var(--text);">{$_('security')}</span>
      <svg class="w-3 h-3 transition-transform" style="color: var(--text-muted);" class:rotate-180={openSections.security} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
    </button>
    {#if openSections.security}
      <div class="settings-content">
        <p class="text-xs mb-2" style="color: var(--text-secondary);">
          This blog uses passkey DID identities only.
        </p>
        <div class="flex items-center justify-between">
          <span class="text-xs" data-testid="security-identity-summary" style="color: var(--text-muted); line-height: 1.45;">
            <span>Mode: {identityMode} | Stored passkey credential: {hasPasskeyCredential ? 'yes' : 'no'}</span>
            <br />
            <span>Owner DID: {shortIdentity(ownerIdentityId)}</span>
            <br />
            <span>Passkey DID: {shortIdentity(storedPasskeyDid)}</span>
            <br />
            <span
              style="color: var(--success); font-weight: 600;"
            >
              Active DID: {shortIdentity($identity?.id)}
            </span>
          </span>
          <div class="flex flex-col gap-2 items-end">
            <button class="btn-outline btn-sm" data-testid="reset-local-passkey" onclick={resetPasskeyCredential}>
              Reset local passkey
            </button>
          </div>
        </div>
        {#if passkeyStatusReason}
          <p class="text-xs mt-2" data-testid="passkey-status-reason" style="color: var(--text-muted);">{passkeyStatusReason}</p>
        {/if}
        <div class="mt-3 pt-3" style="border-top: 1px solid var(--border-subtle);">
          <p class="text-xs mb-2" style="color: var(--text-secondary);">Write permissions (all blog DBs)</p>
          <div class="flex items-center gap-2 mb-2">
            <input
              class="input text-xs font-mono"
              placeholder="did:key:..."
              bind:value={newWriteDid}
              onkeydown={(e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  grantWriteDid();
                }
              }}
            />
            <button
              class="btn-primary btn-sm"
              onclick={grantWriteDid}
              disabled={grantingDid || !newWriteDid.trim()}
            >
              {grantingDid ? 'Granting...' : 'Grant'}
            </button>
          </div>
          {#if writeAclRows.length === 0}
            <p class="text-xs" style="color: var(--text-muted);">No write entries found.</p>
          {:else}
            <div class="space-y-2">
              {#each writeAclRows as row}
                <div class="flex items-center justify-between gap-3 p-2 rounded-md" style="background-color: var(--bg-tertiary); border: 1px solid var(--border-subtle);">
                  <div class="min-w-0">
                    <p class="text-xs font-mono truncate" style="color: var(--text);">{row.did}</p>
                    <p class="text-[11px]" style="color: var(--text-muted);">DBs: {row.dbs.join(', ')}</p>
                  </div>
                  {#if row.did === storedPasskeyDid}
                    <span class="text-[11px] px-2 py-1 rounded" style="background-color: color-mix(in srgb, var(--success) 20%, var(--bg-secondary)); color: var(--success); border: 1px solid color-mix(in srgb, var(--success) 35%, var(--border-subtle));">
                      passkey protected
                    </span>
                  {:else if row.did === '*'}
                    <span class="text-[11px] px-2 py-1 rounded" style="color: var(--text-muted); border: 1px solid var(--border-subtle);">
                      wildcard
                    </span>
                  {:else}
                    <button
                      class="btn-outline btn-sm"
                      onclick={() => revokeWriteDid(row.did)}
                      disabled={revokingDid === row.did || !row.revokable}
                      style="color: var(--danger); border-color: color-mix(in srgb, var(--danger) 35%, var(--border-subtle));">
                      {revokingDid === row.did ? 'Revoking...' : 'Revoke'}
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
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
</style> 
