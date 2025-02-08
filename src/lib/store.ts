import { writable, derived } from 'svelte/store';
import { createLibp2p } from 'libp2p'

import { createHelia } from 'helia'
import { createOrbitDB } from '@orbitdb/core'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import { Libp2pOptions } from './config'
import type { Post, Category, RemoteDB } from './types';
import { localStorageStore, createPeerIdFromSeedPhrase } from './utils';
import { generateMnemonic } from 'bip39';

// Initialize storage
let blockstore = new LevelBlockstore('./helia-blocks');
let datastore = new LevelDatastore('./helia-data');

export const persistentSeedPhrase = writable(false);
// Create writable stores
export const settingsDB = writable(null)
export const postsDB = writable(null)
export const remoteDBs = writable<RemoteDB[]>([])
export const selectedDBAddress = writable<string | null>(null)
export const remoteDBsDatabase = writable(null)

export const settings = writable({
  blogName: 'Orbit Blog',
  blogDescription: 'A peer-to-peer blog system on IPFS running a Svelte and OrbitDB',
});

// Synchronize settings with settingsDB
let _settingsDB = null;
settingsDB.subscribe(async (_settingsDB) => {
  _settingsDB = _settingsDB;
})
let _settings = null;
settings.subscribe(async (newSettings) => { //seedPhrase not in orbitdb since we cannot find it without it
    _settings = newSettings;
    if (_settingsDB) {
      for (const key in newSettings) {
        if (newSettings[key] !== previousSettings[key]) {
            console.log('settings change', key, newSettings[key]);
          // Remove existing entry
          try { await _settingsDB.del(key); } catch {}
          // Add new entry
          await _settingsDB.put({ _id: key, value: newSettings[key] });
        }
      }
      console.log('settingsDB updated',await _settingsDB.all());
    }
  });
// Initialize the seed phrase
settings.update(currentSettings => {
  if (!currentSettings.seedPhrase) {
    // Check localStorage for existing seed phrase
    let seedPhrase = localStorage.getItem('seedPhrase');
    persistentSeedPhrase.set(true);
    if (!seedPhrase) {
      // Generate a new mnemonic if no seed phrase is found
      seedPhrase = generateMnemonic();
      console.log('Generated new mnemonic:', seedPhrase);
    }
    return { ...currentSettings, seedPhrase };
  }
  return currentSettings;
});
// Synchronize seed phrase with localStorage based on persistence
persistentSeedPhrase.subscribe((isPersistent) => {
  if (isPersistent) {
    settings.subscribe((currentSettings) => {
      localStorage.setItem('seedPhrase', currentSettings.seedPhrase);
    });
  } else {
    localStorage.removeItem('seedPhrase');
  }
});

const peerId = await createPeerIdFromSeedPhrase(_settings.seedPhrase);
const libp2p = await createLibp2p({peerId, ...Libp2pOptions})
const helia = await createHelia({libp2p, datastore, blockstore})

const orbitdb = await createOrbitDB({
   ipfs: helia,
   identity: libp2p.identity,
   storage: blockstore,
   directory: './orbitdb',
});

export const heliaStore = writable(helia)
export const orbitStore = writable(orbitdb)
// Local storage-backed UI state stores
export const showDBManager = localStorageStore('showDBManager', false);
export const showPeers = localStorageStore('showPeers', false);
export const showSettings = localStorageStore('showSettings', false);

// Sample data
const samplePosts: Post[] = [ ];

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

