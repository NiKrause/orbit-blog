import { writable, derived } from 'svelte/store';
import { createLibp2p } from 'libp2p'
import { createHelia } from 'helia'
import { createOrbitDB } from '@orbitdb/core'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import { Libp2pOptions } from './config'
import type { Post, Category, RemoteDB } from './types';

// Initialize storage
let blockstore = new LevelBlockstore('./helia-blocks');
let datastore = new LevelDatastore('./helia-data');

// Initialize Helia and OrbitDB
const libp2p = await createLibp2p(Libp2pOptions)
const helia = await createHelia({libp2p, datastore, blockstore})

const orbitdb = await createOrbitDB({
   ipfs: helia,
   storage: blockstore,
   directory: './orbitdb',
});
//const orbitdb = null
// Create stores
export const heliaStore = writable(helia)
export const orbitStore = writable(orbitdb)
export const postsDB = writable(null)
export const remoteDBs = writable<RemoteDB[]>([])
export const selectedDBAddress = writable<string | null>(null)
export const remoteDBsDatabase = writable(null)
// Sample data
const samplePosts: Post[] = [
  {
    _id: '1',
    title: 'Understanding Bitcoin Fundamentals',
    content: `# Bitcoin Basics
    
Bitcoin is the first and most well-known cryptocurrency. Here's what you need to know:

* Decentralized digital currency
* Limited supply of 21 million
* Proof of Work consensus mechanism

## Why Bitcoin Matters

Bitcoin represents financial freedom and sovereignty.`,
    category: 'Bitcoin',
    date: '2024-03-15',
    comments: [
      {
        _id: '1',
        postId: '1',
        content: 'Great introduction to Bitcoin!',
        author: 'CryptoEnthusiast',
        date: '2024-03-15'
      }
    ]
  },
];

export const posts = writable<Post[]>(samplePosts);
export const searchQuery = writable('');
export const selectedCategory = writable<Category | 'All'>('All');

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
