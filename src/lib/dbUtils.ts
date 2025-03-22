import { get } from 'svelte/store';
import { helia, orbitdb, blogName, categories, blogDescription, postsDBAddress, postsDB, posts, settingsDB, remoteDBs, remoteDBsDatabases, identity, identities, voyager } from './store';
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
      
      const db = await voyagerInstance.orbitdb.open(address);
     
      const added = await voyagerInstance.add(db.address)
      db.pinnedToVoyager = added;
      console.log(`settingsDB ${address} added to voyager`, added)
      settingsDB.set(db);
     
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

      if (blogNameValue) blogName.set(blogNameValue);
      if (blogDescriptionValue) blogDescription.set(blogDescriptionValue);
      if (postsDBAddressValue) postsDBAddress.set(postsDBAddressValue);
      if (categoriesValue) categories.set(categoriesValue); // Set categories

      // Check if all required data is available
      if (blogNameValue && blogDescriptionValue && postsDBAddressValue && categoriesValue) {
        console.log('blogNameValue', blogNameValue);
        console.log('blogDescriptionValue', blogDescriptionValue);
        console.log('postsDBAddressValue', postsDBAddressValue);
        // console.log('categoriesValue', categoriesValue);
        // Load posts from postsDBAddress
        const postsDBInstance = await voyagerInstance.orbitdb.open(postsDBAddressValue);
        try { await voyagerInstance.add(postsDBInstance.address);  console.log(`postsDB ${postsDBAddressValue} added to voyager`, addedPosts)} catch (e) { console.log('Failed to add posts DB to voyager:', e) }
        console.log(`postsDB ${postsDBAddressValue} loaded`)
        postsDB.set(postsDBInstance);
        
        // Get comments DB address and open it
        const commentsDBAddressValue = dbContents.find(content => content.key === 'commentsDBAddress')?.value?.value;
        if (commentsDBAddressValue) {
          const commentsDBInstance = await voyagerInstance.orbitdb.open(commentsDBAddressValue);
          try { await voyagerInstance.add(commentsDBInstance.address);  console.log(`commentsDB ${commentsDBAddressValue} added to voyager`, addedComments)} catch (e) { console.log('Failed to add comments DB to voyager:', e) }
          console.log(`commentsDB ${commentsDBAddressValue} loaded`)
          commentsDB.set(commentsDBInstance);
          commentsDBAddress.set(commentsDBAddressValue);
        }

        // Get media DB address and open it
        const mediaDBAddressValue = dbContents.find(content => content.key === 'mediaDBAddress')?.value?.value;
        if (mediaDBAddressValue) {
          const mediaDBInstance = await voyagerInstance.orbitdb.open(mediaDBAddressValue);
          try { await voyagerInstance.add(mediaDBInstance.address);  console.log(`mediaDB ${mediaDBAddressValue} added to voyager`, addedMedia)} catch (e) { console.log('Failed to add media DB to voyager:', e) }
          console.log(`mediaDB ${mediaDBAddressValue} loaded`)
          mediaDB.set(mediaDBInstance);
          mediaDBAddress.set(mediaDBAddressValue);
        } 

        const allPosts = (await postsDBInstance.all()).map(post => {
          const { _id, ...rest } = post.value;
          return { ...rest, id: _id };
        });
        console.log('allPosts', allPosts);
        postsCount = allPosts.length;
        access = postsDBInstance.access;
        posts.set(allPosts);
        
        // Update the remote DBs store to preserve the postsCount
        if (existingDB) {
          remoteDBs.update(dbs => {
            return dbs.map(db => {
              if (db.address === address) {
                return {...db, postsCount, access};
              }
              return db;
            });
          });
        }
        
        console.log('allPosts', allPosts.length);
        
        retry = false; // Stop retrying if all data is fetched
      } else {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 500ms before retrying
      }
    }
    return true;
  } catch (error) {
    console.error('Failed to switch to remote DB:', error);
    return false;
  } finally {
    // Check if the database already exists in the store before adding it
    const remoteDBsDatabase = get(remoteDBsDatabases);
    if (remoteDBsDatabase) {
      const existingDBs = await remoteDBsDatabase.all();
      if (!existingDBs.some(db => db.value?.address === address)) {
        // Only add if it doesn't exist already
        addRemoteDBToStore(address, '', blogNameValue || 'Loading...');
      } else {
        // Update existing with postsCount and access
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
    
    if (showModal) {
      // Signal to close modal if needed
    }
  }
} 