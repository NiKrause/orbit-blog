<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsDB, postsDB, remoteDBs, selectedDBAddress, posts, remoteDBsDatabase, orbitdb, helia,identity,libp2p } from './store';
  import { IPFSAccessController } from '@orbitdb/core';
  import type { RemoteDB } from './types';
  import QRCode from 'qrcode';
  import Modal from './Modal.svelte';

  let dbAddress = '';
  let dbName = '';
  let currentDBAddress = '';
  let remoteDBsList: RemoteDB[] = [];
  let qrCodeDataUrl = '';
  let showScanner = false;
  let videoElement: HTMLVideoElement;
  let peerId = '';
  let currentPosts: any[] = [];
  let isModalOpen = false;
  let dbContents = [];
  let did = '';


  $: {
    peerId = $libp2p?.peerId.toString();
    did = $identity?.id;
  }

  // $: if ($postsDB) {
  //       currentDBAddress = $postsDB.address;
  //       $selectedDBAddress = currentDBAddress;
  //       console.info('Current DB address:', currentDBAddress);
  //       generateQRCode(currentDBAddress);
        
  //       try {
  //         currentPosts = $postsDB.all().then((posts)=>{
  //           $posts = posts.map(entry => {
  //             const { _id, ...rest } = entry.value;
  //             return { ...rest, id: _id };
  //           })
  //         })

  //       } catch (error) {
  //         console.error('Error loading current DB posts:', error);
  //       }
  // }

  // $: if($orbitdb) {

  //   // Initialize remote DBs store
  //   $orbitdb.open('remote-dbs', {
  //     type: 'documents',
  //     create: true,
  //     overwrite: false,
  //     AccessController: IPFSAccessController({
  //       write: ["*"]
  //     }),
  //   }).then(remoteDBsDatabase => {
  //     console.info('Remote DBs database opened successfully:', remoteDBsDatabase);
  //     $remoteDBsDatabase = remoteDBsDatabase;
  //     return remoteDBsDatabase.all();
  //   }).then(savedDBs => {
  //     remoteDBsList = savedDBs.map(entry => entry.value);
  //     $remoteDBs = remoteDBsList;
  //     console.info('Remote DBs list:', remoteDBsList);
  //   }).catch(error => {
  //     console.error('Error loading remote DBs:', error);
  //   });
  // }

  async function generateQRCode(text: string) {

    try {
      qrCodeDataUrl = await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  async function startScanner() {
    try {
      showScanner = true;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.play();
        
        // Start scanning frames
        requestAnimationFrame(scanQRCode);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      showScanner = false;
    }
  }

  async function stopScanner() {

    if (videoElement && videoElement.srcObject) {
      const stream = videoElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoElement.srcObject = null;
    }
    showScanner = false;
  }

  async function scanQRCode() {
    
    if (!showScanner || !videoElement) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx && videoElement.videoWidth > 0) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Here you would typically use a QR code detection library
        // For this example, we'll simulate detection by assuming any text is a valid address
        const scannedText = await new Promise<string>((resolve) => {
          // Simulate QR code detection
          setTimeout(() => {
            resolve(dbAddress || 'scanned-address');
          }, 100);
        });

        if (scannedText) {
          dbAddress = scannedText;
          await stopScanner();
          return;
        }
      }

      requestAnimationFrame(scanQRCode);
    } catch (error) {
      console.error('Error scanning QR code:', error);
      requestAnimationFrame(scanQRCode);
    }
  }

  async function addRemoteDB() {
    console.log('Adding DB:', { dbAddress, dbName });
    if (dbAddress && dbName) {
      try {
        const newDB: RemoteDB = {
          id: crypto.randomUUID(),
          name: dbName,
          address: dbAddress,
          date: new Date().toISOString().split('T')[0]
        };

        const remoteDBsDatabase = await $orbitdb.open('remote-dbs', {
          type: 'documents',
          create: true,
          overwrite: false
        });

        console.log('Database opened successfully:', remoteDBsDatabase);
        
        await remoteDBsDatabase.put({ _id: newDB.id, ...newDB });
        console.log('Database entry added:', newDB);
        remoteDBsList = [...remoteDBsList, newDB];
        $remoteDBs = remoteDBsList;
        console.log('Updated remoteDBsList:', remoteDBsList);
        console.log('Store value:', $remoteDBs);

        dbAddress = '';
        dbName = '';
      } catch (error) {
        console.error('Error adding remote DB:', error);
      }
    } else {
      console.log('Missing required fields');
    }
  }

  async function switchToRemoteDB(address: string) {
    try {
        // Open the selected database using OrbitDB
        const db = await $orbitdb.open(address, {
          type: 'documents', // Ensure this matches the type of your database
          create: false, // Do not create if it doesn't exist
        });

        // Fetch all contents of the DB
        dbContents = await db.all();
        isModalOpen = true; // Open the modal to show contents
    } catch (error) {
      console.error('Failed to switch to remote DB:', error);
    }
  }

  function removeRemoteDB(id: string) {
    remoteDBsList = remoteDBsList.filter(db => db.id !== id);
    $remoteDBs = remoteDBsList;
  }

  async function dropAndSync() {
    try {
      // Drop the local database
      await $postsDB.drop();
      console.info('Local database dropped successfully');
      
      console.info('resyncing from network');
    } catch (error) {
      console.error('Error during drop and sync:', error);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('Text copied to clipboard:', text);
    }).catch(err => {
      console.error('Error copying text to clipboard:', err);
    });
  }
</script>

<div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
  <div class="mb-4">
    <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Current Database</h3>
    <div class="mb-4 text-sm">
      <div class="flex items-center space-x-2">
        <span class="text-gray-600 dark:text-gray-400">Peer ID:</span>
        <input
          type="text"
          size={60}
          readonly
          value={peerId}
          class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm"
        />
        <button on:click={() => copyToClipboard(peerId)} class="text-gray-500 hover:text-gray-700">
          📋
        </button>
      </div>
    </div>

    <div class="mb-4 text-sm">
      <div class="flex items-center space-x-2">
        <span class="text-gray-600 dark:text-gray-400">DID:</span>
        <input
          type="text"
          size={60}
          readonly
          value={did}
          class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm"
        />
        <button on:click={() => copyToClipboard(did)} class="text-gray-500 hover:text-gray-700">
          📋
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="space-y-2">
        <div class="flex items-center space-x-2">
          <span class="text-gray-600 dark:text-gray-400">Our Settings DB:</span>
          <input
            type="text"
            size={70}
            value={$settingsDB?.address}
            class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm"
          />
          <button on:click={() => copyToClipboard($settingsDB?.address || '')} class="text-gray-500 hover:text-gray-700">
            📋
          </button>
        </div>
        <div class="flex flex-col md:flex-row justify-center items-center gap-4">
          {#if qrCodeDataUrl}
            <div class="flex justify-center bg-white p-4 rounded-lg">
              <img src={qrCodeDataUrl} alt="Database QR Code" class="w-48 h-48" />
            </div>
          {/if}
          <button
            on:click={dropAndSync}
            class="bg-purple-600 dark:bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
            </svg>
            Drop Posts & Sync from Network
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="border-t dark:border-gray-700 pt-4">
    <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add Remote Database</h3>
    <div class="space-y-4">
      <div>
        <label for="dbName" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Database Name</label>
        <input
          id="dbName"
          type="text"
          bind:value={dbName}
          placeholder="My Friend's Blog"
          class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label for="dbAddress" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Database Address</label>
        <div class="flex space-x-2">
          <input
            id="dbAddress"
            type="text"
            bind:value={dbAddress}
            placeholder="Paste database address here"
            class="flex-1 mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
          <button
            on:click={startScanner}
            class="mt-1 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
          >
            Scan QR
          </button>
        </div>
      </div>
      <button
        on:click={addRemoteDB}
        class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
      >
        Add Remote Database
      </button>
    </div>
  </div>

  {#if showScanner}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 p-4 rounded-lg max-w-lg w-full mx-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Scan QR Code</h3>
          <button
            on:click={stopScanner}
            class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>
        <video
          bind:this={videoElement}
          class="w-full aspect-square object-cover rounded-lg"
          playsinline
        ></video>
      </div>
    </div>
  {/if}

  {#if remoteDBsList.length > 0}
    <div>Number of databases: {remoteDBsList.length}</div>
    <div class="border-t dark:border-gray-700 mt-6 pt-4">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Available Databases</h3>
      <div class="space-y-2">
        {#each remoteDBsList as db}
          <div class="flex items-center space-x-2">
            <button
              class="flex-1 text-left p-3 rounded-md transition-colors {$selectedDBAddress === db.address ? 'bg-indigo-50 dark:bg-indigo-900/50 border-2 border-indigo-500' : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'}"
              on:click={() => switchToRemoteDB(db.address)}
            >
              <div class="flex justify-between items-center">
                <div>
                  <div class="font-medium text-gray-900 dark:text-white">{db.name}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-400 truncate">{db.address}</div>
                </div>
                {#if $selectedDBAddress === db.address}
                  <span class="text-indigo-600 dark:text-indigo-400 text-sm font-medium">Current</span>
                {/if}
              </div>
            </button>
            <button
              class="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
              on:click={() => removeRemoteDB(db.id)}
              title="Remove database"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <Modal isOpen={isModalOpen} onClose={() => isModalOpen = false}>
    <h2 class="text-xl font-bold mb-4">Database Contents</h2>
    <ul>
      {#each dbContents as content}
        <li class="mb-2">{JSON.stringify(content)}</li>
      {/each}
    </ul>
  </Modal>
</div>

<style>
  /* Add any additional styles here */
</style>