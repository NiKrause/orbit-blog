<script lang="ts">
  import { run } from 'svelte/legacy';
  import { _ } from 'svelte-i18n';
  import { isRTL } from '$lib/store.js';

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
  
  let _settingsDB: any = $state(), _identity: any = $state(), _postsDB: any = $state(), _postsDBAddress: any = $state();
  
  settingsDB.subscribe((val: any) => _settingsDB = val);
  identity.subscribe((val: any) => _identity = val);
  postsDB.subscribe((val: any) => _postsDB = val);
  postsDBAddress.subscribe((val: any) => _postsDBAddress = val);
  
  let canWrite = $state(false)
  run(() => {
    if(_settingsDB && _identity && _postsDB && _postsDBAddress){
      const access = _settingsDB?.access?.write;
      canWrite = access?.includes(_identity?.id)
    }
  });
</script>

<div class="w-48 md:w-64 bg-gray-200 dark:bg-gray-800 p-2 shadow-md overflow-y-auto {$isRTL ? 'rtl' : 'ltr'}">
  <!-- DBs Section -->
  <div class="mb-3">
    <h5 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-blue-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-blue-600"
      onclick={() => showDBManager.update((value: boolean) => !value)}
      title={$showDBManager ? $_("hide_database_manager") : $_("show_database_manager")}
    >
      {$_('blogs')}
    </h5>
    <div class="space-y-1">
      <div 
        class="text-[10px] md:text-xs text-gray-800 dark:text-gray-300 bg-gray-300 dark:bg-gray-600 p-1 rounded cursor-pointer hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
        onclick={async () => {
          if ($settingsDB.address) {
            try {   
                switchToRemoteDB($settingsDB.address);
            } catch (error) {
              console.error('Error retrieving postsDBAddress from settingsDB:', error);
            }
          }
        }}  
        title={`${$_('click_to_load_your_blog')} ${$settingsDB?.address}`}
      >
        <p class="truncate">
          {#if $settingsDB && $settingsDB.pinnedToVoyager !== undefined}
            <span 
              class="inline-block {$isRTL ? 'mr-1' : 'ml-1'} w-2 h-2 rounded-full {$settingsDB.pinnedToVoyager ? 'bg-green-500' : canWrite ? 'bg-orange-500' : 'bg-red-500'}"
              title={$settingsDB.pinnedToVoyager ? $_("pinned_to_voyager") : canWrite ? $_("not_pinned_to_voyager") : $_("no_write_access")}
            ></span>
          {/if}
          <strong>{$_('blog_name')}:</strong> {$blogName || $_('not_set')}
        </p>
        <p class="truncate">
          {#if $identity?.id}
            <span class="inline-block">
              {#if canWrite}
                <svg class="inline-block w-4 h-4 {$isRTL ? 'ml-1' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              {:else}
                <svg class="inline-block w-4 h-4 {$isRTL ? 'ml-1' : 'mr-1'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              {/if}
            </span>
            <strong>{$_('peer_id')}:</strong>
            <span title={`${$identity.id} @ ${$libp2p?.peerId.toString()}`} >
              {$libp2p?.peerId.toString().slice(-5)}
            </span>
          {:else}
            {$_('not_connected')}
          {/if}
        </p>
      </div>
    </div>
    <div class="space-y-1">
      {#if $remoteDBs?.length > 0}
        {#each $remoteDBs as db}
          <button 
            class="w-full text-left py-0.5 px-1 rounded text-[10px] md:text-xs truncate max-h-8 flex items-center {$postsDBAddress === db.address ? 'bg-blue-500 text-white' : db.access?.write?.includes($identity?.id) ? 'bg-green-300 dark:bg-green-600 text-gray-800 dark:text-gray-200 hover:bg-amber-400 dark:hover:bg-amber-500' : 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500'}"
            onclick={() => switchToRemoteDB(db.address)}
            title={db.name}
          >
            {#if db.pinnedToVoyager !== undefined}
              <span 
                class="inline-block {$isRTL ? 'mr-1' : 'ml-1'} w-2 h-2 rounded-full flex-shrink-0 {db.pinnedToVoyager ? 'bg-green-500' : 'bg-orange-500'}"
                title={db.pinnedToVoyager ? $_("pinned_to_voyager") : $_("not_pinned_to_voyager")}
              ></span>
            {/if}
            <span class="whitespace-nowrap overflow-ellipsis">
              {db.postsCount || ''}
              {#if db.access?.write?.includes($identity?.id)}
                <svg class="inline-block w-3 h-3 {$isRTL ? 'ml-1' : 'mr-1'} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              {:else}
                <svg class="inline-block w-3 h-3 {$isRTL ? 'ml-1' : 'mr-1'} flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              {/if}
              {db.name}
            </span>
          </button>
        {/each}
      {:else}
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">{$_('no_databases')}</p>
      {/if}
    </div>
  </div>
  
  <!-- Peers Section -->
  <div class="mb-3">
    <h5 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-yellow-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-yellow-600"
      onclick={() => showPeers.update((value: boolean) => !value)}
      title={$showPeers ? $_("hide_connected_peers") : $_("show_connected_peers")}
    >
      {$_('peers')} ({$connectedPeersCount})
    </h5>
    <div class="space-y-1">
      {#if $libp2p}
        {#key $libp2p}
          <PeersList />
        {/key}
      {:else}
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">{$_('not_connected')}</p>
      {/if}
    </div>
  </div>
  
  <!-- Settings Section -->
  <div>
    <h5 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-green-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-green-600"
      onclick={() => showSettings.update((value: boolean) => !value)}
      title={$showSettings ? $_("hide_settings") : $_("show_settings")}
    >
      {$_('settings')}
    </h5>
  </div>
</div>

<style>
.sidebar-container {
  contain: layout;
  transform: translateZ(0); /* Forces GPU acceleration */
}

svg {
  width: 1em !important; /* Force consistent SVG sizing */
  height: 1em !important;
  display: inline-block;
  vertical-align: middle;
}

/* RTL specific styles */
:global([dir="rtl"]) .sidebar {
  right: 0;
  left: auto;
}

:global([dir="rtl"]) .sidebar button {
  text-align: right;
}

:global([dir="rtl"]) .sidebar .flex {
  flex-direction: row-reverse;
}
</style> 