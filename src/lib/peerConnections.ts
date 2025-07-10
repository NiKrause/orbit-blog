import type { Libp2p } from 'libp2p';
import { writable } from 'svelte/store';
import { multiaddr } from '@multiformats/multiaddr';
import { info, debug, error } from './utils/logger.js'
// Store for connected peers count
export const connectedPeersCount = writable<number>(0);

/**
 * Setup event listeners for libp2p peer discovery and connections
 * @param libp2p The libp2p instance to set up listeners for
 */
export function  setupPeerEventListeners(libp2p: Libp2p) {
  if (!libp2p) return;

  // Update connected peers count initially
  updateConnectedPeersCount(libp2p);
  
  // Set up peer discovery listener
  libp2p.addEventListener('peer:discovery', async (evt) => {
    const peer = evt.detail;
    info(`Peer ${libp2p.peerId.toString()} discovered: ${peer.id.toString()}`);
    debug('peer.multiaddrs', peer);
    
    // Check if we're already connected to this peer
    const connections = libp2p.getConnections(peer.id);
    if (!connections || connections.length === 0) {
      info(`Dialing new peer: ${peer.id.toString()}`);
      
      try {
        // Dial the peer ID directly - libp2p will handle finding the best route
        debug('dialing peer ID', peer.id.toString());
        await libp2p.dial(peer.id);
        info('Successfully dialed peer:', peer.id.toString());
      } catch (_error) {
        error(`Failed to dial peer ${peer.id.toString()}:`, _error);
      }
    } else {
      info(`Already connected to peer: ${peer.id.toString()}`);
    }
  });

  // Set up peer connection listener
  libp2p.addEventListener('peer:connect', (evt) => {
    // debug('peer:connect event', evt.detail.toString());
    // info('Connected to %s', evt.detail.toString());
    updateConnectedPeersCount(libp2p);
  });
  
  // Set up peer disconnection listener
  libp2p.addEventListener('peer:disconnect', (evt) => {
    // debug('peer:disconnect event', evt.detail.toString());
    // info('Disconnected from %s', evt.detail.toString());
    updateConnectedPeersCount(libp2p);
  });
}

/**
 * Update the connected peers count store
 * @param libp2p The libp2p instance to count connections from
 */
function updateConnectedPeersCount(libp2p: Libp2p) {
  if (!libp2p) return;
  
  // Get all unique peer IDs we're connected to
  const peerIds = new Set();
  
  for (const connection of libp2p.getConnections()) {
    peerIds.add(connection.remotePeer.toString());
  }
  
  // Update the store with the count
  connectedPeersCount.set(peerIds.size);
} 