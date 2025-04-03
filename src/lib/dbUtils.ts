import { get } from 'svelte/store';
import { helia, orbitdb, blogName, categories, blogDescription, postsDBAddress, postsDB, posts, settingsDB, remoteDBs, commentsDB, mediaDB, remoteDBsDatabases, commentsDBAddress, mediaDBAddress, identity, identities, voyager } from './store';
import type { RemoteDB } from './types';
import { IPFSAccessController } from '@orbitdb/core';

export async function addRemoteDBToStore(address: string, peerId: string, name?: string) {
  console.log('addRemoteDBToStore', address, peerId, name)
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
      console.log('addedSettingsToVoyager', addedSettings)
      const postsDb = await voyagerInstance.orbitdb.open(`${name}-posts`, {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/posts',
        identity: identityInstance,
        identities: identitiesInstance,
        AccessController: IPFSAccessController({write: [identityInstance.id]})
      });
      const addedPosts = await voyagerInstance.add(postsDb.address)
      console.log('addedPostsToVoyager', addedPosts)

      // Initialize the settings
      await settingsDb.put({ _id: 'blogName', value: name });
      await settingsDb.put({ _id: 'blogDescription', value: 'please change' });
      await settingsDb.put({ _id: 'postsDBAddress', value: postsDb.address.toString() });

      newDB = {
        id: crypto.randomUUID(),
        name: name,
        address: settingsDb.address.toString(),
        postsAddress: postsDb.address.toString(),
        fetchLater: false,
        date: new Date().toISOString().split('T')[0]
      };
    } else {
      // Handle remote database
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
        } catch (error) {
          console.error('Error opening posts database, will try later:', error);
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
  } catch (error) {
    console.error('Error adding database to store:', error);
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
  console.log(`Found ${dbKey}:`, dbAddressValue);

  if (dbAddressValue) {
    try {
      const dbInstance = await voyagerInstance.orbitdb.open(dbAddressValue);
      console.log(`${config.name} ${dbAddressValue} loaded`);
      config.store.set(dbInstance);
      config.addressStore.set(dbAddressValue);
      return dbInstance;
    } catch (error) {
      console.error(`Failed to open ${config.name} database:`, error);
      if (!canWriteToSettings) {
        console.log(`No write access to settings - skipping ${config.name} database creation`);
      }
    }
  } else if (canWriteToSettings) {
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
      config.addressStore.set(dbAddress);
      // Store in settings
      await settingsDB.put({ _id: dbKey, value: dbAddress });
      return dbInstance;
    } catch (error) {
      console.error(`Failed to create ${config.name} database:`, error);
    }
  } else {
    console.log(`No ${config.name} database address found and no write access to create one`);
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
  
  let isModalOpen = showModal;
  let blogNameValue;
  let categoriesValue; 
  let access;
  let postsCount;  
  
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
      console.log(`settingsDB ${address} added to voyager`, added)
      
      // Set the settings DB store
      settingsDB.set(db);
     
      // Get all settings data
      const dbContents = await db.all();
      console.log('try to switch to remote dbContents', dbContents);

      // Set values from dbContents
      blogNameValue = dbContents.find(content => content.key === 'blogName')?.value?.value;
      console.log('blogNameValue', blogNameValue);
      const blogDescriptionValue = dbContents.find(content => content.key === 'blogDescription')?.value?.value;
      console.log('blogDescriptionValue', blogDescriptionValue);
      const postsDBAddressValue = dbContents.find(content => content.key === 'postsDBAddress')?.value?.value;
      console.log('postsDBAddressValue', postsDBAddressValue);
      categoriesValue = dbContents.find(content => content.key === 'categories')?.value?.value || ['please add categories']; // Fetch categories
      console.log('categoriesValue', categoriesValue);

      // Update stores with settings data
      if (blogNameValue) blogName.set(blogNameValue);
      if (blogDescriptionValue) blogDescription.set(blogDescriptionValue);
      if (postsDBAddressValue) postsDBAddress.set(postsDBAddressValue);
      if (categoriesValue) categories.set(categoriesValue);

      // Check if we have write access to the settings database
      const identityId = get(identity).id;
      const canWriteToSettings = hasWriteAccess(db, identityId);
      console.log('Write access to settings:', canWriteToSettings);

      // Check if all required data is available
      if (blogNameValue && blogDescriptionValue && postsDBAddressValue && categoriesValue) {
        console.log('blogNameValue', blogNameValue);
        console.log('blogDescriptionValue', blogDescriptionValue);
        console.log('postsDBAddressValue', postsDBAddressValue);

        // Posts DB
        const postsInstance = await openOrCreateDB(voyagerInstance, dbContents, 'postsDBAddress', {
          name: 'posts',
          directory: './orbitdb/posts',
          writeAccess: [get(identity).id],
          store: postsDB,
          addressStore: postsDBAddress
        }, canWriteToSettings, db);

        if (postsInstance) {
          // Ensure we have the latest data by getting all posts
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
          
          console.log(`Loaded ${allPosts.length} posts with content:`, allPosts);
          postsCount = allPosts.length;
          access = postsInstance.access;
          
          // Set posts store with the loaded data
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure DB is ready
          posts.set(allPosts);
        }

        // Comments DB
        await openOrCreateDB(voyagerInstance, dbContents, 'commentsDBAddress', {
          name: 'comments',
          directory: './orbitdb/comments',
          writeAccess: ["*"],
          store: commentsDB,
          addressStore: commentsDBAddress
        }, canWriteToSettings, db);

        // Media DB
        await openOrCreateDB(voyagerInstance, dbContents, 'mediaDBAddress', {
          name: 'media',
          directory: './orbitdb/media',
          writeAccess: [get(identity).id],
          store: mediaDB,
          addressStore: mediaDBAddress
        }, canWriteToSettings, db);

        retry = false; // Stop retrying if all data is fetched
      } else {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait before retrying
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to switch to remote DB:', error);
    return false;
  } finally {
    // Update remote DBs store
    const remoteDBsDatabase = get(remoteDBsDatabases);
    if (remoteDBsDatabase) {
      const existingDBs = await remoteDBsDatabase.all();
      if (!existingDBs.some(db => db.value?.address === address)) {
        await addRemoteDBToStore(address, '', blogNameValue || 'Loading...');
      } else {
        remoteDBs.update(dbs => {
          return dbs.map(db => {
            if (db.address === address) {
              return {...db, postsCount, access};
            }
            return db;
          });
        });
      }
    }
  }
} 