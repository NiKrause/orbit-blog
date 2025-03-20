<script lang="ts">
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
  } from '../lib/store';
  import { get } from 'svelte/store';
  import { switchToRemoteDB } from '../lib/dbUtils';
  import PeersList from './PeersList.svelte';
  import { connectedPeersCount } from '../lib/peerConnections';
  
  let _settingsDB: any, _identity: any, _postsDB: any, _postsDBAddress: any;
  
  settingsDB.subscribe(val => _settingsDB = val);
  identity.subscribe(val => _identity = val);
  postsDB.subscribe(val => _postsDB = val);
  postsDBAddress.subscribe(val => _postsDBAddress = val);
  
  let canWrite = false
  $: if(_settingsDB && _identity && _postsDB && _postsDBAddress){
    const access = _settingsDB?.access?.write;
    canWrite = access?.includes(_identity?.id)
    // canWrite = access.write.includes(_identity.id) && get(initialAddress) === _postsDBAddress
  }
</script>

<div class="w-48 md:w-64 bg-gray-200 dark:bg-gray-800 p-2 shadow-md overflow-y-auto">
  <!-- DBs Section -->
  <div class="mb-3">
    <h5 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-blue-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-blue-600"
      on:click={() => showDBManager.update(value => !value)}
      title={$showDBManager ? "Hide Database Manager" : "Show Database Manager"}
    >
      Blogs
    </h5>
    <div class="space-y-1">
      <div 
        class="text-[10px] md:text-xs text-gray-800 dark:text-gray-300 bg-gray-300 dark:bg-gray-600 p-1 rounded cursor-pointer hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
        on:click={async () => {
          if ($settingsDB.address) {
            try {   
                switchToRemoteDB($settingsDB.address);
            } catch (error) {
              console.error('Error retrieving postsDBAddress from settingsDB:', error);
            }
          }
        }}  
        title="Click to load your own blog"
      >
        <p class="truncate">
                {#if $settingsDB && $settingsDB.pinnedToVoyager !== undefined}
            <span 
              class="inline-block ml-1 w-2 h-2 rounded-full {$settingsDB.pinnedToVoyager ? 'bg-green-500' : canWrite ? 'bg-orange-500' : 'bg-red-500'}"
              title={$settingsDB.pinnedToVoyager ? "Pinned to Voyager" : canWrite ? "Not pinned to Voyager" : "No Write Access"}
            ></span>
          {/if}
          <strong>Blog:</strong> {$blogName || 'Not set'}
        </p>
        <p class="truncate">
          {#if $identity?.id}
            <span class="inline-block">
              {#if canWrite}
                <svg class="inline-block w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              {:else}
                <svg class="inline-block w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              {/if}
            </span>
            <strong>ID:</strong> {$identity.id.substring(0, 18) + '...'}
          {:else}
            Not connected
          {/if}
        </p>
      </div>
    </div>
    <div class="space-y-1">
      {#if $remoteDBs?.length > 0}
        {#each $remoteDBs as db}
          <button 
            class="w-full text-left py-0.5 px-1 rounded text-[10px] md:text-xs truncate max-h-8 flex items-center {$postsDBAddress === db.address ? 'bg-blue-500 text-white' : db.access?.write?.includes($identity?.id) ? 'bg-green-300 dark:bg-green-600 text-gray-800 dark:text-gray-200 hover:bg-amber-400 dark:hover:bg-amber-500' : 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500'}"
            on:click={() => switchToRemoteDB(db.address)}
            title={db.name}
          >
            {#if db.pinnedToVoyager !== undefined}
              <span 
                class="inline-block ml-1 w-2 h-2 rounded-full flex-shrink-0 {db.pinnedToVoyager ? 'bg-green-500' : 'bg-orange-500'}"
                title={db.pinnedToVoyager ? "Pinned to Voyager" : "Not pinned to Voyager"}
              ></span>
            {/if}
            <span class="whitespace-nowrap overflow-hidden overflow-ellipsis">
              {db.postsCount || ''}
              {#if db.access?.write?.includes($identity?.id)}
                <svg class="inline-block w-3 h-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              {:else}
                <svg class="inline-block w-3 h-3 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              {/if}
              {db.name}
            </span>
          </button>
        {/each}
      {:else}
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">No databases</p>
      {/if}
    </div>
  </div>
  
  <!-- Peers Section -->
  <div class="mb-3">
    <h5 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-yellow-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-yellow-600"
      on:click={() => showPeers.update(value => !value)}
      title={$showPeers ? "Hide Connected Peers" : "Show Connected Peers"}
    >
      Peers ({$connectedPeersCount})
    </h5>
    <div class="space-y-1">
      {#if $libp2p}
        {#key $libp2p}
          <PeersList />
        {/key}
      {:else}
        <p class="text-[10px] md:text-xs text-gray-500 dark:text-gray-400">Not connected</p>
      {/if}
    </div>
  </div>
  
  <!-- Settings Section -->
  <div>
    <h5 
      class="text-xs md:text-sm font-bold uppercase tracking-wider text-white dark:text-white bg-green-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-green-600"
      on:click={() => showSettings.update(value => !value)}
      title={$showSettings ? "Hide Settings" : "Show Settings"}
    >
      Settings
    </h5>
  </div>
</div> 