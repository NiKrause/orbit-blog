import { expect } from 'chai';
import { createLibp2p } from 'libp2p';
import { multiaddr } from '@multiformats/multiaddr';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { yamux } from '@chainsafe/libp2p-yamux';
import { noise } from '@chainsafe/libp2p-noise';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify, identifyPush } from '@libp2p/identify';
import { webRTC, webRTCDirect } from '@libp2p/webrtc';
import 'dotenv/config'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
describe('Libp2p Connectivity Tests', function() {
  this.timeout(30000);
  
  let node;
  const seedNodesDev = process.env.VITE_SEED_NODES_DEV?.split(',') || [];
  const seedNodes = process.env.VITE_SEED_NODES?.split(',') || [];
  const pubsubTopic = process.env.VITE_P2P_PUPSUB || 'le-space._peer-discovery._p2p._pubsub';
  const pubsubTopicDev = process.env.VITE_P2P_PUPSUB_DEV || 'le-space._peer-discovery._p2p._pubsub';
  console.log(seedNodesDev, seedNodes, pubsubTopic, pubsubTopicDev);

  before(async () => {
    node = await createLibp2p({
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0', '/ip4/0.0.0.0/tcp/0/ws']
      },
      transports: [tcp(),webSockets(),webRTC(),webRTCDirect(),circuitRelayTransport()],
      streamMuxers: [yamux()],
      connectionEncrypters: [noise()],
      services: {
        pubsub: gossipsub(),
        // Explicitly enable publishing announcements so discovery works even with minimal peers.
        pubsubPeerDiscovery: pubsubPeerDiscovery({
          interval: 5000,
          topics: [pubsubTopicDev, pubsubTopic],
          listenOnly: false
        }),
        identify: identify(),
        identifyPush: identifyPush()
      }
    });
    console.log('node: ', node.peerId.toString());
    console.log('multiaddrs: ', node.getMultiaddrs().map((ma) => ma.toString()));
    await node.start();
  })

  after(async () => {
    if (node) {
      await node.stop();
    }
  });

  describe('Development Seed Nodes', () => {
    seedNodesDev.forEach((addr) => {
      if (!addr) return; 
      
      it(`should connect to ${addr}`, async () => {
        try {
          const ma = multiaddr(addr.trim());
          await node.dial(ma);
          const connection = node.getConnections(ma.getPeerId());
          expect(connection.length).to.be.greaterThan(0);
        } catch (err) {
          console.warn(`Failed to connect to ${addr}: ${err.message}`);
          throw err;
        }
      });
    });
  });

  describe('Production Seed Nodes', () => {
    seedNodes.forEach((addr) => {
      if (!addr) return; // Skip empty addresses
      
      it(`should connect to ${addr}`, async () => {
        try {
          const ma = multiaddr(addr.trim());
          await node.dial(ma);
          const connection = node.getConnections(ma.getPeerId());
          expect(connection.length).to.be.greaterThan(0);
        } catch (err) {
          console.warn(`Failed to connect to ${addr}: ${err.message}`);
          throw err;
        }
      });
    });
  });

  describe('Pubsub Peer Discovery', () => {
    it('should subscribe to development pubsub topic', async () => {
      console.log('Subscribing to development pubsub topic');
      console.log(node);
      await node.services.pubsub.subscribe(pubsubTopicDev);
      const topics = node.services.pubsub.getTopics();
      expect(topics).to.include(pubsubTopicDev);
    });

    it('should subscribe to production pubsub topic', async () => {
      await node.services.pubsub.subscribe(pubsubTopic);
      const topics = node.services.pubsub.getTopics();
      expect(topics).to.include(pubsubTopic);
    });

    it('should discover peers through pubsub', function(done) {
      this.timeout(60000); // Increase timeout for peer discovery

      if (seedNodesDev.length === 0 && seedNodes.length === 0) {
        this.skip();
      }
      
      let peerCount = 0;
      const checkPeers = () => {
        const peers = node.getPeers();
        if (peers.length > peerCount) {
          peerCount = peers.length;
          console.log(`Discovered ${peerCount} peers`);
          peers.forEach(peer => {
            console.log(`  - Peer ID: ${peer.toString()}`);
          });
          if (peerCount > 0) {
            done();
          }
        }
      };

      // Check for peers every 5 seconds
      const interval = setInterval(checkPeers, 5000);
      
      // Stop checking after timeout
      setTimeout(() => {
        clearInterval(interval);
        if (peerCount === 0) {
          done(new Error('No peers discovered within timeout'));
        }
      }, 55000);
    });
  });
}); 
