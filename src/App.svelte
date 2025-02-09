<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import PostForm from './lib/PostForm.svelte';
  import PostList from './lib/PostList.svelte';
  import ThemeToggle from './lib/ThemeToggle.svelte';
  import DBManager from './lib/DBManager.svelte';
  import ConnectedPeers from './lib/ConnectedPeers.svelte';
  import Settings from './lib/Settings.svelte';
  import { initializeOrbitDB } from './lib/orbitdb';
  import { orbitStore, settings, postsDB, showDBManager, showPeers, showSettings} from './lib/store';


  $:{
    if($orbitStore) {
      try {
          initializeOrbitDB().then(()=>{
            console.log('OrbitDB initialized successfully')
          })
      } catch (error) {
        console.error('Error initializing OrbitDB:', error);
      }
    }
  }

  onDestroy(async () => {
    try {
      await $postsDB?.close();
      console.info('OrbitDB connections closed successfully');
    } catch (error) {
      console.error('Error closing OrbitDB connections:', error);
    }
  });
</script>
<svelte:head>
	<title>Orbit Blog {__APP_VERSION__}</title>
</svelte:head>

<main class="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
  <div class="max-w-7xl mx-auto py-8 px-4">
    <h1 class="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">{$settings?.blogName}</h1> 
    <h6>{__APP_VERSION__}</h6>
    
    <button 
      class="mb-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
      on:click={() => showDBManager.update(value => !value)}
    >
      {$showDBManager ? 'Hide' : 'Show'} Database Manager
    </button>

    <button 
      class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors"
      on:click={() => showPeers.update(value => !value)}
    >
      {$showPeers ? 'Hide' : 'Show'} Connected Peers
    </button> 

    <button 
      class="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors"
      on:click={() => showSettings.update(value => !value)}
    >
      {$showSettings ? 'Hide' : 'Show'} Settings
    </button> 

    {#if $showDBManager}
      <DBManager />
    {/if}
    
    {#if $showPeers}
      <ConnectedPeers />
    {/if}

    {#if $showSettings}
      <Settings />
    {/if}
    
    <div class="grid gap-8">
      <PostList />
      <PostForm />
    </div>
  </div>
</main>

<ThemeToggle />

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
      Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  button {
    /* background-color: inherit;  ensure buttons inherit the background color */
    color: inherit; /* ensure buttons inherit the text color */
    border: none; /* remove default button border */
    cursor: pointer; /* change cursor to pointer on hover */
  }

  button:hover {
    opacity: 0.9; /* Slightly reduce opacity on hover for visual feedback */
  }

  /* Ensure dark mode styles are applied correctly */
  .dark button {
    background-color: inherit;
    color: inherit;
  }
</style>