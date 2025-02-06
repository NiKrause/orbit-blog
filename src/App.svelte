<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import PostForm from './lib/PostForm.svelte';
  import PostList from './lib/PostList.svelte';
  import ThemeToggle from './lib/ThemeToggle.svelte';
  import DBManager from './lib/DBManager.svelte';
  import ConnectedPeers from './lib/ConnectedPeers.svelte';
  import { heliaStore, orbitStore, postsDB, posts, remoteDBsDatabase, remoteDBs } from './lib/store';
  import { IPFSAccessController } from '@orbitdb/core';

  let showDBManager = false;
  let showPeers = false;

  onMount(async () => {
    console.log('Initializing OrbitDB...');
    try {
      
      $postsDB = await $orbitStore.open('posts', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/posts',
        AccessController: IPFSAccessController({
          write: ["*"]
        }),
      });

      $remoteDBsDatabase = await $orbitStore.open('remote-dbs', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/remote-dbs',
        AccessController: IPFSAccessController({
          write: ["*"]
        }),
      });

      $remoteDBsDatabase.events.on('update', async (entry) => {
        console.log('Remote DBs update:', entry);
        const savedDBs = await $remoteDBsDatabase.all();
        $remoteDBs = savedDBs.map(entry => entry.value);
      });

      const savedDBs = await $remoteDBsDatabase.all();
      $remoteDBs = savedDBs.map(entry => entry.value);
      console.info('Remote DBs list:', $remoteDBs);

      console.info('OrbitDB initialized successfully', $orbitStore);
      console.info('Postsdb initialized successfully', $postsDB);
      let currentPosts = await $postsDB.all();
      console.log('Current posts:', currentPosts);

      if (currentPosts.length === 0) {
        console.info('No existing posts found, initializing with sample data');
        for (const post of $posts) {
          console.log('Adding post:', post);
          const postWithId = {
            ...post,
            _id: post._id // Add _id field while keeping the original id
          };
          console.log('Adding post with _id:', postWithId);
          await $postsDB.put(postWithId);
        }
      } else {
        console.info('Loading existing posts from OrbitDB');
        $posts = currentPosts.map(entry => {
          const { _id, ...rest } = entry.value;
          return { ...rest, _id: _id }; // Convert _id back to id
        });
      }
      
      $postsDB?.events.on('join', async (peerId, heads) => {
        // The peerId of the ipfs1 node.
        console.log("peerId", peerId)
      })

      $postsDB?.events.on('update', async (entry) => {
        console.log('Database update:', entry);
        if (entry?.payload?.op === 'PUT') {
          const { _id, ...rest } = entry.payload.value;
          $posts = [...$posts, { ...rest, _id: _id }];
        } else if (entry?.payload?.op === 'DEL') {
          $posts = $posts.filter(post => post._id !== entry.payload.key);
        }
      });
    } catch (error) {
      console.error('Error initializing OrbitDB:', error);
    }
  });

  onDestroy(async () => {
    console.log('Closing OrbitDB connections...');
    try {
      await $postsDB?.close();
      await $orbitStore?.close();
      await $heliaStore?.close();
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
    <h1 class="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">Orbit Blog</h1>
    
    <button 
      class="mb-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
      on:click={() => showDBManager = !showDBManager}
    >
      {showDBManager ? 'Hide' : 'Show'} Database Manager
    </button>

    <button 
      class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md transition-colors"
      on:click={() => showPeers = !showPeers}
    >
      {showPeers ? 'Hide' : 'Show'} Connected Peers
    </button> 

    {#if showDBManager}
      <DBManager />
    {/if}
    
    {#if showPeers}
      <ConnectedPeers />
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