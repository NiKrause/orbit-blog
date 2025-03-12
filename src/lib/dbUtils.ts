import { get } from 'svelte/store';
import { orbitdb, blogName, blogDescription, postsDBAddress, postsDB, posts } from './store';

export async function switchToRemoteDB(address: string, showModal = false) {
  let retry = true;
  let cancelOperation = false;
  
  // Optional modal handling variables
  let isModalOpen = showModal;
  
  try {
    while (retry && !cancelOperation) {
      const orbitdbInstance = get(orbitdb);
      if (!orbitdbInstance) throw new Error("OrbitDB not initialized");
      
      const db = await orbitdbInstance.open(address);
      const dbContents = await db.all();
      console.log('try to switch to remote dbContents', dbContents);

      // Set values from dbContents
      const blogNameValue = dbContents.find(content => content.key === 'blogName')?.value?.value;
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
    if (showModal) {
      // Signal to close modal if needed
    }
  }
} 