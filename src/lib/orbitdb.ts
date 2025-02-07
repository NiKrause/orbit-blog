// src/lib/orbitdb.ts

import { IPFSAccessController } from '@orbitdb/core';
import { orbitStore, settings, posts, remoteDBs, settingsDB, postsDB, remoteDBsDatabase } from './store';

let _orbitStore
orbitStore.subscribe(async (orbitStore) => {
  _orbitStore = orbitStore
});

let _settingsDB
settingsDB.subscribe(async (settingsDB) => {
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

export async function initializeOrbitDB() {
  try {

    settingsDB.set(await _orbitStore.open('settings', {
      type: 'documents',
      create: true,
      overwrite: false,
      directory: './orbitdb/settings',
      AccessController: IPFSAccessController({
        write: [_orbitStore.identity.id],
      }),
    }))
    _settingsDB.put({_id: 'blogName', value: 'Test Blog'})

    const __settings = await _remoteDBsDatabase.all();
    remoteDBs.set(__settings.map(entry => entry.value));

    console.info('Remote DBs list:', _remoteDBs);
    postsDB.set(await _orbitStore.open('posts', {
      type: 'documents',
      create: true,
      overwrite: false,
      directory: './orbitdb/posts',
      AccessController: IPFSAccessController({
        write: [_orbitStore.identity.id],
      }),
    }))

    remoteDBsDatabase.set(await _orbitStore.open('remote-dbs', {
      type: 'documents',
      create: true,
      overwrite: false,
      directory: './orbitdb/remote-dbs',
      AccessController: IPFSAccessController({
        write: [_orbitStore.identity.id],
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