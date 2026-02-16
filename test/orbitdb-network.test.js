//add missing libs
import { createHelia } from 'helia';
import { createLibp2p } from 'libp2p';
import { LevelBlockstore } from 'blockstore-level';
import { LevelDatastore } from 'datastore-level';
import { createOrbitDB } from '@orbitdb/core';
import { join } from 'path';
import { tmpdir } from 'os';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { yamux } from '@chainsafe/libp2p-yamux';
import { noise } from '@chainsafe/libp2p-noise';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify, identifyPush } from '@libp2p/identify';
import { webRTC, webRTCDirect } from '@libp2p/webrtc';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { expect } from 'chai';


describe('OrbitDB Blog Data Access', function() {
    this.timeout(20000);
  
    let helia, orbitdb, settingsDb, postsDb, commentsDb, mediaDb;
  
    before(async () => {
      // Setup a fresh stack for this test
      const tempPath = join(tmpdir(), `orbitdb-blogtest-${Date.now()}`);
      const blockstore = new LevelBlockstore(join(tempPath, 'blocks'));
      const datastore = new LevelDatastore(join(tempPath, 'data'));
      const node = await createLibp2p({
        addresses: {
          // Use loopback to avoid environments that disallow binding to 0.0.0.0 (e.g. some sandboxes).
          listen: ['/ip4/127.0.0.1/tcp/0', '/ip4/127.0.0.1/tcp/0/ws']
        },
        // WebRTC binds UDP sockets and can be restricted in headless/sandboxed environments.
        transports: [tcp(), webSockets(), circuitRelayTransport()],
        streamMuxers: [yamux()],
        connectionEncrypters: [noise()],
        services: {
          pubsub: gossipsub(),
          pubsubPeerDiscovery: pubsubPeerDiscovery(),
          identify: identify(),
          identifyPush: identifyPush()
        }
      });
      helia = await createHelia({ libp2p: node, datastore, blockstore });
      orbitdb = await createOrbitDB({ ipfs: helia, directory: join(tempPath, 'orbitdb') });
  
      // Create settings DB
      settingsDb = await orbitdb.open('settings', {
        type: 'documents',
        create: true,
        overwrite: true,
        sync: false, // Disable sync for standalone test
        directory: join(tempPath, 'orbitdb/settings')
      });
      await settingsDb.put({ _id: 'blogName', value: 'Test Blog' });
      await settingsDb.put({ _id: 'blogDescription', value: 'A test blog for OrbitDB' });
  
      // Create posts DB
      postsDb = await orbitdb.open('posts', {
        type: 'documents',
        create: true,
        overwrite: true,
        sync: false, // Disable sync for standalone test
        directory: join(tempPath, 'orbitdb/posts')
      });
      // Add a few posts
      await postsDb.put({ _id: '1', title: 'First Post', date: '2023-01-01' });
      await postsDb.put({ _id: '2', title: 'Second Post', date: '2023-02-01' });
      await postsDb.put({ _id: '3', title: 'Latest Post', date: '2023-03-01' });
  
      // Store postsDB address in settings
      await settingsDb.put({ _id: 'postsDBAddress', value: postsDb.address.toString() });
  
      // Create comments DB
      commentsDb = await orbitdb.open('comments', {
        type: 'documents',
        create: true,
        overwrite: true,
        sync: false, // Disable sync for standalone test
        directory: join(tempPath, 'orbitdb/comments')
      });
      await settingsDb.put({ _id: 'commentsDBAddress', value: commentsDb.address.toString() });
  
      // Create media DB
      mediaDb = await orbitdb.open('media', {
        type: 'documents',
        create: true,
        overwrite: true,
        sync: false, // Disable sync for standalone test
        directory: join(tempPath, 'orbitdb/media')
      });
      await settingsDb.put({ _id: 'mediaDBAddress', value: mediaDb.address.toString() });
    });
  
    after(async () => {
      await settingsDb?.close();
      await postsDb?.close();
      await commentsDb?.close();
      await mediaDb?.close();
      await orbitdb?.stop();
      await helia?.libp2p?.stop();
    });
  
    it('should open settings DB and display blogName and blogDescription, and open posts/comments/media DBs', async () => {
      // Open settings DB and read blogName and blogDescription
      const blogNameEntry = await settingsDb.get('blogName');
      const blogDescriptionEntry = await settingsDb.get('blogDescription');
      console.log('Blog Name:', blogNameEntry?.value?.value);
      console.log('Blog Description:', blogDescriptionEntry?.value?.value);
  
      // Open posts DB from settings
      const postsAddressEntry = await settingsDb.get('postsDBAddress');
      expect(postsAddressEntry?.value?.value).to.be.a('string');
      const postsDb2 = await orbitdb.open(postsAddressEntry.value.value, { sync: false });
      const allPosts = await postsDb2.all();
      expect(allPosts.length).to.be.greaterThan(0);
  
      // Print date and title of the last post (by date)
      const sortedPosts = allPosts
        .map(entry => entry.value)
        .filter(post => post.date && post.title)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      const lastPost = sortedPosts[sortedPosts.length - 1];
      if (lastPost) {
        console.log('Last Post Title:', lastPost.title);
        console.log('Last Post Date:', lastPost.date);
      } else {
        console.log('No posts with date and title found.');
      }
  
      // Open comments DB from settings
      const commentsAddressEntry = await settingsDb.get('commentsDBAddress');
      expect(commentsAddressEntry?.value?.value).to.be.a('string');
      const commentsDb2 = await orbitdb.open(commentsAddressEntry.value.value, { sync: false });
      const allComments = await commentsDb2.all();
      console.log('Comments DB opened, count:', allComments.length);
  
      // Open media DB from settings
      const mediaAddressEntry = await settingsDb.get('mediaDBAddress');
      expect(mediaAddressEntry?.value?.value).to.be.a('string');
      const mediaDb2 = await orbitdb.open(mediaAddressEntry.value.value, { sync: false });
      const allMedia = await mediaDb2.all();
      console.log('Media DB opened, count:', allMedia.length);
    });
  });
