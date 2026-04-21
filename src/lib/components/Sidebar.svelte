<script lang="ts">
  import { run } from 'svelte/legacy';
  import { _, locale } from 'svelte-i18n';
  import { isRTL } from '$lib/store.js';
  import { derived } from 'svelte/store';

  import {
    postsDB,
    remoteDBs, 
    libp2p, 
    postsDBAddress, 
    blogName, 
    identity,
    showDBManager,
    showPeers,
    showSettings,
    settingsDB,
  } from '$lib/store.js';
  import { switchToRemoteDB } from '$lib/dbUtils.js';
  import PeersList from './PeersList.svelte';
  import { connectedPeersCount } from '$lib/peerConnections.js';
  import { getCompactVersionString } from '$lib/utils/buildInfo.js';
  
  let _settingsDB: any = $state(), _identity: any = $state(), _postsDB: any = $state(), _postsDBAddress: any = $state();
  
  settingsDB.subscribe((val: any) => _settingsDB = val);
  identity.subscribe((val: any) => _identity = val);
  postsDB.subscribe((val: any) => _postsDB = val);
  postsDBAddress.subscribe((val: any) => _postsDBAddress = val);
  
  let canWrite = $state(false)
  $effect(() => {
    if(_settingsDB && _identity && _postsDB && _postsDBAddress){
      const access = _settingsDB?.access?.write;
      canWrite = access?.includes(_identity?.id)
    }
  });

  // Create a reactive compact version string that updates when locale changes
  const reactiveCompactVersionString = derived(locale, ($locale) => {
    return getCompactVersionString();
  });

  // Function to handle section toggling
  function toggleSection(section: 'blogs' | 'peers' | 'settings') {
    if (section === 'blogs') {
      showDBManager.update(value => !value);
      showPeers.set(false);
      showSettings.set(false);
    } else if (section === 'peers') {
      showPeers.update(value => !value);
      showDBManager.set(false);
      showSettings.set(false);
    } else if (section === 'settings') {
      showSettings.update(value => !value);
      showDBManager.set(false);
      showPeers.set(false);
    }
  }

  function getSectionActionLabel(isOpen: boolean, openLabel: string, closeLabel: string) {
    return isOpen ? closeLabel : openLabel;
  }
</script>

<nav class="sidebar w-56 md:w-64 h-full overflow-y-auto flex flex-col {$isRTL ? 'rtl' : 'ltr'}" style="background-color: var(--bg-secondary); border-right: 1px solid var(--border);" data-testid="sidebar-container">
  
  <!-- Blogs Section -->
  <div class="px-3 py-2" data-testid="blogs-section">
    <button 
      class="section-label w-full flex items-center justify-between py-1.5 px-0 cursor-pointer touch-target"
      style="background: none; border: none;"
      onclick={() => toggleSection('blogs')}
      ontouchend={(e) => { e.preventDefault(); toggleSection('blogs'); }}
      title={$showDBManager ? $_("hide_database_manager") : $_("show_database_manager")}
      data-testid="blogs-header"
      aria-label={$showDBManager ? $_("hide_database_manager") : $_("show_database_manager")}
    >
      <span class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 flex-shrink-0" style="color: var(--text-muted);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 7.5A2.5 2.5 0 016.5 5h3a2 2 0 011.414.586l.5.5A2 2 0 0012.828 7H17.5A2.5 2.5 0 0120 9.5v7A2.5 2.5 0 0117.5 19h-11A2.5 2.5 0 014 16.5v-9z" />
        </svg>
        <span>{$_('blogs')}</span>
      </span>
      <span
        class="section-action-icon"
        title={getSectionActionLabel($showDBManager, $_("show_database_manager"), $_("hide_database_manager"))}
        aria-hidden="true"
      >
        {#if $showDBManager}
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        {:else}
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
        {/if}
      </span>
    </button>

    <div class="space-y-0.5 mt-1" data-testid="blogs-list">
      <!-- Current blog -->
      <button 
        class="sidebar-item w-full text-left rounded-md px-2 py-1.5 cursor-pointer transition-colors touch-target"
        style="background-color: var(--bg-active);"
        onclick={async () => {
          if ($settingsDB.address) {
            try {   
                switchToRemoteDB($settingsDB.address.toString());
            } catch (error) {
              console.error('Error retrieving postsDBAddress from settingsDB:', error);
            }
          }
        }}
        ontouchend={async (e) => {
          e.preventDefault();
          if ($settingsDB.address) {
            try {   
                switchToRemoteDB($settingsDB.address.toString());
            } catch (error) {
              console.error('Error retrieving postsDBAddress from settingsDB:', error);
            }
          }
        }}
        title={`${$_('click_to_load_your_blog')} ${$settingsDB?.address}`}
        data-testid="current-blog"
        aria-label={`${$_('click_to_load_your_blog')} ${$settingsDB?.address}`}
      >
        <div class="flex items-center gap-1.5" data-testid="blog-info">
          {#if $settingsDB}
            <span 
              class="status-dot flex-shrink-0"
              style="background-color: {canWrite ? 'var(--warning)' : 'var(--danger)'};"
              title={canWrite ? $_("write_access") : $_("no_write_access")}
              data-testid="blog-status-indicator"
            ></span>
          {/if}
          <span class="text-xs font-medium truncate" style="color: var(--text);" data-testid="sidebar-blog-name">{$blogName || $_('not_set')}</span>
        </div>
        <div class="flex items-center gap-1 mt-0.5" data-testid="peer-info">
          {#if $identity?.id}
            <span class="inline-flex items-center">
              {#if canWrite}
                <svg class="w-3 h-3 flex-shrink-0" style="color: var(--text-muted);" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="write-access-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              {:else}
                <svg class="w-3 h-3 flex-shrink-0" style="color: var(--text-muted);" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="read-only-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              {/if}
            </span>
            <span class="text-[10px] truncate" style="color: var(--text-muted);" title={`${$identity.id} @ ${$libp2p?.peerId.toString()}`} data-testid="peer-id">
              {$libp2p?.peerId.toString().slice(-5)}
            </span>
          {:else}
            <span class="text-[10px]" style="color: var(--text-muted);" data-testid="connection-status">{$_('not_connected')}</span>
          {/if}
        </div>
      </button>
    </div>

    <!-- Remote blogs -->
    <div class="space-y-0.5 mt-1" data-testid="remote-blogs-list">
      {#if $remoteDBs?.length > 0}
        {#each $remoteDBs as db}
          <button 
            class="sidebar-item w-full text-left rounded-md px-2 py-1.5 flex items-center gap-1.5 cursor-pointer transition-colors touch-target truncate"
            style="{$settingsDB?.address?.toString() === db.address ? 'background-color: var(--bg-active); border-left: 2px solid var(--accent);' : 'background-color: transparent;'}"
            onclick={() => switchToRemoteDB(db.address, true)}
            ontouchend={(e) => { e.preventDefault(); switchToRemoteDB(db.address, true); }}
            title={db.name}
            data-testid={`remote-blog-${db.id}`}
          >
            {#if db.pinnedToVoyager !== undefined}
              <span 
                class="status-dot flex-shrink-0"
                style="background-color: {db.pinnedToVoyager ? 'var(--success)' : 'var(--warning)'};"
                title={db.pinnedToVoyager ? $_("pinned_to_voyager") : $_("not_pinned_to_voyager")}
                data-testid={`remote-blog-status-${db.id}`}
              ></span>
            {/if}
            <span class="flex items-center gap-1 text-xs truncate" style="color: var(--text-secondary);" data-testid={`remote-blog-name-${db.id}`}>
              {#if db.postsCount}
                <span class="badge">{db.postsCount}</span>
              {/if}
              {#if db.access?.write?.includes($identity?.id)}
                <svg class="w-3 h-3 flex-shrink-0" style="color: var(--text-muted);" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid={`remote-blog-write-access-${db.id}`}>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              {:else}
                <svg class="w-3 h-3 flex-shrink-0" style="color: var(--text-muted);" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid={`remote-blog-read-only-${db.id}`}>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              {/if}
              <span class="truncate">{db.name}</span>
            </span>
          </button>
        {/each}
      {:else}
        <p class="text-[10px] px-2 py-1" style="color: var(--text-muted);" data-testid="no-remote-blogs">{$_('no_databases')}</p>
      {/if}
    </div>
  </div>
  
  <div class="divider mx-3"></div>

  <!-- Peers Section -->
  <div class="px-3 py-2" data-testid="peers-section">
    <button 
      class="section-label w-full flex items-center justify-between py-1.5 px-0 cursor-pointer touch-target"
      style="background: none; border: none;"
      onclick={() => toggleSection('peers')}
      ontouchend={(e) => { e.preventDefault(); toggleSection('peers'); }}
      title={$showPeers ? $_("hide_connected_peers") : $_("show_connected_peers")}
      data-testid="peers-header"
      aria-label={$showPeers ? $_("hide_connected_peers") : $_("show_connected_peers")}
    >
      <span class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 flex-shrink-0" style="color: var(--text-muted);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19a4 4 0 00-8 0m12 0a4 4 0 00-3-3.874M15 19h4m-10 0H5m8-8a3 3 0 11-6 0 3 3 0 016 0zm6 2a2.5 2.5 0 10-5 0 2.5 2.5 0 005 0z" />
        </svg>
        {$_('peers')}
        <span class="badge">{$connectedPeersCount}</span>
      </span>
      <span
        class="section-action-icon"
        title={getSectionActionLabel($showPeers, $_("show_connected_peers"), $_("hide_connected_peers"))}
        aria-hidden="true"
      >
        {#if $showPeers}
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        {:else}
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
        {/if}
      </span>
    </button>
    {#if $showPeers}
      <div class="space-y-0.5 mt-1" data-testid="peers-list">
        {#if $libp2p}
          {#key $libp2p}
            <PeersList />
          {/key}
        {:else}
          <p class="text-[10px] px-2 py-1" style="color: var(--text-muted);" data-testid="no-peers">{$_('not_connected')}</p>
        {/if}
      </div>
    {/if}
  </div>
  
  <div class="divider mx-3"></div>

  <!-- Settings Section -->
  <div class="px-3 py-2" data-testid="settings-section">
    <button 
      class="section-label w-full flex items-center justify-between py-1.5 px-0 cursor-pointer touch-target"
      style="background: none; border: none;"
      onclick={() => toggleSection('settings')}
      ontouchend={(e) => { e.preventDefault(); toggleSection('settings'); }}
      title={$showSettings ? $_("hide_settings") : $_("show_settings")}
      data-testid="settings-header"
      aria-label={$showSettings ? $_("hide_settings") : $_("show_settings")}
    >
      <span class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5 flex-shrink-0" style="color: var(--text-muted);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317a1 1 0 011.35-.936l.994.398a1 1 0 00.986-.104l.878-.586a1 1 0 011.43.363l.472.944a1 1 0 00.79.548l1.048.152a1 1 0 01.85 1.123l-.137 1.05a1 1 0 00.287.949l.75.75a1 1 0 010 1.414l-.75.75a1 1 0 00-.287.95l.137 1.048a1 1 0 01-.85 1.124l-1.048.152a1 1 0 00-.79.547l-.472.944a1 1 0 01-1.43.363l-.878-.585a1 1 0 00-.986-.105l-.994.398a1 1 0 01-1.35-.936v-1.07a1 1 0 00-.553-.894l-.943-.472a1 1 0 01-.363-1.43l.586-.878a1 1 0 00.104-.986l-.398-.994a1 1 0 01.936-1.35h1.07a1 1 0 00.894-.553l.472-.943z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{$_('settings')}</span>
      </span>
      <span
        class="section-action-icon"
        title={getSectionActionLabel($showSettings, $_("show_settings"), $_("hide_settings"))}
        aria-hidden="true"
      >
        {#if $showSettings}
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        {:else}
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
        {/if}
      </span>
    </button>
  </div>
  
  <!-- Spacer -->
  <div class="flex-1"></div>

  <!-- Version Info -->
  <div class="px-3 py-3" data-testid="version-section">
    <p class="text-[9px] text-center" style="color: var(--text-muted);">
      {$reactiveCompactVersionString}
    </p>
  </div>
</nav>

<style>
  svg {
    width: 1em !important;
    height: 1em !important;
    display: inline-block;
    vertical-align: middle;
  }

  .sidebar-item:hover {
    background-color: var(--bg-hover) !important;
  }

  .touch-target {
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0.05);
    touch-action: manipulation;
    user-select: none;
  }

  @media (max-width: 768px) {
    .touch-target {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }
  }

  .touch-target:active {
    transform: scale(0.98);
    opacity: 0.8;
  }

  .touch-target:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .section-action-icon {
    width: 1.35rem;
    height: 1.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: 1px solid var(--border);
    color: var(--text-muted);
    background-color: var(--bg-primary);
    flex-shrink: 0;
  }
</style>
