import { expect } from 'chai';
import { createLibp2pConfig } from '../dist/relay/config/libp2p.js';
import { createLibp2p } from 'libp2p';
import { multiaddr } from '@multiformats/multiaddr';
import { keys } from '@libp2p/crypto';
import 'dotenv/config'

// env.config();

describe('Libp2p Connectivity Tests', function() {
  // Increase timeout for connection attempts
  this.timeout(30000);
  
  let node;
  const seedNodesDev = process.env.VITE_SEED_NODES_DEV?.split(',') || [];
  const seedNodes = process.env.VITE_SEED_NODES?.split(',') || [];
  const pubsubTopic = process.env.VITE_P2P_PUPSUB || 'le-space._peer-discovery._p2p._pubsub';
  const pubsubTopicDev = process.env.VITE_P2P_PUPSUB_DEV || 'le-space._peer-discovery._p2p._pubsub';
  console.log(seedNodesDev, seedNodes, pubsubTopic, pubsubTopicDev);
  before(async () => {
    // Create a new Ed25519 key pair
    const keyPair = await keys.generateKeyPair('Ed25519');
    
    // Create libp2p node with our config
    const config = createLibp2pConfig(keyPair.privateKey);
    node = await createLibp2p(config);
    
    // Start the node
    await node.start();
  });

  after(async () => {
    // Clean up
    if (node) {
      await node.stop();
    }
  });

  describe('Development Seed Nodes', () => {
    seedNodesDev.forEach((addr) => {
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

  describe.skip('Production Seed Nodes', () => {
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
      await node.pubsub.subscribe(pubsubTopicDev);
      const topics = node.pubsub.getTopics();
      expect(topics).to.include(pubsubTopicDev);
    });

    it('should subscribe to production pubsub topic', async () => {
      await node.pubsub.subscribe(pubsubTopic);
      const topics = node.pubsub.getTopics();
      expect(topics).to.include(pubsubTopic);
    });

    it('should discover peers through pubsub', function(done) {
      this.timeout(60000); // Increase timeout for peer discovery
      
      let peerCount = 0;
      const checkPeers = () => {
        const peers = node.getPeers();
        if (peers.length > peerCount) {
          peerCount = peers.length;
          console.log(`Discovered ${peerCount} peers`);
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