import { writable, derived } from 'svelte/store';
import { createLibp2p } from 'libp2p'
import { createHelia } from 'helia'
import { createOrbitDB } from '@orbitdb/core'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import { Libp2pOptions } from './config'
import type { Post, Category, RemoteDB } from './types';

// Utility function to create a store that syncs with localStorage
function localStorageStore(key, initialValue) {
  const storedValue = localStorage.getItem(key);
  const store = writable(storedValue !== null ? JSON.parse(storedValue) : initialValue);

  store.subscribe(value => {
    localStorage.setItem(key, JSON.stringify(value));
  });

  return store;
}

// Initialize storage
let blockstore = new LevelBlockstore('./helia-blocks');
let datastore = new LevelDatastore('./helia-data');

// Initialize Helia and OrbitDB
const libp2p = await createLibp2p(Libp2pOptions)
const helia = await createHelia({libp2p, datastore, blockstore})

const orbitdb = await createOrbitDB({
   ipfs: helia,
   identity: libp2p.identity,
   storage: blockstore,
   directory: './orbitdb',
});

// Create stores
export const heliaStore = writable(helia)
export const orbitStore = writable(orbitdb)
export const settingsDB = writable(null)
export const settings = writable({
  blogName: 'Orbit Blog',
  blogDescription: 'A peer-to-peer blog system on IPFS running a Svelte and OrbitDB',
});
export const postsDB = writable(null)
export const remoteDBs = writable<RemoteDB[]>([])
export const selectedDBAddress = writable<string | null>(null)
export const remoteDBsDatabase = writable(null)

// Local storage-backed stores
export const showDBManager = localStorageStore('showDBManager', false);
export const showPeers = localStorageStore('showPeers', false);
export const showSettings = localStorageStore('showSettings', false);
// Sample data
const samplePosts: Post[] = [
//   {
//     _id: '1',
//     title: 'Understanding Bitcoin Fundamentals',
//     content: `# Bitcoin Basics
    
// Bitcoin is the first and most well-known cryptocurrency. Here's what you need to know:

// * Decentralized digital currency
// * Limited supply of 21 million
// * Proof of Work consensus mechanism

// ## Why Bitcoin Matters

// Bitcoin represents financial freedom and sovereignty.`,
//     category: 'Bitcoin',
//     date: '2024-03-15',
//     comments: [
//       {
//         _id: '1',
//         postId: '1',
//         content: 'Great introduction to Bitcoin!',
//         author: 'CryptoEnthusiast',
//         date: '2024-03-15'
//       }
//     ]
//   },
];

export const posts = writable<Post[]>(samplePosts);
export const searchQuery = writable('');
export const selectedCategory = writable<Category | 'All'>('All');
  
// Synchronize settings with settingsDB
let _settingsDB = null;

settingsDB.subscribe(async (_settingsDB) => {
  _settingsDB = _settingsDB;
})

settings.subscribe(async (newSettings) => {
    if (_settingsDB) {
      for (const key in newSettings) {
        if (newSettings[key] !== previousSettings[key]) {
            console.log('settings change', key, newSettings[key]);
          // Remove existing entry
          await _settingsDB.del(key);
          // Add new entry
          await _settingsDB.put({ _id: key, value: newSettings[key] });
        }
      }
      console.log('settingsDB updated',await _settingsDB.all());
    }
  });

// Add event listeners to the libp2p instance after Helia is created
helia.libp2p.addEventListener('peer:discovery', (evt) => {
    console.log('Peer discovered:', {
        id: evt.detail.id.toString(),
        multiaddrs: evt.detail.multiaddrs.toString(),
        protocols: evt.detail.protocols
    });
});

helia.libp2p.addEventListener('peer:connect', (evt) => {
    console.log('Peer connected:', {
        id: evt.detail.toString(),
        // protocols: helia.libp2p.services.identify.getPeerProtocols(evt.detail)
    });
});

helia.libp2p.addEventListener('peer:disconnect', (evt) => {
    console.log('Peer disconnected:', evt.detail.toString());
});
