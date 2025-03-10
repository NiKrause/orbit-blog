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
    settingsDB
  } from './store';
  import { switchToRemoteDB } from './dbUtils';
  import PeersList from './PeersList.svelte';
</script>

<div class="w-48 bg-gray-200 dark:bg-gray-800 p-2 shadow-md overflow-y-auto">
  <!-- DBs Section -->
  <div class="mb-3">
    <h5 
      class="text-[10px] font-bold uppercase tracking-wider text-white dark:text-white bg-blue-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-blue-600"
      on:click={() => showDBManager.update(value => !value)}
      title={$showDBManager ? "Hide Database Manager" : "Show Database Manager"}
    >
      Blogs
    </h5>
    <div class="space-y-1">
      {#if $remoteDBs?.length > 0}
        {#each $remoteDBs as db}
          <button 
            class="w-full text-left py-0.5 px-1 rounded text-[8px] truncate {$postsDBAddress === db.address ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500'}"
            on:click={() => switchToRemoteDB(db.address)}
            title={db.name}
          >
            {db.name}
          </button>
        {/each}
      {:else}
        <p class="text-[8px] text-gray-500 dark:text-gray-400">No databases</p>
      {/if}
    </div>
  </div>
  
  <!-- Peers Section -->
  <div class="mb-3">
    <h5 
      class="text-[10px] font-bold uppercase tracking-wider text-white dark:text-white bg-yellow-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-yellow-600"
      on:click={() => showPeers.update(value => !value)}
      title={$showPeers ? "Hide Connected Peers" : "Show Connected Peers"}
    >
      Peers
    </h5>
    <div class="space-y-1">
      {#if $libp2p}
        {#key $libp2p}
          <PeersList />
        {/key}
      {:else}
        <p class="text-[8px] text-gray-500 dark:text-gray-400">Not connected</p>
      {/if}
    </div>
  </div>
  
  <!-- Settings Section -->
  <div>
    <h5 
      class="text-[10px] font-bold uppercase tracking-wider text-white dark:text-white bg-green-500 rounded py-1 px-2 mb-1 cursor-pointer hover:bg-green-600"
      on:click={() => showSettings.update(value => !value)}
      title={$showSettings ? "Hide Settings" : "Show Settings"}
    >
      Settings
    </h5>
    <div class="space-y-1">
      <div 
        class="text-[8px] text-gray-800 dark:text-gray-300 bg-gray-300 dark:bg-gray-600 p-1 rounded cursor-pointer hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
        on:click={async () => {
          // Get the address from settingsDB
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
        <p class="truncate"><strong>Blog:</strong> {$blogName || 'Not set'}</p>
        <p class="truncate"><strong>ID:</strong> {$identity?.id ? $identity.id.substring(0, 18) + '...' : 'Not connected'}</p>
        <p class="text-[7px] text-blue-500 dark:text-blue-400 mt-1">(Click to load your blog)</p>
      </div>
    </div>
  </div>
</div> 