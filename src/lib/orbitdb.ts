// src/lib/orbitdb.ts

import { IPFSAccessController, createOrbitDB } from '@orbitdb/core';
import { libp2p, helia, orbitdb, posts, remoteDBs, settingsDB, postsDB, remoteDBsDatabase, identity, identities } from './store';
import { convertTo32BitSeed, generateMasterSeed } from './utils';
import createIdentityProvider from './identityProvider';
export async function getIdentity() {
  let seedPhrase = localStorage.getItem('seedPhrase');
  const masterSeed = generateMasterSeed(seedPhrase, "password")  
  const identitySeed = convertTo32BitSeed(masterSeed)
  const type = 'ed25519' 
  const idProvider = await createIdentityProvider(type, identitySeed, _helia)
  const _ourIdentity = idProvider.identity
  const _identities =  idProvider.identities  
  return { identity:_ourIdentity, identities:_identities }
}

/**
 * Initialize OrbitDB
 * @returns {Promise<{settingsDB: OrbitDB, postsDB: OrbitDB, remoteDBsDatabase: OrbitDB}>}
 */
export async function initializeDBs(identity, identities) {
  console.log('initializeDBs', identity, identities)
  try {
    console.log('identity', identity)
    // const __settingsDB = await _orbitdb.open('settings', {
    //     type: 'documents',
    //     create: true,
    //     overwrite: false,
    //     directory: './orbitdb/settings',
    //     identity: identity,
    //     identities: identities,
    //     AccessController: IPFSAccessController({
    //       write: ["*"],
    //     }),
    //   })
    console.log('settingsDB', __settingsDB)
    settingsDB.set(__settingsDB)

      // settings.set(newSettings)
    // postsDB.set(await _orbitdb.open('posts', {
    //   type: 'documents',
    //   create: true,
    //   overwrite: false,
    //   directory: './orbitdb/posts',
    //   identity: ret.identity,
    //   identities: ret.identities,
    //   AccessController: IPFSAccessController({
    //     write: [ret.identity.id],
    //   }),
    // }))


    //   remoteDBsDatabase.set(await _orbitdb.open('remote-dbs', {
    //   type: 'documents',
    //   create: true,
    //   overwrite: false,
    //   directory: './orbitdb/remote-dbs',
    //   identity: ret.identity,
    //   identities: ret.identities,
    //   AccessController: IPFSAccessController({
    //     write: [ret.identity.id],
    //   }),
    // }))

    // _remoteDBsDatabase.events.on('update', async (entry) => {
    //   console.log('Remote DBs update:', entry);
    //   const savedDBs = await _remoteDBsDatabase.all();
    //   remoteDBs.set(savedDBs.map(entry => entry.value));
    // });

      // const savedDBs = await _remoteDBsDatabase.all();
      // remoteDBs.set(savedDBs.map(entry => entry.value));
      // console.info('Remote DBs list:', _remoteDBs);

      // console.info('OrbitDB initialized successfully', _orbitdb);
      // console.info('Postsdb initialized successfully', _postsDB);
      // let currentPosts = await _postsDB.all();
      // console.log('Current posts:', currentPosts);

    // if (currentPosts.length === 0) {
    //   console.info('No existing posts found, initializing with sample data');
    //   for (const post of currentPosts) {
    //     console.log('Adding post:', post);
    //     const postWithId = {
    //       ...post,
    //       _id: post._id,
    //     };
    //     console.log('Adding post with _id:', postWithId);
    //     await _postsDB.put(postWithId);
    //   }
    // } else {
    //   console.info('Loading existing posts from OrbitDB');
    //   posts.set(currentPosts.map(entry => {
    //     const { _id, ...rest } = entry.value;
    //     return { ...rest, _id: _id };
    //   }));
    // }

    // _postsDB.events.on('update', async (entry) => {
    //   console.log('Database update:', entry);
    //   if (entry?.payload?.op === 'PUT') {
    //     const { _id, ...rest } = entry.payload.value;
    //     posts.update(current => [...current, { ...rest, _id: _id }]);
    //   } else if (entry?.payload?.op === 'DEL') {
    //     posts.update(current => current.filter(post => post._id !== entry.payload.key));
    //   }
    // });

        // Add event listeners to the libp2p instance after Helia is created
      // _helia.libp2p.addEventListener('peer:discovery', (evt) => {
      //     console.log('Peer discovered:', {
      //         id: evt.detail.id.toString(),
      //         multiaddrs: evt.detail.multiaddrs.toString(),
      //         protocols: evt.detail.protocols
      //     });
      // });
  
      // _helia.libp2p.addEventListener('peer:connect', (evt) => {
      //     console.log('Peer connected:', {
      //         id: evt.detail.toString(),
      //         // protocols: helia.libp2p.services.identify.getPeerProtocols(evt.detail)
      //     });
      // });
  
      // _helia.libp2p.addEventListener('peer:disconnect', (evt) => {
      //     console.log('Peer disconnected:', evt.detail.toString());
      // });

    return { identity, identities };
  } catch (error) {
    console.error('Error initializing OrbitDB:', error);
    throw error;
  }
}
let _libp2p
libp2p.subscribe(async (libp2p) => {
  _libp2p = libp2p
});
let _helia
helia.subscribe(async (helia) => {
  _helia = helia
});
let _orbitdb
orbitdb.subscribe(async (orbitdb) => {
  _orbitdb = orbitdb
});

let _settingsDB
settingsDB.subscribe(async (settingsDB) => {
  console.log('subscribed to settingsDB', settingsDB)
  _settingsDB = settingsDB
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

let _identity
identity.subscribe(async (identity) => {
  _identity = identity
});

let _identities
identities.subscribe(async (identities) => {
  _identities = identities
});