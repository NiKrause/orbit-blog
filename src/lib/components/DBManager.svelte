<script lang="ts">
  import { run } from 'svelte/legacy';
  import { _ } from 'svelte-i18n';

  import { onDestroy } from 'svelte';
  import { settingsDB, postsDB, posts, allComments, allMedia, remoteDBs, selectedDBAddress, orbitdb, voyager, remoteDBsDatabases, identity, identities, isRTL } from '$lib/store.js';
  import QRCode from 'qrcode';
  import Modal from './Modal.svelte';
  import { switchToRemoteDB, addRemoteDBToStore } from '$lib/dbUtils.js';
  import { IPFSAccessController } from '@orbitdb/core';
  import ConfirmModal from './ConfirmModal.svelte';
  import type { RemoteDB } from '$lib/types.js';
  import { error, debug } from '../utils/logger.js'

  let dbAddress = $state('');
  let dbName = $state('');
  let dbPeerId = '';
  let qrCodeDataUrl = '';
  let showScanner = $state(false);
  let videoElement: HTMLVideoElement | undefined = $state();
  let isModalOpen = $state(false);
  let did = '';
  let modalMessage = $state($_("loading_database_from_p2p"));
  let cancelOperation = false;
  let queueCheckInterval: number | undefined = $state();
  let isQueueRunning = false;
  let isLocalDB = $state(false);
  let showConfirmModal = $state(false);
  let dbToRemove: string | null = null;

  async function generateQRCode(text: string) {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
      });
    } catch (_error) {
      error('Error generating QR code:', _error);
    }
  }

  async function startScanner() {
    try {
      showScanner = true;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      
      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.play();
        requestAnimationFrame(scanQRCode);
      }
    } catch (_error) {
      error('Error accessing camera:', _error);
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
    } catch (_error) {
      error('Error scanning QR code:', _error);
      requestAnimationFrame(scanQRCode);
    }
  }

  async function processQueue() {
    if (isQueueRunning) return;
    
    try {
      isQueueRunning = true;
      debug('Processing database queue...');
      
      const dbsToFetch = $remoteDBs.filter(db => db.fetchLater);
      
      if (dbsToFetch.length === 0) {
        debug('No databases in the queue.');
        
        // Clear the interval since there's nothing to process
        if (queueCheckInterval) {
          clearInterval(queueCheckInterval);
          queueCheckInterval = undefined;
          debug('Queue checking stopped - no databases in queue');
        }
        
        return;
      }
      
      debug(`Found ${dbsToFetch.length} database(s) in the queue.`);
      
      for (const db of dbsToFetch) {
        try {
          debug(`Processing queued database: ${db.name} (${db.address})`);
          
          const settingsDb = await $orbitdb.open(db.address);
          const settingsData = await settingsDb.all()
          debug('settingsData', settingsData);
          debug('settingsDb', settingsDb);
          if (!db.name || db.name === 'Unknown Blog') {
            debug('db.name', db.name);
            const blogNameEntry = await settingsDb.get('blogName');
            debug('blogNameEntry', blogNameEntry);
            if (blogNameEntry?.value?.value) {
              db.name = blogNameEntry.value.value;
              db.fetchLater = false;
            }else db.fetchLater = true;
          }
          
          // Check and open posts database
          debug('Checking posts database...');
          const postsAddressEntry = await settingsDb.get('postsDBAddress');
          if (postsAddressEntry?.value?.value) {
            db.postsAddress = postsAddressEntry.value.value;
            const postsDb = await $orbitdb.open(db.postsAddress);
            const allPosts = await postsDb.all();
            db.postsCount = allPosts.length;
            $posts = allPosts.map(entry => ({
              ...entry.value,
              identity: entry.identity
            }));
            db.fetchLater = false;
            debug(`Successfully fetched ${allPosts.length} posts from ${db.name}`);
          } else db.fetchLater = true;

          // Check and open comments database
          debug('Checking comments database...');
          const commentsAddressEntry = await settingsDb.get('commentsDBAddress');
          if (commentsAddressEntry?.value?.value) {
            db.commentsAddress = commentsAddressEntry.value.value;
            const commentsDb = await $orbitdb.open(db.commentsAddress);
            const _allComments = await commentsDb.all();
            db.commentsCount = _allComments.length;
            $allComments = _allComments.map(entry => ({
              ...entry.value,
              identity: entry.identity
            }));
          }

          // Check and open media database
          debug('Checking media database...');
          const mediaAddressEntry = await settingsDb.get('mediaDBAddress');
          if (mediaAddressEntry?.value?.value) {
            db.mediaAddress = mediaAddressEntry.value.value;
            const mediaDb = await $orbitdb.open(db.mediaAddress);
            const _allMedia = await mediaDb.all();
            db.mediaCount = _allMedia.length;
            $allMedia = _allMedia.map(entry => ({
              ...entry.value,
              identity: entry.identity
            }));
          }
          db.lastProcessed = new Date().toISOString();
          
          await $remoteDBsDatabases.put({ _id: db.id, ...db });
          
          debug(`Successfully processed queued database: ${db.name}`);
        } catch (_error) {
          error(`Error processing queued database ${db.name}:`, _error);
          db.lastAttempt = new Date().toISOString();
          await $remoteDBsDatabases.put({ _id: db.id, ...db });
        }
      }
      
      $remoteDBs = [...$remoteDBs];
      
    } catch (_error) {
      error('Error processing database queue:', _error);
    } finally {
      isQueueRunning = false;
    }
  }

  onDestroy(() => {
    if (queueCheckInterval) {
      clearInterval(queueCheckInterval);
    }
  });

  async function addRemoteDB() {
    debug('Adding DB:', { dbAddress, dbName , dbPeerId});
    if (dbAddress || dbName) {
      isModalOpen = true;
      modalMessage = isLocalDB ? $_('creating_local_database') : $_('connecting_to_remote_database');
      
      try {
        const success = await addRemoteDBToStore(dbAddress, dbPeerId, dbName);
        if (success) {
          debug($_('database_added_successfully'), dbAddress);
        } else {
          debug($_('failed_to_add_database_queued'));
        }
        
        dbAddress = '';
        dbName = '';
        isModalOpen = false;
        
        // If any databases need to be fetched later and there's no queue interval running, start it
        if ($remoteDBs.some(db => db.fetchLater) && !queueCheckInterval) {
          debug('Starting queue checking - new database added to queue');
          queueCheckInterval = window.setInterval(processQueue, 30 * 1000);
          processQueue(); // Process immediately
        }
      } catch (_err) {
        console.error('Error opening remote database:', _err);
        modalMessage = `${$_('error')}: ${err.message || $_('unknown_error')} - ${$_('adding_to_queue_for_later')}`;
        
        await addRemoteDBToStore(dbAddress, dbName);
        
        dbAddress = '';
        dbName = '';
        
        setTimeout(() => {
          isModalOpen = false;
        }, 3000);
        
        // Same check here for the error case where we queue the DB
        if (!queueCheckInterval) {
          debug('Starting queue checking - new database added to queue after error');
          queueCheckInterval = window.setInterval(processQueue, 30 * 1000);
          processQueue(); // Process immediately
        }
      }
    } else {
      debug($_('missing_required_fields'));
    }
  }

  async function handleSwitchToRemoteDB(address: string) {
    isModalOpen = true;
    cancelOperation = false;
    modalMessage = $_("loading_data_from_remote_database");
    
    await switchToRemoteDB(address, true);
    
    isModalOpen = false;
  }

  function closeModal() {
    cancelOperation = true;
    isModalOpen = false;
  }

  async function removeRemoteDB(id: string) {
    dbToRemove = id;
    showConfirmModal = true;
  }

  async function handleConfirmRemove(options) {
    if (!dbToRemove) return;
    
    isModalOpen = true;
    modalMessage = $_("removing_database");
    
    await $remoteDBsDatabases.del(dbToRemove);
    
    $remoteDBs = $remoteDBs.filter(db => {
      if (db.id === dbToRemove) {
        handleDatabaseDrop(db, options);
      }
      return db.id !== dbToRemove;
    });

    dbToRemove = null;
    isModalOpen = false;
    showConfirmModal = false;
  }

  // New helper function to handle the database dropping process
  async function handleDatabaseDrop(db, options) {
    try {
      const remotedb = await $orbitdb.open(db.address);
      
      // Get all database addresses
      const [postsAddressEntry, commentsAddressEntry, mediaAddressEntry] = await Promise.all([
        remotedb.get('postsDBAddress'),
        remotedb.get('commentsDBAddress'),
        remotedb.get('mediaDBAddress')
      ]);
      
      const dropPromises = [];
      
      if (options.dropLocal) {
        for (const entry of [postsAddressEntry, commentsAddressEntry, mediaAddressEntry]) {
          if (entry?.value?.value) {
            dropPromises.push(
              $orbitdb.open(entry.value.value).then(async (database) => {
                await database.drop();
                debug(`Dropped database: ${entry.value.value}`);
              })
            );
          }
        }
        
        // Drop main settings database
        dropPromises.push(remotedb.drop());
      }
      
      if (options.unpinVoyager && $voyager) {
    
        // Unpin from Voyager
        for (const entry of [postsAddressEntry, commentsAddressEntry, mediaAddressEntry]) {
          if (entry?.value?.value) {
            debug('unpinning from voyager', entry.value.value);
            dropPromises.push(
              $voyager.remove(entry.value.value).catch(err => 
                console.warn(`Failed to unpin from Voyager: ${entry.value.value}`, err)
              )
            );
          }
        }
        
        // Unpin main database
        dropPromises.push($voyager.remove(db.address));
        
        // TODO: Add IPFS file unpinning once Helia integration is available
        // This would involve getting all IPFS CIDs from posts/media and unpinning them
      }
      
      await Promise.all(dropPromises);
      debug(`Successfully removed database: ${db.name}`);
      
    } catch (_error) {
      error(`Error dropping database ${db.name}:`, _error);
      throw error;
    }
  }


  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      debug('Text copied to clipboard:', text);
    }).catch(_err => {
      error('Error copying text to clipboard:', _err);
    });
  }
  run(() => {
    if ($remoteDBs) {
      const hasQueuedDBs = $remoteDBs.some(db => db.fetchLater);
      
      if (hasQueuedDBs && !queueCheckInterval) {
        debug('Starting queue checking - databases found in queue');
        queueCheckInterval = window.setInterval(processQueue, 30 * 1000); // every 30 seconds
        processQueue(); // Process immediately on setup
      } else if (!hasQueuedDBs && queueCheckInterval) {
        debug('Clearing queue checking - no databases in queue');
        clearInterval(queueCheckInterval);
        queueCheckInterval = undefined;
      }
    }
  });
  run(() => {
    if ($settingsDB) {  
      $selectedDBAddress = $settingsDB.address;
      generateQRCode($selectedDBAddress);
    }
  });

  async function cloneDatabase(sourceDb) {
    isModalOpen = true;
    modalMessage = `${$_("cloning_database")} "${sourceDb.name}"...`;
    
    try {
      // Create a new database name with identity suffix
      const identitySuffix = $identity?.id?.slice(-5) || 'xxxxx';
      const newDbName = `${sourceDb.name}_${identitySuffix}`;
      debug('newDbName', newDbName);
      
      // Step 1: Create and setup new settings database
      modalMessage = $_('creating_new_settings_database');
      const newSettingsDb = await $orbitdb.open(newDbName, {
        type: 'documents',
        create: true,
        identity: $identity,
        identities: $identities,
        AccessController: IPFSAccessController({write: [$identity.id]})
      });
      
      if (!newSettingsDb) {
        throw new Error($_('failed_to_create_new_settings_database'));
      }
      
      // Step 2: Open all source databases
      modalMessage = $_('opening_source_databases');
      const sourceSettingsDb = await $orbitdb.open(sourceDb.address);
      const sourcePostsDb = await $orbitdb.open(sourceDb.postsAddress);
      
      // Get comments and media DB addresses from source settings
      const commentsAddressEntry = await sourceSettingsDb.get('commentsDBAddress');
      const mediaAddressEntry = await sourceSettingsDb.get('mediaDBAddress');
      
      // Open source comments and media DBs if they exist
      const sourceCommentsDb = commentsAddressEntry?.value?.value ? 
        await $orbitdb.open(commentsAddressEntry.value.value) : null;
      const sourceMediaDb = mediaAddressEntry?.value?.value ? 
        await $orbitdb.open(mediaAddressEntry.value.value) : null;
      
      // Step 3: Create new databases for posts, comments, and media
      modalMessage = $_('creating_new_databases');
      
      // Create new posts DB
      const newPostsDb = await $orbitdb.open(`posts_${sourceDb.name}_${identitySuffix}`, {
        type: 'documents',
        create: true,
        identity: $identity,
        identities: $identities,
        AccessController: IPFSAccessController({write: [$identity.id]})
      });
      
      // Create new comments DB (public write access)
      const newCommentsDb = await $orbitdb.open(`comments_${sourceDb.name}_${identitySuffix}`, {
        type: 'documents',
        create: true,
        identity: $identity,
        identities: $identities,
        AccessController: IPFSAccessController({write: ["*"]})
      });
      
      // Create new media DB
      const newMediaDb = await $orbitdb.open(`media_${sourceDb.name}_${identitySuffix}`, {
        type: 'documents',
        create: true,
        identity: $identity,
        identities: $identities,
        AccessController: IPFSAccessController({write: [$identity.id]})
      });
      
      // Step 4: Copy settings (excluding database addresses)
      modalMessage = $_('copying_settings');
      debug('copying settings', sourceSettingsDb);
      const settings = await sourceSettingsDb.all();
      for (const entry of settings) {
        // Skip database address entries - we'll add these later
        if (entry.key === 'postsDBAddress' || 
            entry.key === 'commentsDBAddress' || 
            entry.key === 'mediaDBAddress') {
          continue;
        }
        const cleanValue = JSON.parse(JSON.stringify(entry.value));
        await newSettingsDb.put(cleanValue);
      }
      
      // Step 5: Copy posts
      modalMessage = $_('copying_posts');
      debug('copying posts', sourcePostsDb);
      const posts = await sourcePostsDb.all();
      for (const post of posts) {
        debug('copying post', post);
        // Ensure we're only storing serializable data
        const cleanPost = JSON.parse(JSON.stringify(post.value));
        await newPostsDb.put(cleanPost);
      } 
      if(posts.length === 0) {
        debug($_('no_posts_to_copy'));
      }
      
      // Step 6: Copy comments if they exist
      if (sourceCommentsDb) {
        modalMessage = $_('copying_comments');
        debug('copying comments', sourceCommentsDb);
        const comments = await sourceCommentsDb.all();
        for (const comment of comments) {
          // Ensure we're only storing serializable data
          const cleanComment = JSON.parse(JSON.stringify(comment.value));
          await newCommentsDb.put(cleanComment);
        }
      } else {
        debug($_('no_comments_to_copy'));
      }
      
      // Step 7: Copy media if it exists
      if (sourceMediaDb) {
        modalMessage = $_('copying_media');
        debug('copying media', sourceMediaDb);
        const media = await sourceMediaDb.all();
        for (const item of media) {
          // Ensure we're only storing serializable data
          const cleanMedia = JSON.parse(JSON.stringify(item.value));
          await newMediaDb.put(cleanMedia);
        }
      } else {
        debug($_('no_media_to_copy'));
      }
      
      // After copying all content, update the settings with new database addresses
      modalMessage = $_('updating_database_references');
      await newSettingsDb.put({ _id: 'postsDBAddress', value: newPostsDb.address });
      await newSettingsDb.put({ _id: 'commentsDBAddress', value: newCommentsDb.address });
      await newSettingsDb.put({ _id: 'mediaDBAddress', value: newMediaDb.address });
      
      // Step 8: Pin to Voyager if available
      if ($voyager) {
        debug('pinning to voyager', newSettingsDb.address, newPostsDb.address, newCommentsDb.address, newMediaDb.address);
        modalMessage = $_('pinning_to_voyager');
        await $voyager.add(newSettingsDb.address);
        debug('pinned to voyager', newSettingsDb.address);
        await $voyager.add(newPostsDb.address);
        debug('pinned to voyager', newPostsDb.address);
        await $voyager.add(newCommentsDb.address);
        debug('pinned to voyager', newCommentsDb.address);
        await $voyager.add(newMediaDb.address);
        debug('pinned to voyager', newMediaDb.address);
      }
      
      // Only after everything is successful, register the database
      debug('registering new database', newSettingsDb);
      modalMessage = $_('registering_new_database');
      const success = await addRemoteDBToStore(newSettingsDb.address);
      debug('success', success);
      debug('registered new database', newSettingsDb.address, newPostsDb.address, newCommentsDb.address, newMediaDb.address);
      modalMessage = $_('clone_completed_successfully');
      setTimeout(() => {
        isModalOpen = false;
      }, 2000);
      
    } catch (_error) {
      error('Error cloning database:', _error);
      modalMessage = `${$_('error_cloning_database')}: ${_error.message}`;
      setTimeout(() => {
        isModalOpen = false;
      }, 3000);
    }
  }
</script>

<div class="space-y-4 {$isRTL ? 'rtl' : 'ltr'}">
  <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-6">
    <div class="mb-4">
      <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{$_('our_blog_db')}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <div class="flex items-center space-x-2">
            <span class="text-gray-600 dark:text-gray-400">{$_('db_address')}:</span>
            <input
              type="text"
              size={70}
              value={$settingsDB?.address}
              class="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm"
            />
            <button 
              title={$_('copy_to_clipboard')}
              ontouchstart={() => copyToClipboard($settingsDB?.address || '')} 
              onclick={() => copyToClipboard($settingsDB?.address || '')} 
              class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              📋
            </button>
          </div>
          <div class="flex flex-col md:flex-row justify-center items-center gap-4">
            <!-- {#if qrCodeDataUrl}
              <div class="flex justify-center bg-white p-4 rounded-lg">
                <img src={qrCodeDataUrl} alt="Database QR Code" class="w-48 h-48" />
              </div>
            {/if} -->
            <!-- <button
              on:click={dropAndSync}
              class="bg-purple-600 dark:bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
              </svg>
              Drop Posts & Sync from Network
            </button> -->
          </div>
        </div>
      </div>
    </div>

    <div class="border-t dark:border-gray-700 pt-4">
      <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        {isLocalDB ? $_('add_local_database') : $_('add_remote_database')}
      </h3>
      
      <div class="mb-4">
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" bind:checked={isLocalDB} class="sr-only peer">
          <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          <span class="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
            {isLocalDB ? $_('local_database') : $_('remote_database')}
          </span>
        </label>
      </div>

      <div class="space-y-4">
        {#if isLocalDB}
          <div>
            <label for="dbName" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('database_name')}</label>
            <input
              id="dbName"
              type="text"
              bind:value={dbName}
              placeholder={$_('my_new_blog')}
              class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        {:else}
          <div>
            <label for="dbAddress" class="block text-sm font-medium text-gray-700 dark:text-gray-300">{$_('blog_orbitdb_address')}</label>
            <div class="flex space-x-2">
              <input
                id="dbAddress"
                type="text"
                bind:value={dbAddress}
                placeholder={$_('paste_database_address_here')}
                class="flex-1 mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <button
                title={$_('scan_qr_code')}
                ontouchstart={startScanner}
                onclick={startScanner}
                class="mt-1 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
              >
                {$_('scan_qr')}
              </button>
            </div>
          </div>
        {/if}

        <button
          title={isLocalDB ? $_('add_local_database') : $_('add_remote_database')}
          ontouchstart={addRemoteDB}
          onclick={addRemoteDB}
          class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          {isLocalDB ? $_('add_local_database') : $_('add_remote_database')}
        </button>
      </div>
    </div>

    {#if showScanner}
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-gray-800 p-4 rounded-lg max-w-lg w-full mx-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{$_('scan_qr_code')}</h3>
            <button
              onclick={stopScanner}
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {$_('close')}
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

    {#if $remoteDBs.length > 0}
      <div class="text-gray-900 dark:text-white">{$_('number_of_databases')}: {$remoteDBs.length}</div>
      <div class="border-t dark:border-gray-700 mt-6 pt-4">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">{$_('available_databases')}</h3>
        <div class="space-y-2">
          {#each $remoteDBs as db}
            <div class="flex items-center space-x-2">
              <button
                class="flex-1 text-left p-3 rounded-md transition-all duration-300 ease-in-out transform hover:scale-105 {$selectedDBAddress === db.address ? 'bg-gradient-to-r from-indigo-500 to-indigo-300 dark:from-indigo-800 dark:to-indigo-600 border-2 border-indigo-500' : db.access?.write?.includes($identity?.id) ? 'bg-gradient-to-r from-green-200 to-green-100 dark:from-green-800 dark:to-green-700 border border-green-300 dark:border-green-600' : 'bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600 hover:bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-500 border border-gray-200 dark:border-gray-600'}"
                onclick={() => handleSwitchToRemoteDB(db.address)}
              >
                <div class="flex justify-between items-center">
                  <div class="flex items-center space-x-2">
                    <!-- Pin Status Indicator -->
                    {#if db.pinnedToVoyager !== undefined}
                      <span 
                        class="inline-block w-3 h-3 rounded-full {db.pinnedToVoyager ? 'bg-green-500' : 'bg-orange-500'}"
                        title={db.pinnedToVoyager ? $_("pinned_to_voyager") : $_("not_pinned_to_voyager")}
                      ></span>
                    {/if}
                    
                    <!-- Write Access Icon -->
                    {#if db.access?.write?.includes($identity?.id)}
                      <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    {:else}
                      <svg class="w-5 h-5 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    {/if}
                    
                    <div>
                      <div class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <span 
                          title={`
Database Name: ${db.name}
Database ID: ${db.id}
Main Address: ${db.address}
Posts DB Address: ${db.postsDBAddress || 'Not available'}
Comments DB Address: ${db.commentsDBAddress || 'Not available'}
Media DB Address: ${db.mediaDBAddress || 'Not available'}
Posts Count: ${db.postsCount !== undefined ? db.postsCount : 'Unknown'}
Comments Count: ${db.commentsCount !== undefined ? db.commentsCount : 'Unknown'}
Media Count: ${db.mediaCount !== undefined ? db.mediaCount : 'Unknown'}
Write Access: ${db.access?.write?.includes($identity?.id) ? 'Yes' : 'No'}
Pinned to Voyager: ${db.pinnedToVoyager ? 'Yes' : 'No'}
Last Processed: ${db.lastProcessed || 'Never'}
Last Attempt: ${db.lastAttempt || 'Never'}
Fetch Later: ${db.fetchLater ? 'Yes' : 'No'}
`.trim()}>
                          {db.name}
                        </span>
                        
                        <!-- Database Counts -->
                        <div class="flex gap-2">
                          {#if db.postsCount !== undefined}
                            <span class="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full text-xs font-medium" 
                                  title={`${$_('posts_db_address')}: ${db.postsAddress || $_('address_not_available')}`}>
                              {db.postsCount} {$_('posts')}
                            </span>
                          {/if}
                          
                          {#if db.commentsCount !== undefined}
                            <span class="px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100 rounded-full text-xs font-medium" 
                                  title={`${$_('comments_db_address')}: ${db.commentsAddress || $_('address_not_available')}`}>
                              {db.commentsCount} {$_('comments')}
                            </span>
                          {/if}
                          
                          {#if db.mediaCount !== undefined}
                            <span class="px-2 py-0.5 bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-100 rounded-full text-xs font-medium" 
                                  title={`${$_('media_db_address')}: ${db.mediaAddress || $_('address_not_available')}`}>
                              {db.mediaCount} {$_('media')}
                            </span>
                          {/if}
                        </div>
                      </div>
                      <div class="text-sm text-gray-500 dark:text-gray-400 truncate">{db.address}</div>
                    </div>
                  </div>
                  
                  {#if $selectedDBAddress === db.address}
                    <span class="text-indigo-600 dark:text-indigo-400 text-sm font-medium">{$_('current')}</span>
                  {/if}
                </div>
              </button>
              
              <!-- Add Clone Button -->
              <button
                class="p-2 text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400"
                onclick={() => cloneDatabase(db)}
                title={$_('clone_database')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                  <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                </svg>
              </button>
              
              <!-- Existing Delete Button -->
              <button
                class="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                onclick={() => removeRemoteDB(db.id)}
                title={$_('remove_database')}
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

    <Modal isOpen={isModalOpen} onClose={closeModal} message={modalMessage}>
      <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">{$_('database_operation')}</h2>
      <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
        <div class="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full animate-pulse"></div>
      </div>
      <button
        onclick={closeModal}
        class="px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      >
        {$_('cancel')}
      </button>
    </Modal>

    <!-- New Confirmation Modal -->
    <ConfirmModal
      isOpen={showConfirmModal}
      onConfirm={(options) => handleConfirmRemove(options)}
      onCancel={() => showConfirmModal = false}
      title={$_('remove_database')}
      showOptions={true}
    >
      <p class="text-gray-700 dark:text-gray-300">
        {$_('remove_database_confirm')}
      </p>
    </ConfirmModal>
  </div>
</div>

<style>
  /* RTL specific styles */
  :global([dir="rtl"]) .flex {
    flex-direction: row-reverse;
  }

  :global([dir="rtl"]) .space-x-2 > * + * {
    margin-right: 0.5rem;
    margin-left: 0;
  }

  :global([dir="rtl"]) .gap-2 > * + * {
    margin-right: 0.5rem;
    margin-left: 0;
  }

  :global([dir="rtl"]) .text-left {
    text-align: right;
  }

  :global([dir="rtl"]) .ml-1 {
    margin-right: 0.25rem;
    margin-left: 0;
  }

  :global([dir="rtl"]) .mr-1 {
    margin-left: 0.25rem;
    margin-right: 0;
  }
</style>