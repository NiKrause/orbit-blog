// src/lib/orbitdb.ts
import { generateMnemonic } from 'bip39'
import { IPFSAccessController } from '@orbitdb/core';
import { heliaStore, orbitStore, settings, posts, remoteDBs, settingsDB, postsDB, remoteDBsDatabase } from './store';
import { convertTo32BitSeed, generateMasterSeed } from './utils';
import createIdentityProvider from './identityProvider';

/**
 * Initialize OrbitDB
 * @returns {Promise<{settingsDB: OrbitDB, postsDB: OrbitDB, remoteDBsDatabase: OrbitDB}>}
 */
export async function initializeOrbitDB() {
  try {
      const masterSeed = generateMasterSeed(_settings.seedPhrase, "password")  
      const identitySeed = convertTo32BitSeed(masterSeed)
      const type = 'ed25519' 
      const idProvider = await createIdentityProvider(type, identitySeed, _heliaStore)
      const _ourIdentity = idProvider.identity
      const _identities =  idProvider.identities

      console.log('initializing settingsDB') 
      settingsDB.set(await _orbitStore.open('settings', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/settings',
        identity: _ourIdentity,
        identities: _identities,
        AccessController: IPFSAccessController({
          write: ["*"],
        }),
      }))
      console.log('settingsDB initialized', _settingsDB)
      // _settingsDB.drop()
      
      const __settings = await _settingsDB.all();
      console.log('__settings',__settings) 
      const currentSettings = _settings; // Get the current settings

      // Map the entries from OrbitDB to a settings object
      const newSettings = __settings.reduce((acc, entry) => {
        acc[entry._id] = entry.value;
        return acc;
      }, {});

      // Preserve the existing seed phrase if it exists
      if (currentSettings.seedPhrase) {
        newSettings.seedPhrase = currentSettings.seedPhrase;
      }

      settings.set(newSettings);

      if (newSettings.seedPhrase) {
        console.log('seedPhrase found, using existing one');
      }
      else {
        console.log('No seed phrase found, generating new one');
        updateSettings({ seedPhrase: generateMnemonic()})  // settings.seedPhrase = generateMnemonic(); //256 (will be 24 words)
      }

      if(!_settings.blogName) updateSettings({ blogName: 'Orbit Blog' });
      if(!_settings.blogDescription) updateSettings({ blogDescription: 'A peer-to-peer blog system on IPFS running a Svelte and OrbitDB' });
      updateSettings({did: _ourIdentity.id}) 
      
      postsDB.set(await _orbitStore.open('posts', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/posts',
        identity: _ourIdentity,
        identities: _identities,
        AccessController: IPFSAccessController({
          write: [_ourIdentity.id],
        }),
      }))


      remoteDBsDatabase.set(await _orbitStore.open('remote-dbs', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/remote-dbs',
        identity: _ourIdentity,
        identities: _identities,
        AccessController: IPFSAccessController({
          write: [_ourIdentity.id],
        }),
      }))

      _remoteDBsDatabase.events.on('update', async (entry) => {
        console.log('Remote DBs update:', entry);
        const savedDBs = await _remoteDBsDatabase.all();
        remoteDBs.set(savedDBs.map(entry => entry.value));
      });

      const savedDBs = await _remoteDBsDatabase.all();
      remoteDBs.set(savedDBs.map(entry => entry.value));
      console.info('Remote DBs list:', _remoteDBs);

      console.info('OrbitDB initialized successfully', _orbitStore);
      console.info('Postsdb initialized successfully', _postsDB);
      let currentPosts = await _postsDB.all();
      console.log('Current posts:', currentPosts);

    if (currentPosts.length === 0) {
      console.info('No existing posts found, initializing with sample data');
      for (const post of currentPosts) {
        console.log('Adding post:', post);
        const postWithId = {
          ...post,
          _id: post._id,
        };
        console.log('Adding post with _id:', postWithId);
        await _postsDB.put(postWithId);
      }
    } else {
      console.info('Loading existing posts from OrbitDB');
      posts.set(currentPosts.map(entry => {
        const { _id, ...rest } = entry.value;
        return { ...rest, _id: _id };
      }));
    }

    _postsDB.events.on('update', async (entry) => {
      console.log('Database update:', entry);
      if (entry?.payload?.op === 'PUT') {
        const { _id, ...rest } = entry.payload.value;
        posts.update(current => [...current, { ...rest, _id: _id }]);
      } else if (entry?.payload?.op === 'DEL') {
        posts.update(current => current.filter(post => post._id !== entry.payload.key));
      }
    });

    return { settingsDB: _settingsDB, postsDB: _postsDB, remoteDBsDatabase: _remoteDBsDatabase };
  } catch (error) {
    console.error('Error initializing OrbitDB:', error);
    throw error;
  }
}

let _heliaStore
heliaStore.subscribe(async (heliaStore) => {
  _heliaStore = heliaStore
});
let _orbitStore
orbitStore.subscribe(async (orbitStore) => {
  _orbitStore = orbitStore
});

let _settingsDB
settingsDB.subscribe(async (settingsDB) => {
  console.log('subscribed to settingsDB', settingsDB)
  _settingsDB = settingsDB
});
let _settings
settings.subscribe(async (settings) => {
  _settings = settings
});
let _posts
posts.subscribe(async (posts) => {
  _posts = posts
});
let _postsDB
postsDB.subscribe(async (postsDB) => {
  _postsDB = postsDB
});

let _remoteDBs
remoteDBs.subscribe(async (remoteDBs) => {
  _remoteDBs = remoteDBs
});

let _remoteDBsDatabase
remoteDBsDatabase.subscribe(async (remoteDBsDatabase) => {
  _remoteDBsDatabase = remoteDBsDatabase
});

export function updateSettings(newSettings: Partial<typeof _settings>) {
  settings.update(currentSettings => ({
    ...currentSettings,
    ...newSettings
  }));
}