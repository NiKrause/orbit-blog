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
  import PasswordModal from './lib/PasswordModal.svelte';
  import { Libp2pOptions } from './lib/config'
  import { createPeerIdFromSeedPhrase } from './lib/utils'
  import { generateMnemonic } from 'bip39';
  import { getIdentity } from './lib/orbitdb';
  import { postsDB, postsDBAddress, posts, remoteDBs, remoteDBsDatabases, showDBManager, showPeers, showSettings, blogName, libp2p, helia, orbitdb, identity, identities, settingsDB, blogDescription, categories } from './lib/store';
  import Sidebar from './lib/Sidebar.svelte';
  import { encryptSeedPhrase, decryptSeedPhrase, isEncryptedSeedPhrase } from './lib/cryptoUtils';

  let blockstore = new LevelBlockstore('./helia-blocks');
  let datastore = new LevelDatastore('./helia-data');

  let encryptedSeedPhrase = localStorage.getItem('encryptedSeedPhrase');
  let seedPhrase: string | null = null;
  let showPasswordModal = true;
  let isNewUser = !encryptedSeedPhrase;
  let canWrite = false;

  async function handleSeedPhraseCreated(event: CustomEvent) {
    const newSeedPhrase = generateMnemonic();
    const encryptedPhrase = await encryptSeedPhrase(newSeedPhrase, event.detail.password);
    localStorage.setItem('encryptedSeedPhrase', encryptedPhrase);
    seedPhrase = newSeedPhrase;
    showPasswordModal = false;
    initializeApp();
  }

  async function handleSeedPhraseDecrypted(event: CustomEvent) {
    seedPhrase = event.detail.seedPhrase;
    showPasswordModal = false;
    initializeApp();
  }

  async function initializeApp() {
    if (!seedPhrase) return;
    
    console.log('App mounted')
    const peerId = await createPeerIdFromSeedPhrase(seedPhrase);
    console.log('peerId', peerId)
    $libp2p = await createLibp2p({ peerId, ...Libp2pOptions })
    console.log('libp2p', $libp2p)
    $helia = await createHelia({ libp2p: $libp2p, datastore, blockstore })
    console.log('helia', $helia)
    const ret = await getIdentity($helia)
    $identity = ret.identity
    $identities = ret.identities
    $orbitdb = await createOrbitDB({
      ipfs: $helia,
      identity: ret.identity,
      storage: blockstore,
      directory: './orbitdb',
    })
    console.log('orbitdb', $orbitdb)
  }

  /**
   * Check if the user has write access to the posts database
  */
  $:if ($orbitdb && $postsDB && $identity) {
      const access = $postsDB.access;
      canWrite = access.write.includes($identity.id) && $postsDB.address === $postsDBAddress
  }

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
          AccessController: IPFSAccessController({write: [$identity.id]}),
        }).then(_db => $settingsDB = _db).catch( err => console.log('error', err))
        
        $orbitdb.open('posts', {
          type: 'documents',
          create: true,
          overwrite: false,
          directory: './orbitdb/posts',
          identity: $identity,
          identities: $identities,
          AccessController: IPFSAccessController({write: [$identity.id]}),
        }).then(_db => {
          $postsDB = _db;
          console.log('postsDB', _db.address.toString())
          $postsDBAddress = _db.address.toString()
        }).catch( err => console.log('error', err))

        $orbitdb.open('remote-dbs', {
          type: 'documents',
          create: true,
          overwrite: false,
          identities: $identities,
          identity: $identity,
          AccessController: IPFSAccessController({write: [$identity.id]}),
        }).then(_db => $remoteDBsDatabases = _db).catch(err => console.error('Error opening remote DBs database:', err));
  }

  $:if($settingsDB) {
    $settingsDB.get('blogName').then(result => 
      result?.value?.value !== undefined ? ($blogName = result.value.value) : null
    );
    
    $settingsDB.get('blogDescription').then(result => 
      result?.value?.value !== undefined ? ($blogDescription = result.value.value) : null
    );
    
    $settingsDB.get('categories').then(result => 
      result?.value?.value !== undefined ? ($categories = result.value.value) : null
    );
    
    $settingsDB.events.on('update', 
    async (entry) => {
      if (entry?.payload?.op === 'PUT') {
        const { _id, ...rest } = entry.payload.value;
        if(entry.payload.key==='blogName') $blogName = rest.value;
        if(entry.payload.key==='blogDescription') $blogDescription = rest.value;
        if(entry.payload.key==='categories') $categories = rest.value;
       } else if (entry?.payload?.op === 'DEL') { }
    });
  }

  $:if($postsDB){
    $postsDB.all().then(posts => $posts = posts.map(entry => entry.value)).catch(err => console.error('Error opening posts database:', err));
    $postsDB.events.on('update', async (entry) => {
      console.log('Database update:', entry);
      if (entry?.payload?.op === 'PUT') {
        const { _id, ...rest } = entry.payload.value;
        posts.update(current => [...current, { ...rest, _id: _id }]);
      } else if (entry?.payload?.op === 'DEL') {
        posts.update(current => current.filter(post => post._id !== entry.payload.key));
      }
    });
  }

  $:if($remoteDBsDatabases){
    console.info('Remote DBs database opened successfully:', $remoteDBsDatabases);
    $remoteDBsDatabases.all().then(savedDBs => {
      const _remoteDBs = savedDBs.map(entry => entry.value);
      console.info('Remote DBs list:', _remoteDBs);
      $remoteDBs = _remoteDBs;
    })
  }

</script>
<svelte:head>
  <title>{$blogName} {__APP_VERSION__}</title>
</svelte:head>
{#if showPasswordModal}
  <PasswordModal 
    {isNewUser} 
    encryptedSeedPhrase={encryptedSeedPhrase}
    on:seedPhraseCreated={handleSeedPhraseCreated}
    on:seedPhraseDecrypted={handleSeedPhraseDecrypted}
  />
{:else}
  <main class="flex min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
    <!-- Sidebar Component -->
    <Sidebar />
    
    <!-- Main Content -->
    <div class="flex-1 overflow-x-hidden">
      <div class="max-w-7xl mx-auto py-8 px-4">
        <h1 class="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">{$blogName}</h1> 
        <h6 class="text-sm text-center mb-8 text-gray-900 dark:text-white">{$blogDescription}</h6>
        <h6>{__APP_VERSION__}</h6>

        {#if $showDBManager}
          <DBManager />
        {/if}
        
        {#if $showPeers}
          <ConnectedPeers />
        {/if}

        {#if $showSettings}
          <Settings {seedPhrase} />
        {/if}
        
        <div class="grid gap-8">
          <PostList />
          {#if canWrite}
            <PostForm />
          {/if}

        </div>
      </div>
    </div>
  </main>

  <ThemeToggle />
{/if}

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