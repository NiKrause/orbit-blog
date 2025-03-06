<script lang="ts">

  import { onMount, onDestroy } from 'svelte';
  import { createOrbitDB, IPFSAccessController } from '@orbitdb/core';
  import { createLibp2p } from 'libp2p'
  import { createHelia } from 'helia'
  import { LevelDatastore } from 'datastore-level'
  import { LevelBlockstore } from 'blockstore-level'
  import PostForm from './lib/PostForm.svelte';
  import PostList from './lib/PostList.svelte';
  import ThemeToggle from './lib/ThemeToggle.svelte';
  import DBManager from './lib/DBManager.svelte';
  import ConnectedPeers from './lib/ConnectedPeers.svelte';
  import Settings from './lib/Settings.svelte';
  import { Libp2pOptions } from './lib/config'
  import { createPeerIdFromSeedPhrase } from './lib/utils'
  import { generateMnemonic } from 'bip39';
  import { getIdentity, initializeDBs } from './lib/orbitdb';
  import { postsDB, remoteDBs, remoteDBsDatabase, showDBManager, showPeers, showSettings, blogName, libp2p, helia, orbitdb, identity, identities, settingsDB, blogDescription } from './lib/store';

  let blockstore = new LevelBlockstore('./helia-blocks');
  let datastore = new LevelDatastore('./helia-data');

  // Check if seed phrase is stored in localStorage, if not generate a new one
  let seedPhrase = localStorage.getItem('seedPhrase');
  if (!seedPhrase) {
      seedPhrase = generateMnemonic(); // Generate a new mnemonic
      localStorage.setItem('seedPhrase', seedPhrase); // Store the new seed phrase in localStorage
  }

  onMount(async () => {

    console.log('App mounted')
    const peerId = await createPeerIdFromSeedPhrase(seedPhrase);
    console.log('peerId', peerId)
    $libp2p = await createLibp2p({ peerId, ...Libp2pOptions })
    console.log('libp2p', $libp2p)
    $helia = await createHelia({ libp2p: $libp2p, datastore, blockstore })
    console.log('helia', $helia)
    const ret = await getIdentity()
    $identity = ret.identity
    $identities = ret.identities
    $orbitdb = await createOrbitDB({
      ipfs: $helia,
      identity: ret.identity,
      storage: blockstore,
      directory: './orbitdb',
    })
    console.log('orbitdb', $orbitdb)
    await initializeDBs(ret.identity, ret.identities)
  })

  onDestroy(async () => {
    try {
      await $settingsDB?.close();
      await $postsDB?.close();
    } catch (error) {
      console.error('Error closing OrbitDB connections:', error);
    }
  })

  $:if($orbitdb){
    
        $orbitdb.open('settings', {
          type: 'documents',
          create: true,
          overwrite: false,
          directory: './orbitdb/settings',
          identity: $identity,
          identities: $identities,
          // AccessController: IPFSAccessController({write: ["*"]}),
          AccessController: IPFSAccessController({write: [$identity.id]}),
        }).then(_db => $settingsDB = _db).catch( err => console.log('error', err))

        $orbitdb.open('remote-dbs', {
          type: 'documents',
          create: true,
          overwrite: false,
          AccessController: IPFSAccessController({write: [$identity.id]}),
        }).then(db => $remoteDBsDatabase = db).catch(err => console.error('Error opening remote DBs database:', err));
  }

  $:if($settingsDB) {
    $settingsDB.get('blogName').then(( _ ) => $blogName = _?.value?.value);
    $settingsDB.get('blogDescription').then( _  => $blogDescription = _?.value?.value);
    $settingsDB.events.on('update', 
    async (entry) => {
      if (entry?.payload?.op === 'PUT') {
        const { _id, ...rest } = entry.payload.value;
        if(entry.payload.key==='blogName') $blogName = rest.value;
        if(entry.payload.key==='blogDescription') $blogDescription = rest.value;
       } else if (entry?.payload?.op === 'DEL') { }
    });
  }

  $:if($remoteDBsDatabase){
    console.info('Remote DBs database opened successfully:', $remoteDBsDatabase);
    $remoteDBsDatabase.all().then(savedDBs => {
      const _remoteDBs = savedDBs.map(entry => entry.value);
      console.info('Remote DBs list:', _remoteDBs);
      $remoteDBs = _remoteDBs;
    })
  }

</script>
<svelte:head>
	<title>{$blogName} {__APP_VERSION__}</title>
</svelte:head>

<main class="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
  <div class="max-w-7xl mx-auto py-8 px-4">
    <h1 class="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">{$blogName}</h1> 
    <h6 class="text-sm text-center mb-8 text-gray-900 dark:text-white">{$blogDescription}</h6>
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