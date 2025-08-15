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
</script>

<div class="w-48 md:w-64 bg-gray-200 dark:bg-gray-800 p-2 shadow-md overflow-y-auto {$isRTL ? 'rtl' : 'ltr'}" data-testid="sidebar-container">
  <!-- DBs Section -->
  <div class="mb-3" data-testid="blogs-section">
    <button 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-blue-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-blue-600 w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-600 touch-target"
      onclick={() => toggleSection('blogs')}
      ontouchend={(e) => { e.preventDefault(); toggleSection('blogs'); }}
      title={$showDBManager ? $_("hide_database_manager") : $_("show_database_manager")}
      data-testid="blogs-header"
      aria-label={$showDBManager ? $_("hide_database_manager") : $_("show_database_manager")}
    >
      {$_('blogs')}
    </button>
    <div class="space-y-1" data-testid="blogs-list">
      <button 
        class="w-full text-left text-[10px] md:text-xs text-gray-800 dark:text-gray-300 bg-gray-300 dark:bg-gray-600 p-1 rounded cursor-pointer hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors touch-target"
        onclick={async () => {
          if ($settingsDB.address) {
            try {   
                switchToRemoteDB($settingsDB.address);
            } catch (error) {
              console.error('Error retrieving postsDBAddress from settingsDB:', error);
            }
          }
        }}
        ontouchend={async (e) => {
          e.preventDefault();
          if ($settingsDB.address) {
            try {   
                switchToRemoteDB($settingsDB.address);
            } catch (error) {
              console.error('Error retrieving postsDBAddress from settingsDB:', error);
            }
          }
        }}
        title={`${$_('click_to_load_your_blog')} ${$settingsDB?.address}`}
        data-testid="current-blog"
        aria-label={`${$_('click_to_load_your_blog')} ${$settingsDB?.address}`}
      >
        <p class="truncate" data-testid="blog-info">
          {#if $settingsDB && $settingsDB.pinnedToVoyager !== undefined}
            <span 
              class="inline-block {$isRTL ? 'mr-1' : 'ml-1'} w-2 h-2 rounded-full {$settingsDB.pinnedToVoyager ? 'bg-green-500' : canWrite ? 'bg-orange-500' : 'bg-red-500'}"
              title={$settingsDB.pinnedToVoyager ? $_("pinned_to_voyager") : canWrite ? $_("not_pinned_to_voyager") : $_("no_write_access")}
              data-testid="blog-status-indicator"
            ></span>
          {/if}
          <strong>{$_('blog_name')}:</strong> <span data-testid="sidebar-blog-name">{$blogName || $_('not_set')}</span>
        </p>
        <p class="truncate" data-testid="peer-info">
          {#if $identity?.id}
            <span class="inline-block">
              {#if canWrite}
                <svg class="inline-block w-4 h-4 {$isRTL ? 'ml-1' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="write-access-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              {:else}
                <svg class="inline-block w-4 h-4 {$isRTL ? 'ml-1' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="read-only-icon">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              {/if}
            </span>
            <strong>{$_('peer_id')}:</strong>
            <span title={`${$identity.id} @ ${$libp2p?.peerId.toString()}`} data-testid="peer-id">
              {$libp2p?.peerId.toString().slice(-5)}
            </span>
          {:else}
            <span data-testid="connection-status">{$_('not_connected')}</span>
          {/if}
        </p>
      </button>
    </div>
    <div class="space-y-1" data-testid="remote-blogs-list">
      {#if $remoteDBs?.length > 0}
        {#each $remoteDBs as db}
          <button 
            class="w-full text-left py-0.5 px-1 rounded text-[10px] md:text-xs truncate max-h-8 flex items-center touch-target {$postsDBAddress === db.address ? 'bg-blue-500 text-white' : db.access?.write?.includes($identity?.id) ? 'bg-green-300 dark:bg-green-600 text-gray-800 dark:text-gray-200 hover:bg-amber-400 dark:hover:bg-amber-500' : 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500'}"
            onclick={() => switchToRemoteDB(db.address)}
            ontouchend={(e) => { e.preventDefault(); switchToRemoteDB(db.address); }}
            title={db.name}
            data-testid={`remote-blog-${db.id}`}
          >
            {#if db.pinnedToVoyager !== undefined}
              <span 
                class="inline-block {$isRTL ? 'mr-1' : 'ml-1'} w-2 h-2 rounded-full flex-shrink-0 {db.pinnedToVoyager ? 'bg-green-500' : 'bg-orange-500'}"
                title={db.pinnedToVoyager ? $_("pinned_to_voyager") : $_("not_pinned_to_voyager")}
                data-testid={`remote-blog-status-${db.id}`}
              ></span>
            {/if}
            <span class="whitespace-nowrap overflow-ellipsis" data-testid={`remote-blog-name-${db.id}`}>
              {db.postsCount || ''}
              {#if db.access?.write?.includes($identity?.id)}
                <svg class="inline-block w-3 h-3 {$isRTL ? 'ml-1' : 'mr-1'} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid={`remote-blog-write-access-${db.id}`}>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              {:else}
                <svg class="inline-block w-3 h-3 {$isRTL ? 'ml-1' : 'mr-1'} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid={`remote-blog-read-only-${db.id}`}>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              {/if}
              {db.name}
            </span>
          </button>
        {/each}
      {:else}
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400" data-testid="no-remote-blogs">{$_('no_databases')}</p>
      {/if}
    </div>
  </div>
  
  <!-- Peers Section -->
  <div class="mb-3" data-testid="peers-section">
    <button 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-yellow-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-yellow-600 w-full text-left focus:outline-none focus:ring-2 focus:ring-yellow-600 touch-target"
      onclick={() => toggleSection('peers')}
      ontouchend={(e) => { e.preventDefault(); toggleSection('peers'); }}
      title={$showPeers ? $_("hide_connected_peers") : $_("show_connected_peers")}
      data-testid="peers-header"
      aria-label={$showPeers ? $_("hide_connected_peers") : $_("show_connected_peers")}
    >
      {$_('peers')} ({$connectedPeersCount})
    </button>
    {#if $showPeers}
      <div class="space-y-1" data-testid="peers-list">
        {#if $libp2p}
          {#key $libp2p}
            <PeersList />
          {/key}
        {:else}
          <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400" data-testid="no-peers">{$_('not_connected')}</p>
        {/if}
      </div>
    {/if}
  </div>
  
  <!-- Settings Section -->
  <div data-testid="settings-section">
    <button 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-green-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-green-600 w-full text-left focus:outline-none focus:ring-2 focus:ring-green-600 touch-target"
      onclick={() => toggleSection('settings')}
      ontouchend={(e) => { e.preventDefault(); toggleSection('settings'); }}
      title={$showSettings ? $_("hide_settings") : $_("show_settings")}
      data-testid="settings-header"
      aria-label={$showSettings ? $_("hide_settings") : $_("show_settings")}
    >
      {$_('settings')}
    </button>
  </div>
  
  <!-- Version Info -->
  <div class="mt-2 px-1" data-testid="version-section">
    <p class="text-[8px] md:text-[10px] text-gray-500 dark:text-gray-400 text-center">
      {$reactiveCompactVersionString}
    </p>
  </div>
</div>

<style>
svg {
  width: 1em !important; /* Force consistent SVG sizing */
  height: 1em !important;
  display: inline-block;
  vertical-align: middle;
}

/* Touch-friendly button styling for mobile */
.touch-target {
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
  touch-action: manipulation;
  user-select: none;
}

/* Ensure minimum touch target size on mobile */
@media (max-width: 768px) {
  .touch-target {
    min-height: 44px; /* Apple's recommended minimum touch target size */
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 8px 12px;
  }
  
  /* Override small padding for mobile */
  button.touch-target {
    padding: 8px 12px !important;
  }
  
  /* Ensure remote blog buttons have adequate touch targets */
  button[data-testid^="remote-blog-"] {
    min-height: 40px;
    padding: 6px 8px;
  }
}

/* Active state feedback for touch */
.touch-target:active {
  transform: scale(0.98);
  opacity: 0.8;
}

/* Improve button focus visibility for keyboard navigation */
.touch-target:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.5);
  outline-offset: 2px;
}
</style>
