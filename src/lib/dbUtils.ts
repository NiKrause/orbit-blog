import { get } from 'svelte/store';
import { helia, orbitdb, blogName, categories, blogDescription, postsDBAddress, profilePictureCid, postsDB, posts, settingsDB, remoteDBs, commentsDB, mediaDB, remoteDBsDatabases, commentsDBAddress, mediaDBAddress, identity, identities, loadingState } from './store.js';
import type { RemoteDB } from './types.js';
import { IPFSAccessController } from '@orbitdb/core';
import { error, info, debug, warn } from './utils/logger.js'

// For the Libp2p related functions, we need to use the correct API
// Here's how to fix the dial and getPeers errors:
const connectToPeer = async (heliaInstance: any, peerId: string) => {
    try {
        // Use the correct method for connecting to peers
        await heliaInstance.libp2p.connect(peerId);
    } catch (error) {
        console.error('Failed to connect to peer:', error);
    }
};

// Fix the database creation/handling
const createNewDB = (name: string): RemoteDB => {
    return {
        id: crypto.randomUUID(),
        postsAddress: '',
        commentsAddress: '',
        mediaAddress: ''
    };
};

// Fix the database checks
const isDuplicateDB = (existingDBs: RemoteDB[], newDB: RemoteDB): boolean => {
    return existingDBs.some(db => db.id === newDB.id);
};

// Fix the peer handling
const getPeerList = async (heliaInstance: any) => {
    try {
        // Use the correct method for getting peers
        const peers = await heliaInstance?.libp2p?.getPeers();
        return peers || [];
    } catch (error) {
        console.error('Failed to get peers:', error);
        return [];
    }
};

// Add this helper function
function updateLoadingState(step: string, detail: string = '', progress: number = 0) {
  loadingState.set({ step, detail, progress });
  debug('Loading State:', { step, detail, progress });
}

/**
 * Adds a remote database to the store
 * @param address - The address of the remote database
 * @param peerId - The peer ID of the remote database
 * @param name - The name of the remote database
 * @returns True if the database was added successfully, false otherwise
 */
export async function addRemoteDBToStore(address: string, peerId: string, name?: string) {
  info('addRemoteDBToStore', address, peerId, name)
  const heliaInstance = get(helia);
  const orbitdbInstance = get(orbitdb);
  const identityInstance = get(identity);
  const identitiesInstance = get(identities);
  if (!orbitdbInstance) throw new Error("OrbitDB not initialized");

  
  try {
    let settingsDb;
    let newDB: RemoteDB;

    // If no address is provided, create a new local database
    if (!address && name) {
      const databases = await createDatabaseSet(orbitdbInstance, identityInstance, identitiesInstance, name);
      
      newDB = {
        id: crypto.randomUUID(),
        name: name,
        address: databases.addresses.settings,
        postsAddress: databases.addresses.posts,
        commentsAddress: databases.addresses.comments,
        mediaAddress: databases.addresses.media,
        fetchLater: false,
        date: new Date().toISOString().split('T')[0]
      };
    } else {
      // Handle remote database
      debug('handle remote database', address, peerId, name)
      if (peerId && heliaInstance && !heliaInstance.libp2p) {
        console.log('dialing peer', peerId)
        const peer = await heliaInstance.libp2p.dial(peerId);
        console.log('peer successfully dialed', peer)
      }

      // Create the database entry for remote DB
      newDB = {
        id: crypto.randomUUID(),
        name: name || 'Unknown Blog',
        address: address,
        postsAddress: '',
        commentsAddress: '',
        mediaAddress: '',
        fetchLater: true,
        date: new Date().toISOString().split('T')[0]
      };
      
      // Try to open the remote settings database
      settingsDb = await orbitdbInstance.open(address);
      debug('settingsDb', settingsDb)
      // Try to get blog name
      const blogNameEntry = await settingsDb.get('blogName');
      if (blogNameEntry?.value?.value) {
        newDB.name = blogNameEntry.value.value;
      }
      
      // Try to get posts address
      const postsAddressEntry = await settingsDb.get('postsDBAddress');
      if (postsAddressEntry?.value?.value) {
        newDB.postsAddress = postsAddressEntry.value.value;
        
        try {
          const postsDb = await orbitdbInstance.open(newDB.postsAddress);
          const allPosts = await postsDb.all();
          console.log(`Fetched ${allPosts.length} posts from remote database`);
          newDB.fetchLater = false;
        } catch (_error) {
          error('Error opening posts database, will try later:',_error);
        }
      }
    }

    const remoteDBsDatabase = get(remoteDBsDatabases);
    const existingDBs = await remoteDBsDatabase.all();

    if (existingDBs.some(db => db.value.address === newDB.address)) {
      console.log('Database already exists in store:', newDB.address);
      return true;
    }
    
    if (remoteDBsDatabase) {
      await remoteDBsDatabase.put({ _id: newDB.id, ...newDB });
      
      const updatedRemoteDBs = [...get(remoteDBs), newDB];
      remoteDBs.set(updatedRemoteDBs);
      
      console.log('Added database to store:', newDB);
      return true;
    }
    return false;
  } catch (_error) {
    error('Error adding database to store:', _error);
    return false;
  }
}

// Add helper function at the top
function hasWriteAccess(db: any, identityId: string): boolean {
  return db.access.write.includes(identityId) || db.access.write.includes("*");
}

interface DBConfig {
  name: string;
  directory: string;
  writeAccess: string[];
  store: any; // Svelte store
  addressStore: any; // Svelte store for address
}

async function openOrCreateDB(
  orbitdbInstance: any,
  dbContents: any[],
  dbKey: string,
  config: DBConfig,
  canWriteToSettings: boolean,
  settingsDB: any
) {
  const dbAddressValue = dbContents.find(content => content.key === dbKey)?.value?.value;
  info(`Found ${dbKey}:`, dbAddressValue);

  if (dbAddressValue) {
    try {
      const dbInstance = await orbitdbInstance.open(dbAddressValue);
      console.log(`${config.name} ${dbAddressValue} loaded`);
      config.store.set(dbInstance);
      return dbInstance;
    } catch (_error) {
      error(`Failed to open ${config.name} database:`, _error);
      if (!canWriteToSettings) {
        console.log(`No write access to settings - skipping ${config.name} database creation`);
      }
    }
  } else if (canWriteToSettings) {
    info('creating new database', config.name)
    try {
      const dbInstance = await orbitdbInstance.open(config.name, {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: config.directory,
        identity: get(identity),
        identities: get(identities),
        AccessController: IPFSAccessController({ write: config.writeAccess })
      });
      config.store.set(dbInstance);
      const dbAddress = dbInstance.address.toString();
      // Store in settings
      info('storing dbAddress in settings', dbAddress)
      await settingsDB.put({ _id: dbKey, value: dbAddress });
      return dbInstance;
    } catch (_error) {
      error(`Failed to create ${config.name} database:`, _error);
    }
  } else {
    warn(`No ${config.name} database address found and no write access to create one`);
  }
  return null;
}

/**
 * Updates a remote database entry with counts and addresses
 * @param address - The address of the database to update
 * @param updates - Object containing the new values to update
 */
function updateRemoteDBEntry(
  address: string,
  updates: {
    postsCount?: number;
    commentsCount?: number;
    mediaCount?: number;
    postsDBAddress?: string;
    commentsDBAddress?: string;
    mediaDBAddress?: string;
    access?: any;
  }
) {
  remoteDBs.update(dbs => {
    return dbs.map(db => {
      if (db.address === address) {
        return {
          ...db,
          ...updates
        };
      }
      return db;
    });
  });
}

async function waitForPeers(heliaInstance: any, minPeers: number = 1, timeout: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const peers = await heliaInstance?.libp2p?.getPeers();
    const peerCount = peers?.length || 0;
    
    updateLoadingState('connecting_peers', `Connected to ${peerCount} peers. Waiting for at least ${minPeers}...`, 20);
    console.log('peerCount', peerCount)
    if (peerCount >= minPeers) {
      console.log('peerCount >= minPeers', peerCount, minPeers)
      return true;
    }
    
    // Wait for 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

/**
 * Switches the application to use a remote OrbitDB database
 * 
 * This function performs a complete database switch operation by:
 * 1. Opening the remote settings database using the provided address
 * 2. Adding the database to Voyager for persistence
 * 3. Loading all blog settings (name, description, categories, posts address)
 * 4. Opening the posts database referenced in the settings
 * 5. Loading all posts from the posts database
 * 6. Updating all relevant Svelte stores with the remote data
 * 
 * The function implements a retry mechanism that continues attempting to 
 * load the database until all required data is successfully retrieved.
 * 
 * @param {string} address - The OrbitDB address of the remote settings database to switch to
 * @param {boolean} [showModal=false] - Whether to show a loading modal during the operation
 * 
 * @returns {Promise<boolean>} True if the switch was successful, false if it failed
 * 
 * @throws {Error} Throws an error if OrbitDB is not initialized
 * 
 * @example
 * // Switch to a remote database without showing a modal
 * await switchToRemoteDB('zdpuAywgooGrEcDdAoMsK4umnDZyxY9gMTdjwww29h2B9MKeh/db-name');
 * 
 * @example
 * // Switch to a remote database with a loading modal
 * await switchToRemoteDB('zdpuAywgooGrEcDdAoMsK4umnDZyxY9gMTdjwww29h2B9MKeh/db-name', true);
 */
export async function switchToRemoteDB(address: string, showModal = false) {
  let retry = true;
  let cancelOperation = false;
  
  let blogNameValue;
  let categoriesValue; 
  
  const orbitdbInstance = get(orbitdb);
  const heliaInstance = get(helia);
  try {
    updateLoadingState('initializing', 'Starting database switch...', 5);

    while (retry && !cancelOperation) {
      if (!orbitdbInstance) throw new Error("OrbitDB not initialized");
      
      // Connect to peers
      updateLoadingState('connecting_peers', 'Connecting to P2P network...', 10);

      await waitForPeers(heliaInstance);
      const peers = await heliaInstance?.libp2p?.getPeers();
      updateLoadingState('connecting_peers', `Connected to ${peers?.length || 0} peers`, 20);
      
      // First clear the posts store to prevent stale data display
      posts.set([]);
      
      updateLoadingState('identifying_db', `Opening database: ${address}`, 30);
      
      // Try opening with Voyager first, fall back to direct OrbitDB if it fails
      let db = await orbitdbInstance.open(address);
      
      if (!db) {
        throw new Error("Failed to open database with both Voyager and OrbitDB");
      }
      
      // Set the settings DB store
      settingsDB.set(db);
      
      // Get all settings data
      updateLoadingState('loading_settings', 'Loading blog configuration...', 40);
      const dbContents = await db.all();
      info('try to switch to remote dbContents', dbContents);

      // Set values from dbContents
      blogNameValue = dbContents.find(content => content.key === 'blogName')?.value?.value;
      info('blogNameValue', blogNameValue);
      const blogDescriptionValue = dbContents.find(content => content.key === 'blogDescription')?.value?.value;
      info('blogDescriptionValue', blogDescriptionValue);
      const postsDBAddressValue = dbContents.find(content => content.key === 'postsDBAddress')?.value?.value;
      info('postsDBAddressValue', postsDBAddressValue);
      const commentsDBAddressValue = dbContents.find(content => content.key === 'commentsDBAddress')?.value?.value;
      info('commentsDBAddressValue', commentsDBAddressValue);
      const mediaDBAddressValue = dbContents.find(content => content.key === 'mediaDBAddress')?.value?.value;
      info('mediaDBAddressValue', mediaDBAddressValue);
      categoriesValue = dbContents.find(content => content.key === 'categories')?.value?.value || ['please add categories']; // Fetch categories
      info('categoriesValue', categoriesValue);
      const profilePictureValue = dbContents.find(content => content.key === 'profilePicture')?.value?.value;
      info('profilePictureValue', profilePictureValue);

      updateLoadingState('loading_settings', 'Processing blog settings...', 50);
      // Update stores with settings data
      if (blogNameValue) blogName.set(blogNameValue);
      if (blogDescriptionValue) blogDescription.set(blogDescriptionValue);
      if (postsDBAddressValue) postsDBAddress.set(postsDBAddressValue);
      if (commentsDBAddressValue) commentsDBAddress.set(commentsDBAddressValue);
      if (mediaDBAddressValue) mediaDBAddress.set(mediaDBAddressValue);
      if (categoriesValue) categories.set(categoriesValue);
      if (profilePictureValue) profilePictureCid.set(profilePictureValue);
      
      updateRemoteDBEntry(address, {
        postsDBAddress: postsDBAddressValue,
        commentsDBAddress: commentsDBAddressValue,
        mediaDBAddress: mediaDBAddressValue
      });
      // Check if we have write access to the settings database
      const identityId = get(identity).id;
      const canWriteToSettings = hasWriteAccess(db, identityId);
      info('Write access to settings:', canWriteToSettings);

      // Check if all required data is available
      if (blogNameValue && blogDescriptionValue && postsDBAddressValue)  {
        info('blogNameValue', blogNameValue);
        info('blogDescriptionValue', blogDescriptionValue);
        info('postsDBAddressValue', postsDBAddressValue);

        // Track counts for later update
        let postsCount = 0;
        let commentsCount = 0;
        let mediaCount = 0;
        let postsDBAddress = '';
        let commentsDBAddress = '';
        let mediaDBAddress = '';

        updateLoadingState('loading_posts', 'Opening posts database...', 60);
        // Create promises for all DB operations
        const postsPromise = openOrCreateDB(orbitdbInstance, dbContents, 'postsDBAddress', {
          name: 'posts',
          directory: './orbitdb/posts',
          writeAccess: [get(identity).id],
          store: postsDB,
          addressStore: postsDBAddress
        }, canWriteToSettings, db)
        .then(async postsInstance => {
          if (postsInstance) {
            info('postsInstance', postsInstance)
            postsDBAddress = postsInstance.address.toString()
            // Only attempt to write if we have permissions
            if (canWriteToSettings) {
              await get(settingsDB).put({ _id: 'postsDBAddress', value: postsDBAddress });
            }
            const allPosts = (await postsInstance.all()).map(post => {
              console.log('post', post)
              const { _id, ...rest } = post.value;
              return { 
                ...rest,
                _id: _id,
                content: rest.content || rest.value?.content,
                title: rest.title || rest.value?.title,
                date: rest.date || rest.value?.date,
              };
            });
            postsCount = allPosts.length;
            posts.set(allPosts);
            return { instance: postsInstance, access: postsInstance.access };
          }
          return null;
        });

        updateLoadingState('loading_comments', 'Opening comments database...', 70);
        const commentsPromise = openOrCreateDB(orbitdbInstance, dbContents, 'commentsDBAddress', {
          name: 'comments',
          directory: './orbitdb/comments',
          writeAccess: ["*"],
          store: commentsDB,
          addressStore: commentsDBAddress
        }, canWriteToSettings, db)
        .then(async commentsInstance => {
          if (commentsInstance) {
            info('commentsInstance', commentsInstance)
            commentsDBAddress = commentsInstance.address.toString()
            // Only attempt to write if we have permissions
            if (canWriteToSettings) {
              await get(settingsDB).put({ _id: 'commentsDBAddress', value: commentsDBAddress });
            }
            
            const allComments = await commentsInstance.all();
            commentsCount = allComments.length;
          }
        });

        updateLoadingState('loading_media', 'Opening media database...', 80);
        const mediaPromise = openOrCreateDB(orbitdbInstance, dbContents, 'mediaDBAddress', {
          name: 'media',
          directory: './orbitdb/media',
          writeAccess: [get(identity).id],
          store: mediaDB,
          addressStore: mediaDBAddress
        }, canWriteToSettings, db)
        .then(async mediaInstance => {
          if (mediaInstance) {
            info('mediaInstance', mediaInstance)
            mediaDBAddress = mediaInstance.address.toString()
            // Only attempt to write if we have permissions
            if (canWriteToSettings) {
              await get(settingsDB).put({ _id: 'mediaDBAddress', value: mediaDBAddress });
            }
            const allMedia = await mediaInstance.all();
            mediaCount = allMedia.length;
          }
        });

        // Wait for all operations to complete
        updateLoadingState('loading_media', 'Finalizing database loading...', 90);
        const [postsResult] = await Promise.all([postsPromise, commentsPromise, mediaPromise]);
        
        // Update remote DBs with the counts and access info
        updateRemoteDBEntry(address, {
          postsCount,
          commentsCount,
          mediaCount,
          postsDBAddress,
          commentsDBAddress,
          mediaDBAddress,
          access: postsResult?.access
        });

        updateLoadingState('complete', 'Blog loaded successfully!', 100);
        info('remoteDBs', get(remoteDBs))
        retry = false; // Stop retrying if all data is fetched
      } else {
        updateLoadingState('loading_settings', 'Waiting for required data...', 45);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
      }
    }
    return true;
  } catch (_error) {
    error('Failed to switch to remote DB:', _error);
    updateLoadingState('error', `Error: ${_error.message}`, 0);
    return false;
  } finally {
    // Update remote DBs store
    const remoteDBsDatabase = get(remoteDBsDatabases);
    if (remoteDBsDatabase) {
      const existingDBs = await remoteDBsDatabase.all();
      if (!existingDBs.some(db => db.value?.address === address)) {
        await addRemoteDBToStore(address, '', blogNameValue || 'Loading...');
      }
    }
  }
}

/**
 * Creates a new set of databases (settings, posts, comments, media) and initializes them
 * @param orbitdbInstance - The OrbitDB instance
 * @param identity - The user's identity
 * @param identities - The identities instance
 * @param name - The name for the blog/database set
 * @returns Object containing all created database instances and their addresses
 */
export async function createDatabaseSet(orbitdbInstance: any, identity: any, identities: any, name: string = 'blog') {
  if (!orbitdbInstance) throw new Error("OrbitDB not initialized");
  
  // Create settings database
  const settingsDb = await orbitdbInstance.open(`${name}-settings`, {
    type: 'documents',
    create: true,
    overwrite: false,
    directory: './orbitdb/settings',
    identity: identity,
    identities: identities,
    AccessController: IPFSAccessController({write: [identity.id]})
  });

  // Create posts database
  const postsDb = await orbitdbInstance.orbitdb.open(`${name}-posts`, {
    type: 'documents',
    create: true,
    overwrite: false,
    directory: './orbitdb/posts',
    identity: identity,
    identities: identities,
    AccessController: IPFSAccessController({write: [identity.id]})
  });

  // Create comments database
  const commentsDb = await orbitdbInstance.orbitdb.open(`${name}-comments`, {
    type: 'documents',
    create: true,
    overwrite: false,
    directory: './orbitdb/comments',
    identity: identity,
    identities: identities,
    AccessController: IPFSAccessController({write: ["*"]})
  });

  // Create media database
  const mediaDb = await orbitdbInstance.orbitdb.open(`${name}-media`, {
    type: 'documents',
    create: true,
    overwrite: false,
    directory: './orbitdb/media',
    identity: identity,
    identities: identities,
    AccessController: IPFSAccessController({write: [identity.id]})
  });

  // Store addresses in settings DB
  await settingsDb.put({ _id: 'blogName', value: name });
  await settingsDb.put({ _id: 'blogDescription', value: 'please change' });
  await settingsDb.put({ _id: 'postsDBAddress', value: postsDb.address.toString() });
  await settingsDb.put({ _id: 'commentsDBAddress', value: commentsDb.address.toString() });
  await settingsDb.put({ _id: 'mediaDBAddress', value: mediaDb.address.toString() });

  return {
    settingsDb,
    postsDb,
    commentsDb,
    mediaDb,
    addresses: {
      settings: settingsDb.address.toString(),
      posts: postsDb.address.toString(),
      comments: commentsDb.address.toString(),
      media: mediaDb.address.toString()
    }
  };
} 