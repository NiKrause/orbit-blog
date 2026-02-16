<script lang="ts">
  import { run } from 'svelte/legacy';
  import { _ } from 'svelte-i18n';

  import { onDestroy } from 'svelte';
  import { settingsDB, posts, allComments, allMedia, remoteDBs, selectedDBAddress, orbitdb, remoteDBsDatabases, identity, identities, isRTL } from '$lib/store.js';
  import Modal from './Modal.svelte';
  import { switchToRemoteDB, addRemoteDBToStore } from '$lib/dbUtils.js';
  import { IPFSAccessController } from '@orbitdb/core';
  import ConfirmModal from './ConfirmModal.svelte';
  import type { RemoteDB } from '$lib/types.js';
  import { error, debug } from '../utils/logger.js'

  let dbAddress = $state('');
  let dbName = $state('');
  let dbPeerId = '';
  // QR scanner variables removed
  let isModalOpen = $state(false);
  let did = '';
  let modalMessage = $state($_("loading_database_from_p2p"));
  let cancelOperation = false;
  let queueCheckInterval: number | undefined = $state();
  let isQueueRunning = false;
  let isLocalDB = $state(false);
  let showConfirmModal = $state(false);
  let dbToRemove: string | null = null;
  let showConfirmDropCurrentModal = $state(false);
  let dropCurrentModalMessage = $state('');

  // QR code generation function removed

  // QR scanner functions removed



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
            const blogNameValue = settingsData.find(content => content.key === 'blogName')?.value?.value;
            debug('blogNameValue', blogNameValue);
            if (blogNameValue) {
              db.name = blogNameValue;
              db.fetchLater = false;
            } else {
              db.fetchLater = true;
            }
          }
          
          // Check and open posts database
          debug('Checking posts database...');
          const postsAddressValue = settingsData.find(content => content.key === 'postsDBAddress')?.value?.value;
          if (postsAddressValue) {
            db.postsAddress = postsAddressValue;
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
          const commentsAddressValue = settingsData.find(content => content.key === 'commentsDBAddress')?.value?.value;
          if (commentsAddressValue) {
            db.commentsAddress = commentsAddressValue;
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
          const mediaAddressValue = settingsData.find(content => content.key === 'mediaDBAddress')?.value?.value;
          if (mediaAddressValue) {
            db.mediaAddress = mediaAddressValue;
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
        modalMessage = `${$_('error')}: ${_err.message || $_('unknown_error')} - ${$_('adding_to_queue_for_later')}`;
        
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

  // Function to initiate dropping the current database
  async function dropCurrentDatabase() {
    if (!$settingsDB || !$selectedDBAddress) {
      dropCurrentModalMessage = 'No current database to drop';
      return;
    }
    
    // Find current DB in remoteDBs to get the name
    const currentDB = $remoteDBs.find(db => db.address === $selectedDBAddress);
    const dbName = currentDB?.name || 'Current Database';
    
    dropCurrentModalMessage = `Are you sure you want to drop the current database "${dbName}" and all its linked sub-databases (posts, comments, media)? This action cannot be undone.`;
    showConfirmDropCurrentModal = true;
  }
  
  // Function to handle confirmed dropping of current database
  async function handleConfirmDropCurrent(options) {
    if (!$settingsDB || !$selectedDBAddress) {
      return;
    }
    
    // Store the current address before clearing stores
    const currentAddress = $selectedDBAddress;
    
    isModalOpen = true;
    modalMessage = $_('dropping_current_database');
    
    try {
      // Find current DB entry in remoteDBs before dropping
      const currentDBEntry = $remoteDBs.find(db => db.address === currentAddress);
      debug('currentAddress:', currentAddress);
      debug('$remoteDBs:', $remoteDBs);
      debug('currentDBEntry found:', currentDBEntry);
      
      // Get all database addresses from current settings
      const settingsData = await $settingsDB.all();
      const postsAddressValue = settingsData.find(content => content.key === 'postsDBAddress')?.value?.value;
      const commentsAddressValue = settingsData.find(content => content.key === 'commentsDBAddress')?.value?.value;
      const mediaAddressValue = settingsData.find(content => content.key === 'mediaDBAddress')?.value?.value;
      
      const dropPromises = [];
      
      if (options.dropLocal) {
        // Drop sub-databases
        if (postsAddressValue) {
          dropPromises.push(
            $orbitdb.open(postsAddressValue).then(async (database) => {
              await database.drop();
              debug(`Dropped posts database: ${postsAddressValue}`);
            })
          );
        }
        
        if (commentsAddressValue) {
          dropPromises.push(
            $orbitdb.open(commentsAddressValue).then(async (database) => {
              await database.drop();
              debug(`Dropped comments database: ${commentsAddressValue}`);
            })
          );
        }
        
        if (mediaAddressValue) {
          dropPromises.push(
            $orbitdb.open(mediaAddressValue).then(async (database) => {
              await database.drop();
              debug(`Dropped media database: ${mediaAddressValue}`);
            })
          );
        }
        
        // Drop main settings database last
        dropPromises.push($settingsDB.drop());
      }
      
      await Promise.all(dropPromises);
      
      // Additional cleanup: Clear browser storage for OrbitDB
      modalMessage = 'Clearing browser storage...';
      await clearOrbitDBBrowserStorage([
        currentAddress,
        postsAddressValue,
        commentsAddressValue,
        mediaAddressValue
      ].filter(Boolean));
      
      // Remove from remoteDBs if it exists there (using stored address)
      if (currentDBEntry) {
        await $remoteDBsDatabases.del(currentDBEntry.id);
        $remoteDBs = $remoteDBs.filter(db => db.id !== currentDBEntry.id);
        debug(`Removed database ${currentDBEntry.name} from remoteDBs list`);
      }
      
      // Clear stores after removal from remoteDBs
      settingsDB.set(null);
      posts.set([]);
      allComments.set([]);
      allMedia.set([]);
      selectedDBAddress.set(null);
      
      debug('Successfully dropped current database and all sub-databases');
      modalMessage = 'Current database dropped successfully';
      
      setTimeout(() => {
        isModalOpen = false;
      }, 2000);
      
    } catch (_error) {
      error('Error dropping current database:', _error);
      modalMessage = `Error dropping database: ${_error.message}`;
      setTimeout(() => {
        isModalOpen = false;
      }, 3000);
    } finally {
      showConfirmDropCurrentModal = false;
    }
  }
  
  // Helper function to clear browser storage for OrbitDB databases
  async function clearOrbitDBBrowserStorage(addresses) {
    try {
      // Clear IndexedDB databases that OrbitDB might create
      const dbNames = [
        'orbitdb',
        'orbitdb-cache',
        'orbitdb-keystore',
        'level-js-orbitdb',
        'blockstore',
        'datastore'
      ];
      
      // Also try to clear databases based on the addresses
      for (const address of addresses) {
        if (address) {
          // OrbitDB might create databases with names based on addresses or hashes
          const addressParts = address.split('/');
          const hash = addressParts[addressParts.length - 1] || addressParts[addressParts.length - 2];
          if (hash) {
            dbNames.push(`orbitdb-${hash}`);
            dbNames.push(`level-${hash}`);
            dbNames.push(hash);
          }
        }
      }
      
      // Attempt to delete each potential database
      const deletePromises = dbNames.map(async (dbName) => {
        try {
          const deleteReq = indexedDB.deleteDatabase(dbName);
          return new Promise((resolve, reject) => {
            deleteReq.onsuccess = () => {
              debug(`Cleared IndexedDB: ${dbName}`);
              resolve(true);
            };
            deleteReq.onerror = () => {
              // Don't reject, just log - database might not exist
              debug(`IndexedDB ${dbName} does not exist or could not be deleted`);
              resolve(false);
            };
            deleteReq.onblocked = () => {
              debug(`IndexedDB ${dbName} deletion blocked`);
              resolve(false);
            };
          });
        } catch (err) {
          debug(`Error deleting IndexedDB ${dbName}:`, err);
          return false;
        }
      });
      
      await Promise.all(deletePromises);
      
      // Clear localStorage entries related to OrbitDB
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('orbitdb') || key.includes('level') || 
                   addresses.some(addr => addr && key.includes(addr)))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        debug(`Cleared localStorage key: ${key}`);
      });
      
      debug('Browser storage cleanup completed');
    } catch (err) {
      error('Error clearing browser storage:', err);
    }
  }

  // New helper function to handle the database dropping process
  async function handleDatabaseDrop(db, options) {
    try {
      const remotedb = await $orbitdb.open(db.address);
      
      // Get all database addresses using .all() to avoid CID parsing errors on empty databases
      const allSettings = await remotedb.all();
      
      // Extract addresses from settings
      let postsAddress = null;
      let commentsAddress = null;
      let mediaAddress = null;
      
      for (const entry of allSettings) {
        const setting = entry.value;
        switch(setting._id) {
          case 'postsDBAddress':
            if (setting.value !== undefined) postsAddress = setting.value;
            break;
          case 'commentsDBAddress':
            if (setting.value !== undefined) commentsAddress = setting.value;
            break;
          case 'mediaDBAddress':
            if (setting.value !== undefined) mediaAddress = setting.value;
            break;
        }
      }
      
      const dropPromises = [];
      
      if (options.dropLocal) {
        // Drop sub-databases if they exist
        for (const address of [postsAddress, commentsAddress, mediaAddress]) {
          if (address) {
            dropPromises.push(
              $orbitdb.open(address).then(async (database) => {
                await database.drop();
                debug(`Dropped database: ${address}`);
              }).catch(err => {
                debug(`Failed to drop database ${address}:`, err);
              })
            );
          }
        }
        
        // Drop main settings database
        dropPromises.push(remotedb.drop());
      }
      
      // if (options.unpinVoyager && $voyager) {
    
      //   // Unpin from Voyager
      //   for (const entry of [postsAddressEntry, commentsAddressEntry, mediaAddressEntry]) {
      //     if (entry?.value?.value) {
      //       debug('unpinning from voyager', entry.value.value);
      //       dropPromises.push(
      //         // $voyager.remove(entry.value.value).catch(err => 
      //         //   console.warn(`Failed to unpin from Voyager: ${entry.value.value}`, err)
      //         // )
      //       );
      //     }
      //   }
        
        // // Unpin main database
        // dropPromises.push($voyager.remove(db.address));
        
        // TODO: Add IPFS file unpinning once Helia integration is available
        // This would involve getting all IPFS CIDs from posts/media and unpinning them
     // }
      
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

  $effect(() => {
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
  $effect(() => {
    if ($settingsDB) {  
      $selectedDBAddress = $settingsDB.address.toString();
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
      // if ($voyager) {
        // debug('pinning to voyager', newSettingsDb.address, newPostsDb.address, newCommentsDb.address, newMediaDb.address);
        // modalMessage = $_('pinning_to_voyager');
        // await $voyager.add(newSettingsDb.address);
        // debug('pinned to voyager', newSettingsDb.address);
        // await $voyager.add(newPostsDb.address);
        // debug('pinned to voyager', newPostsDb.address);
        // await $voyager.add(newCommentsDb.address);
        // debug('pinned to voyager', newCommentsDb.address);
        // await $voyager.add(newMediaDb.address);
        // debug('pinned to voyager', newMediaDb.address);
      // }
      
      // Only after everything is successful, register the database
      debug('registering new database', newSettingsDb);
      modalMessage = $_('registering_new_database');
      const success = await addRemoteDBToStore(newSettingsDb.address.toString(), '', newDbName);
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

<div class="{$isRTL ? 'rtl' : 'ltr'}">
  <div class="card p-5 mb-6" data-testid="db-manager-container">
    <!-- Current Database -->
    <div class="mb-4">
      <h3 class="text-sm font-semibold mb-2" style="color: var(--text);" data-testid="our-blog-db-title">{$_('our_blog_db')}</h3>
      <div class="flex items-center gap-2">
        <input
          type="text"
          size={70}
          value={$settingsDB?.address}
          class="input flex-1 font-mono text-xs"
          data-testid="db-address-input"
        />
        <button 
          title={$_('copy_to_clipboard')}
          ontouchstart={() => copyToClipboard($settingsDB?.address.toString() || '')} 
          onclick={() => copyToClipboard($settingsDB?.address.toString() || '')}
          class="btn-icon"
          data-testid="copy-db-address-button"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        </button>
        {#if $settingsDB}
        <button 
          title="Drop current database and all sub-databases"
          onclick={() => dropCurrentDatabase()} 
          class="btn-icon" style="color: var(--danger);"
          data-testid="drop-current-db-button"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
        {/if}
      </div>
    </div>

    <div class="divider mb-4"></div>

    <!-- Add Database -->
    <div class="mb-4">
      <h3 class="text-sm font-semibold mb-3" style="color: var(--text);">
        {isLocalDB ? $_('add_local_database') : $_('add_remote_database')}
      </h3>
      
      <div class="mb-3">
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" bind:checked={isLocalDB} class="sr-only peer">
          <div class="toggle-track peer-checked:bg-current"><div class="toggle-thumb peer-checked:translate-x-5"></div></div>
          <span class="ml-3 text-xs font-medium" style="color: var(--text-secondary);">
            {isLocalDB ? $_('local_database') : $_('remote_database')}
          </span>
        </label>
      </div>

      <div class="space-y-3">
        {#if isLocalDB}
          <div>
            <label for="dbName" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('database_name')}</label>
            <input id="dbName" type="text" bind:value={dbName} placeholder={$_('my_new_blog')} class="input" data-testid="new-db-name-input" />
          </div>
        {:else}
          <div>
            <label for="dbAddress" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('blog_orbitdb_address')}</label>
            <input id="dbAddress" type="text" bind:value={dbAddress} placeholder={$_('paste_database_address_here')} class="input" data-testid="remote-db-address-input" />
          </div>
        {/if}

        <button
          title={isLocalDB ? $_('add_local_database') : $_('add_remote_database')}
          ontouchstart={addRemoteDB}
          onclick={addRemoteDB}
          class="btn-primary w-full"
          data-testid="add-db-button"
        >
          {isLocalDB ? $_('add_local_database') : $_('add_remote_database')}
        </button>
      </div>
    </div>

    {#if $remoteDBs.length > 0}
      <div class="divider mb-4"></div>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold" style="color: var(--text);">{$_('available_databases')}</h3>
        <span class="badge">{$remoteDBs.length}</span>
      </div>
      <div class="space-y-1.5">
        {#each $remoteDBs as db}
          <div class="flex items-center gap-1.5">
            <button
              data-testid="remote-db-item"
              class="flex-1 text-left p-3 rounded-md transition-all cursor-pointer"
              style="{$selectedDBAddress === db.address ? 'background-color: var(--bg-active); border-left: 2px solid var(--accent);' : 'border-left: 2px solid transparent; background-color: var(--bg-tertiary);'}"
              onclick={() => handleSwitchToRemoteDB(db.address)}
            >
              <div class="flex justify-between items-center">
                <div class="flex items-center gap-2">
                  {#if db.pinnedToVoyager !== undefined}
                    <span class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background-color: {db.pinnedToVoyager ? 'var(--success)' : 'var(--warning)'};" title={db.pinnedToVoyager ? $_("pinned_to_voyager") : $_("not_pinned_to_voyager")}></span>
                  {/if}
                  
                  {#if db.access?.write?.includes($identity?.id)}
                    <svg class="w-3.5 h-3.5 flex-shrink-0" style="color: var(--success);" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                  {:else}
                    <svg class="w-3.5 h-3.5 flex-shrink-0" style="color: var(--danger);" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  {/if}
                  
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-sm font-medium" style="color: var(--text);" title={`Database: ${db.name}\nID: ${db.id}\nAddress: ${db.address}\nPosts: ${db.postsCount ?? 'Unknown'}\nComments: ${db.commentsCount ?? 'Unknown'}\nMedia: ${db.mediaCount ?? 'Unknown'}`}>{db.name}</span>
                      {#if db.postsCount !== undefined}<span class="badge">{db.postsCount} {$_('posts')}</span>{/if}
                      {#if db.commentsCount !== undefined}<span class="badge">{db.commentsCount} {$_('comments')}</span>{/if}
                      {#if db.mediaCount !== undefined}<span class="badge">{db.mediaCount} {$_('media')}</span>{/if}
                    </div>
                    <div class="text-xs truncate mt-0.5 font-mono" style="color: var(--text-muted);">{db.address}</div>
                  </div>
                </div>
                
                {#if $selectedDBAddress === db.address}
                  <span class="text-xs font-medium flex-shrink-0" style="color: var(--accent);">{$_('current')}</span>
                {/if}
              </div>
            </button>
            
            <button class="btn-icon" onclick={() => cloneDatabase(db)} aria-label={$_('clone_database')}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" /><path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" /></svg>
            </button>
            
            <button class="btn-icon" style="color: var(--danger);" onclick={() => removeRemoteDB(db.id)} aria-label={$_('remove_database')} data-testid="delete-db-button">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <Modal isOpen={isModalOpen} onClose={closeModal} message={modalMessage}>
      <h2 class="text-lg font-semibold mb-3" style="color: var(--text);">{$_('database_operation')}</h2>
      <div class="w-full rounded-full h-1.5 mb-4" style="background-color: var(--bg-tertiary);">
        <div class="h-1.5 rounded-full animate-pulse" style="background-color: var(--accent);"></div>
      </div>
      <button onclick={closeModal} class="btn-danger" data-testid="confirm-delete-button">{$_('cancel')}</button>
    </Modal>

    <ConfirmModal isOpen={showConfirmModal} onConfirm={(options) => handleConfirmRemove(options)} onCancel={() => showConfirmModal = false} title={$_('remove_database')} showOptions={true}>
      {#snippet children()}<p class="text-sm" style="color: var(--text-secondary);">{$_('remove_database_confirm')}</p>{/snippet}
    </ConfirmModal>
    
    <ConfirmModal isOpen={showConfirmDropCurrentModal} onConfirm={(options) => handleConfirmDropCurrent(options)} onCancel={() => showConfirmDropCurrentModal = false} title="Drop Current Database" showOptions={true}>
      {#snippet children()}<p class="text-sm" style="color: var(--text-secondary);">{dropCurrentModalMessage}</p>{/snippet}
    </ConfirmModal>
  </div>
</div>

<style>
  .toggle-track {
    width: 2.5rem;
    height: 1.25rem;
    background-color: var(--bg-tertiary);
    border-radius: 9999px;
    position: relative;
    transition: background-color 0.2s;
    border: 1px solid var(--border);
  }
  .toggle-thumb {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 1rem;
    height: 1rem;
    background-color: var(--text-muted);
    border-radius: 9999px;
    transition: transform 0.2s;
  }
  :global([dir="rtl"]) .flex { flex-direction: row-reverse; }
  :global([dir="rtl"]) .text-left { text-align: right; }
</style>
