import { get } from 'svelte/store';
import { helia, orbitdb, blogName, blogDescription, postsDBAddress, postsDB, posts, remoteDBs, remoteDBsDatabases } from './store';
import type { RemoteDB } from './types';

export async function addRemoteDBToStore(address: string, peerId: string, name?: string) {
  console.log('addRemoteDBToStore', address, peerId, name)
  const heliaInstance = get(helia);

  if (peerId && heliaInstance && !heliaInstance.libp2p) {
    console.log('dialing peer', peerId)
    const peer = await heliaInstance.libp2p.dial(peerId);
    console.log('peer successfully dialed', peer)
  }

  try {
 

    const orbitdbInstance = get(orbitdb);
    if (!orbitdbInstance) throw new Error("OrbitDB not initialized");
    
    // Create the database entry
    const newDB: RemoteDB = {
      id: crypto.randomUUID(),
      name: name || 'Unknown Blog',
      address: address,
      fetchLater: true,
      date: new Date().toISOString().split('T')[0]
    };
    
    // Try to open the settings database
    const settingsDb = await orbitdbInstance.open(address);
    console.log('settingsDb', await settingsDb.all())
    
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
    
    // Store the database in remoteDBsDatabases
    const remoteDBsDatabase = get(remoteDBsDatabases);
    console.log('remoteDBsDatabase', remoteDBsDatabase)
    const existingDBs = await remoteDBsDatabase.all()
    console.log('existingDBs', existingDBs)
    if (existingDBs.some(db => db.address === address)) {
         console.log('Database already exists in store:', address);
         return true;
    }
       
    if (remoteDBsDatabase) {
      await remoteDBsDatabase.put({ _id: newDB.id, ...newDB });
      
      // Update the remoteDBs store
      const updatedRemoteDBs = [...get(remoteDBs), newDB];
      remoteDBs.set(updatedRemoteDBs);
      
      console.log('Added remote database to store:', newDB);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error adding remote database to store:', error);
    return false;
  }
}

export async function switchToRemoteDB(address: string, showModal = false) {
  let retry = true;
  let cancelOperation = false;
  
  // Optional modal handling variables
  let isModalOpen = showModal;
  let blogNameValue
  try {
    while (retry && !cancelOperation) {
      const orbitdbInstance = get(orbitdb);
      if (!orbitdbInstance) throw new Error("OrbitDB not initialized");
      
      const db = await orbitdbInstance.open(address);
      const dbContents = await db.all();
      console.log('try to switch to remote dbContents', dbContents);

      // Set values from dbContents
      blogNameValue = dbContents.find(content => content.key === 'blogName')?.value?.value;
      console.log('blogNameValue', blogNameValue)
      const blogDescriptionValue = dbContents.find(content => content.key === 'blogDescription')?.value?.value;
      console.log('blogDescriptionValue', blogDescriptionValue)
      const postsDBAddressValue = dbContents.find(content => content.key === 'postsDBAddress')?.value?.value;
      console.log('postsDBAddressValue', postsDBAddressValue)
      
      if (blogNameValue) blogName.set(blogNameValue);
      if (blogDescriptionValue) blogDescription.set(blogDescriptionValue);
      if (postsDBAddressValue) postsDBAddress.set(postsDBAddressValue);

      // Check if all required data is available
      if (blogNameValue && blogDescriptionValue && postsDBAddressValue) {
        console.log('blogNameValue', blogNameValue)
        console.log('blogDescriptionValue', blogDescriptionValue)
        console.log('postsDBAddressValue', postsDBAddressValue)
        // Load posts from postsDBAddress
        const postsDBInstance = await orbitdbInstance.open(postsDBAddressValue);
        postsDB.set(postsDBInstance);
        
        const allPosts = (await postsDBInstance.all()).map(post => {
          const { _id, ...rest } = post.value;
          return { ...rest, id: _id };
        });
        posts.set(allPosts);
        console.log('allPosts', allPosts.length)
        
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
      }
    }
    
    if (showModal) {
      // Signal to close modal if needed
    }
  }
} 