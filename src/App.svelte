<script lang="ts">
  // Svelte core
  import { onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  // IPFS & OrbitDB
  import { createHelia } from 'helia';
  import { createLibp2p } from 'libp2p';
  import { createOrbitDB, IPFSAccessController, Identities } from '@orbitdb/core';
  import { Voyager } from '@orbitdb/voyager';
  import { multiaddr } from '@multiformats/multiaddr';
  
  // Storage & Crypto
  import { LevelDatastore } from 'datastore-level';
  import { LevelBlockstore } from 'blockstore-level';
  import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
  import { privateKeyFromProtobuf } from '@libp2p/crypto/keys';
  import { generateMnemonic } from 'bip39';

  // Components
  import Sidebar from './components/Sidebar.svelte';
  import PostForm from './components/PostForm.svelte';
  import PostList from './components/PostList.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import DBManager from './components/DBManager.svelte';
  import ConnectedPeers from './components/ConnectedPeers.svelte';
  import Settings from './components/Settings.svelte';
  import PasswordModal from './components/PasswordModal.svelte';
  import LoadingBlog from './components/LoadingBlog.svelte';

  // Icons
  import { FaBars, FaTimes, FaShare } from 'svelte-icons/fa';

  // Local utilities and config
  import { Libp2pOptions, multiaddrs } from './lib/config';
  import { encryptSeedPhrase, decryptSeedPhrase, isEncryptedSeedPhrase } from './lib/cryptoUtils';
  import { generateMasterSeed, generateAndSerializeKey } from './lib/utils';
  import { initHashRouter, isLoadingRemoteBlog } from './lib/router';
  import { setupPeerEventListeners } from './lib/peerConnections';

  // Store imports
  import { 
    postsDB, 
    postsDBAddress, 
    posts, 
    selectedPostId,
    remoteDBs, 
    remoteDBsDatabases, 
    showDBManager, 
    showPeers, 
    showSettings, 
    blogName, 
    libp2p, 
    helia, 
    orbitdb, 
    identity, 
    identities, 
    settingsDB, 
    blogDescription, 
    categories, 
    seedPhrase, 
    voyager 
  } from './lib/store';

  let blockstore = new LevelBlockstore('./helia-blocks');
  let datastore = new LevelDatastore('./helia-data');

  let encryptedSeedPhrase = localStorage.getItem('encryptedSeedPhrase');

  let showPasswordModal = encryptedSeedPhrase ? true : false;
  let isNewUser = !encryptedSeedPhrase;
  let canWrite = false;

  // Add sidebar state variables
  let sidebarVisible = true;
  let touchStartX = 0;
  let touchEndX = 0;
  const SWIPE_THRESHOLD = 50;

  let routerUnsubscribe;

  let showNotification = false;

  if(!encryptedSeedPhrase) {
      console.log('no seed phrase, generating new one')
      $seedPhrase = generateMnemonic();
      initializeApp();
  }

  // Function to toggle sidebar visibility
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
  }

  async function handleSeedPhraseCreated(event: CustomEvent) {
    const newSeedPhrase = generateMnemonic();
    const encryptedPhrase = await encryptSeedPhrase(newSeedPhrase, event.detail.password);
    localStorage.setItem('encryptedSeedPhrase', encryptedPhrase);
    $seedPhrase = newSeedPhrase;
    showPasswordModal = false; // This will trigger the reactive statement above
    initializeApp();
  }

  async function handleSeedPhraseDecrypted(event: CustomEvent) {
    $seedPhrase = event.detail.seedPhrase;
    showPasswordModal = false; // This will trigger the reactive statement above
    initializeApp();
  }

  async function initializeApp() {
    if (!seedPhrase) return;
    
    console.log('initializeApp')
    const masterSeed = generateMasterSeed($seedPhrase, "password");
    const { hex } = await generateAndSerializeKey(masterSeed.subarray(0, 32))
    const privKeyBuffer = uint8ArrayFromString(hex, 'hex');
    const _keyPair = await privateKeyFromProtobuf(privKeyBuffer);
    $libp2p = await createLibp2p({ privateKey: _keyPair, ...Libp2pOptions })
    console.log('libp2p', $libp2p)
    $helia = await createHelia({ libp2p: $libp2p, datastore, blockstore })
    console.log('helia', $helia)
    // const ret = await getIdentity($helia, $seedPhrase) //DID identity
      // = ret.identity
    // $identities = ret.identities
    $identities = await Identities({ ipfs: $helia })
    $identity = await $identities.createIdentity({ id: 'me' })
  
    $orbitdb = await createOrbitDB({
      ipfs: $helia,
      //identity: ret.identity,
      identity: $identity,
      storage: blockstore,
      directory: './orbitdb',
    })
    const addr = multiaddr(multiaddrs[0])
    console.log('voyager', voyager)
    $voyager = await Voyager({ orbitdb: $orbitdb, address: addr})

    routerUnsubscribe = initHashRouter();
    
    
    // Set up peer event listeners from the separate module
    setupPeerEventListeners($libp2p);
  }

  $:if(window.location.hash.includes('#/orbitdb/')) {
    sidebarVisible = false;
  }
  /**
   * Check if the user has write access to the posts database
  */
  $:if ($orbitdb && $postsDB && $identity) {
      const access = $postsDB.access;
      canWrite = access.write.includes($identity.id) && $postsDB.address === $postsDBAddress
  }

  onDestroy(async () => {
    // Clean up router subscription
    if (routerUnsubscribe) routerUnsubscribe();
    
    try {
      await $settingsDB?.close();
      await $postsDB?.close();
    } catch (error) {
      console.error('Error closing OrbitDB connections:', error);
    }
  })

  $:if($orbitdb && voyager){
    console.log('connecting to voyager')
    $voyager?.orbitdb.open('settings', {
          type: 'documents',
          create: true,
          overwrite: false,
          directory: './orbitdb/settings',
          identity: $identity,
          identities: $identities,
          AccessController: IPFSAccessController({write: [$identity.id]}),
        }).then(_db => {
          $settingsDB = _db;
          window.settingsDB = _db;
          $voyager?.add(_db.address).then((ret) => {
            $settingsDB.pinnedToVoyager = ret;
            console.log('voyager added settingsDB', ret)
          }).catch( err => console.log('voyager error', err))
        }).catch( err => console.log('error', err))
        
        $voyager?.orbitdb.open('posts', {
          type: 'documents',
          create: true,
          overwrite: false,
          directory: './orbitdb/posts',
          identity: $identity,
          identities: $identities,
          AccessController: IPFSAccessController({write: [$identity.id]}),
        }).then(_db => {
          $postsDB = _db;
          window.postsDB = _db;
          $voyager?.add(_db.address).then((ret) => console.log('voyager added postsDB', ret))
          console.log('postsDB', _db.address.toString())
          $postsDBAddress = _db.address.toString()
        }).catch( err => console.log('error', err))

        $voyager?.orbitdb.open('remote-dbs', {
          type: 'documents',
          create: true,
          overwrite: false,
          identities: $identities,
          identity: $identity,
          AccessController: IPFSAccessController({write: [$identity.id]}),
        }).then(_db => {
          $remoteDBsDatabases = _db;
          window.remoteDBsDatabases = _db;
          $voyager?.add(_db.address).then((ret) => console.log('voyager added remoteDBsDatabases', ret))
        }).catch(err => console.error('Error opening remote DBs database:', err));
  }

  $:if($settingsDB && (!$blogName || !$blogDescription || !$categories || !$postsDBAddress)) {
    $settingsDB.get('blogName').then(result => 
      result?.value?.value !== undefined ? ($blogName = result.value.value) : null
    );
    
    $settingsDB.get('blogDescription').then(result => 
      result?.value?.value !== undefined ? ($blogDescription = result.value.value) : null
    );
    
    $settingsDB.get('categories').then(result => 
      result?.value?.value !== undefined ? ($categories = result.value.value) : null
    );
    $settingsDB.get('postsDBAddress').then(result => {
        if(result?.value?.value !== undefined){
          $postsDBAddress = result.value.value
        } else {
          const postsDBAddress = $postsDB?.address.toString()
          $settingsDB?.put({ _id: 'postsDBAddress', value: postsDBAddress});
          $settingsDB?.all().then(result => console.log('settingsDB.all()', result))
        }
      }
    )
    
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
      _remoteDBs.forEach(async db => {
        const _db = await $orbitdb.open(db.postsAddress,{sync: false});
        db.access = _db.access
        _db.all().then(posts => db.postsCount = posts.length).finally(() => {
          // console.log('db', db)
        })
      })
      $remoteDBs = _remoteDBs;
    })
    $settingsDB.events.on('update', async (entry) => {
      console.log('Database update:', entry);
      if (entry?.payload?.op === 'PUT') {
        const { _id, ...rest } = entry.payload.value;
        console.log('settingsDB update:', rest);
        // posts.update(current => [...current, { ...rest, _id: _id }]);
      } else if (entry?.payload?.op === 'DEL') {
        console.log('settingsDB delete:', entry.payload.key);
        // posts.update(current => current.filter(post => post._id !== entry.payload.key));
      }
    });
  }

  // Handle touch events for sidebar gestures
  function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
  }

  function handleTouchMove(e) {
    touchEndX = e.touches[0].clientX;
  }

  function handleTouchEnd() {
    if (touchStartX - touchEndX > SWIPE_THRESHOLD && sidebarVisible) {
      // Swipe left - hide sidebar
      sidebarVisible = false;
    } else if (touchEndX - touchStartX > SWIPE_THRESHOLD && !sidebarVisible) {
      // Swipe right - show sidebar
      sidebarVisible = true;
    }
  }

  // Add mouse-related functions
  function handleMouseEnter() {
    if (!sidebarVisible) {
      sidebarVisible = true;
    }
  }

  // Function to copy the settingsDB address to clipboard
  async function copySettingsDBAddress() {
    if ($settingsDB) {
      try {
        const address = $settingsDB.address.toString();
        await navigator.clipboard.writeText(address);
        showNotification = true;
        setTimeout(() => showNotification = false, 3000); // Hide notification after 3 seconds
      } catch (err) {
        console.error('Failed to copy address: ', err);
      }
    } else {
      alert('Settings database is not available.');
    }
  }

</script>
<svelte:head>
  <title>{$blogName} {__APP_VERSION__}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="description" content="{$blogDescription}">
  <!-- <meta name="author" content="{$blogName}"> -->
  <meta name="keywords" content="{$categories}">
  <meta name="author" content="{$blogName}">
  <meta name="robots" content="index, follow">
  <meta name="googlebot" content="index, follow">
  <meta name="bingbot" content="index, follow">
  <meta name="alexa" content="index, follow">
  <meta name="yandex" content="index, follow">
  <meta name="sitemap" content="index, follow">
  <!--no cache-->
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <!-- <meta name="cache-busting" content="{$cacheBusting}"> -->
  <meta name="theme-color" content="#000000">
  <meta name="msapplication-navbutton-color" content="#000000">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="application-name" content="{$blogName}">
  <meta name="apple-mobile-web-app-title" content="{$blogName}">
  <meta name="msapplication-TileColor" content="#000000">
  <meta name="msapplication-TileImage" content="{$blogName}">
  <meta name="msapplication-config" content="{$blogName}">
  <meta name="msapplication-starturl" content="{$blogName}">
  <meta name="msapplication-navbutton-color" content="#000000">
  <meta name="msapplication-TileColor" content="#000000">
  <meta name="msapplication-TileImage" content="{$blogName}">
</svelte:head>
{#if showPasswordModal}
  <PasswordModal 
    {isNewUser} 
    encryptedSeedPhrase={encryptedSeedPhrase}
    on:seedPhraseCreated={handleSeedPhraseCreated}
    on:seedPhraseDecrypted={handleSeedPhraseDecrypted}
  />
{:else}
  <main class="flex min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors"
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}>
    

    <!-- Sidebar Component with animation -->
    {#if sidebarVisible}
      <!-- Add overlay -->
      <div 
        class="fixed inset-0 bg-black bg-opacity-50 z-30"
        on:click={toggleSidebar}
        transition:fade
      ></div>
      
      <div in:fly={{ x: -400, duration: 400, easing: cubicOut }} 
           out:fly={{ x: -400, duration: 400, easing: cubicOut }}
           class="fixed top-0 left-0 h-full z-40 max-w-[80vw]">
        <button 
          class="absolute top-2 right-1 z-50 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full p-1 shadow-sm transition-all duration-300 focus:outline-none"
          on:click={toggleSidebar}
          aria-label="Hide sidebar">
          <div class="w-4 h-4 text-gray-800 dark:text-gray-200">
            <FaTimes />
          </div>
        </button>
        <Sidebar />
      </div>
    {:else}
      <!-- Fixed toggle button when sidebar is hidden -->
      <button 
        class="fixed top-4 left-4 z-50 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-full p-1 shadow-sm transition-all duration-300 focus:outline-none"
        on:click={toggleSidebar}
        aria-label="Show sidebar">
        <div class="w-4 h-4 text-gray-800 dark:text-gray-200">
          <FaBars />
        </div>
      </button>
      
      <!-- Sidebar trigger area for edge detection -->
      <div 
        class="w-8 h-full fixed top-0 left-0 z-10 cursor-pointer" 
        on:click={toggleSidebar}
        on:mouseenter={handleMouseEnter}
        aria-label="Show sidebar">
      </div>
    {/if}
    
    <!-- Main Content -->
    <div class="flex-1 overflow-x-hidden">
      {#if $isLoadingRemoteBlog}
        <LoadingBlog />
      {:else}
        <div class="max-w-7xl mx-auto py-8 px-4">
          <h1 class="text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">{$blogName}</h1> 
          <h6 class="text-sm text-center mb-8 text-gray-900 dark:text-white">{$blogDescription}</h6>
          <h6 class="text-xs text-center mb-8 text-gray-900 dark:text-white">{__APP_VERSION__}</h6>

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
      {/if}
    </div>
  </main>
    <!-- Add the sharing button with an icon -->
    <div class="fixed top-4 right-20 z-50">
    <button 
      class="fixed top-4 right-20 z-50 bg-blue-500 text-white hover:bg-blue-600 rounded-full p-1 shadow-sm transition-all duration-300 focus:outline-none w-6 h-6 flex items-center justify-center"
      on:click={copySettingsDBAddress}
      aria-label="Share blog address">
      <FaShare />
    </button> 
    
    <!-- Notification -->
    {#if showNotification}
      <div class="fixed top-16 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded shadow-lg transition-all duration-300">
        Blog address copied to clipboard!
      </div>
    {/if}

  <ThemeToggle /></div>
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

  /* Add styles for sidebar interaction */
  .w-4 {
    width: 1rem;
  }
  
  .h-full {
    height: 100%;
  }
  
  .fixed {
    position: fixed;
  }
  
  .top-0 {
    top: 0;
  }
  
  .left-0 {
    left: 0;
  }
  
  .z-10 {
    z-index: 10;
  }
  
  .cursor-pointer {
    cursor: pointer;
  }

  /* Make sure the sidebar takes appropriate space */
  :global(.sidebar) {
    padding-top: 3.5rem; /* Add space at the top of the sidebar for the toggle button */
  }

  /* Ensure consistent button positioning */
  button.fixed {
    position: fixed !important;
    transform: translateZ(0); /* Force hardware acceleration */
  }
  
  @media (max-width: 768px) {
    button.fixed {
      /* Ensure button stays on right side on mobile */
      left: auto !important;
      right: 4rem !important;
    }
  }

  /* Add a more specific selector for the share button */
  .share-button {
    left: auto !important;
    right: 20px !important;
  }
</style>