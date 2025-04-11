import { get } from 'svelte/store';
import { helia, orbitdb, blogName, categories, blogDescription, postsDBAddress, profilePictureCid, postsDB, posts, settingsDB, remoteDBs, commentsDB, mediaDB, remoteDBsDatabases, commentsDBAddress, mediaDBAddress, identity, identities, voyager } from './store';
import type { RemoteDB } from './types';
import { IPFSAccessController } from '@orbitdb/core';
import { error, info, debug, warn } from './utils/logger.js'
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
  const voyagerInstance = get(voyager);
  if (!orbitdbInstance) throw new Error("OrbitDB not initialized");
  if (!voyagerInstance) throw new Error("Voyager not initialized");

  
  try {
    let settingsDb;
    let newDB: RemoteDB;

    // If no address is provided, create a new local database
    if (!address && name) {
      settingsDb = await  voyagerInstance.orbitdb.open(`${name}-settings`, {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/settings',
        identity: identityInstance,
        identities: identitiesInstance,
        AccessController: IPFSAccessController({write: [identityInstance.id]})
      });
      const addedSettings = await voyagerInstance.add(settingsDb.address)
      debug('addedSettingsToVoyager', addedSettings)
      const postsDb = await voyagerInstance.orbitdb.open(`${name}-posts`, {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/posts',
        identity: identityInstance,
        identities: identitiesInstance,
        AccessController: IPFSAccessController({write: [identityInstance.id]})
      });
      voyagerInstance?.add(postsDb.address)
        .then(added => console.log('addedPostsToVoyager', added))
        .catch(err => error('Failed to add posts to voyager:', err));

      // Create comments database (new)
      const commentsDb = await voyagerInstance.orbitdb.open(`${name}-comments`, {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/comments',
        identity: identityInstance,
        identities: identitiesInstance,
        // Comments can be written by anyone
        AccessController: IPFSAccessController({write: ["*"]})
      });
      voyagerInstance?.add(commentsDb.address)
        .then(added => console.log('addedCommentsToVoyager', added))
        .catch(err => error('Failed to add comments to voyager:', err));

      // Create media database (new)
      const mediaDb = await voyagerInstance.orbitdb.open(`${name}-media`, {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/media',
        identity: identityInstance,
        identities: identitiesInstance,
        AccessController: IPFSAccessController({write: [identityInstance.id]})
      });
      voyagerInstance?.add(mediaDb.address)
        .then(added => console.log('addedMediaToVoyager', added))
        .catch(err => error('Failed to add media to voyager:', err));

      // Initialize the settings
      await settingsDb.put({ _id: 'blogName', value: name });
      await settingsDb.put({ _id: 'blogDescription', value: 'please change' });
      await settingsDb.put({ _id: 'postsDBAddress', value: postsDb.address.toString() });
      // Add new settings entries
      await settingsDb.put({ _id: 'commentsDBAddress', value: commentsDb.address.toString() });
      await settingsDb.put({ _id: 'mediaDBAddress', value: mediaDb.address.toString() });

      newDB = {
        id: crypto.randomUUID(),
        name: name,
        address: settingsDb.address.toString(),
        postsAddress: postsDb.address.toString(),
        commentsAddress: commentsDb.address.toString(),
        mediaAddress: mediaDb.address.toString(),
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
  voyagerInstance: any,
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
      const dbInstance = await voyagerInstance.orbitdb.open(dbAddressValue);
      await voyagerInstance.add(dbInstance.address);
      console.log(`${config.name} ${dbAddressValue} loaded`);
      config.store.set(dbInstance);
      // config.addressStore.set(dbAddressValue);
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
      const dbInstance = await voyagerInstance.orbitdb.open(config.name, {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: config.directory,
        identity: get(identity),
        identities: get(identities),
        AccessController: IPFSAccessController({ write: config.writeAccess })
      });
      await voyagerInstance.add(dbInstance.address);
      config.store.set(dbInstance);
      const dbAddress = dbInstance.address.toString();
      // config.addressStore.set(dbAddress);
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
  let profilePictureValue;
  
  const voyagerInstance = get(voyager);
  
  // Get existing remote DB information to preserve
  const existingRemoteDBs = get(remoteDBs);
  const existingDB = existingRemoteDBs.find(db => db.address === address);
  const existingPostsCount = existingDB?.postsCount;
  
  try {
    while (retry && !cancelOperation) {
      const orbitdbInstance = get(orbitdb);
      if (!orbitdbInstance) throw new Error("OrbitDB not initialized");
      
      // First clear the posts store to prevent stale data display
      posts.set([]);
      
      const db = await voyagerInstance.orbitdb.open(address);
     
      const added = await voyagerInstance.add(db.address)
      db.pinnedToVoyager = added;
      info(`settingsDB ${address} added to voyager`, added)
      
      // Set the settings DB store
      settingsDB.set(db);
     
      // Get all settings data
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

      // Update stores with settings data
      if (blogNameValue) blogName.set(blogNameValue);
      if (blogDescriptionValue) blogDescription.set(blogDescriptionValue);
      if (postsDBAddressValue) postsDBAddress.set(postsDBAddressValue);
      if (commentsDBAddressValue) commentsDBAddress.set(commentsDBAddressValue);
      if (mediaDBAddressValue) mediaDBAddress.set(mediaDBAddressValue);
      if (categoriesValue) categories.set(categoriesValue);
      if (profilePictureValue) profilePictureCid.set(profilePictureValue);

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

        // Create promises for all DB operations
        const postsPromise = openOrCreateDB(voyagerInstance, dbContents, 'postsDBAddress', {
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
            await get(settingsDB).put({ _id: 'postsDBAddress', value: postsDBAddress });
            const allPosts = (await postsInstance.all()).map(post => {
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

        const commentsPromise = openOrCreateDB(voyagerInstance, dbContents, 'commentsDBAddress', {
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
            await get(settingsDB).put({ _id: 'commentsDBAddress', value: commentsDBAddress });
            
            const allComments = await commentsInstance.all();
            commentsCount = allComments.length;
          }
        });

        const mediaPromise = openOrCreateDB(voyagerInstance, dbContents, 'mediaDBAddress', {
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
            await get(settingsDB).put({ _id: 'mediaDBAddress', value: mediaDBAddress });
            const allMedia = await mediaInstance.all();
            mediaCount = allMedia.length;
          }
        });

        // Wait for all operations to complete
        info('waiting for all operations to complete')
        const [postsResult] = await Promise.all([postsPromise, commentsPromise, mediaPromise]);
        info('all operations complete')
        // Update remote DBs with the counts and access info
        remoteDBs.update(dbs => {
          return dbs.map(db => {
            info('updating address', db.address, address)
            if (db.address === address) {
              info('updating remote db', db)
              info('commentsDBAddress',  commentsDBAddress)
              info('mediaDBAddress', mediaDBAddress)
              return {
                ...db, 
                postsCount, 
                commentsCount, 
                mediaCount, 
                postsDBAddress,
                commentsDBAddress,
                mediaDBAddress,
                access: postsResult?.access
              }; 
            }
            console.log('updated remote db', db)
            return db;
          });
        });
        info('remoteDBs', get(remoteDBs))
        retry = false; // Stop retrying if all data is fetched
      } else {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
      }
    }
    return true;
  } catch (_error) {
    error('Failed to switch to remote DB:', _error);
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