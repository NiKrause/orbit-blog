import type { Libp2p } from 'libp2p';
import { writable } from 'svelte/store';
import { info, debug, error } from './utils/logger.js'
// Store for connected peers count
export const connectedPeersCount = writable<number>(0);

function getAddressStrings(multiaddrs: any): string[] {
  if (!Array.isArray(multiaddrs)) return [];
  return multiaddrs.map((addr) => addr?.toString?.() ?? '').filter(Boolean);
}

function getConnectionsForPeer(libp2p: Libp2p, peerId: string) {
  return libp2p
    .getConnections()
    .filter((connection) => connection.remotePeer.toString() === peerId);
}

function hasDirectConnection(connections: ReturnType<typeof getConnectionsForPeer>) {
  return connections.some((connection) => {
    const addr = connection.remoteAddr?.toString() ?? '';
    return !addr.includes('/p2p-circuit');
  });
}

function hasOnlyRelayConnections(connections: ReturnType<typeof getConnectionsForPeer>) {
  return connections.length > 0 && connections.every((connection) => {
    const addr = connection.remoteAddr?.toString() ?? '';
    return addr.includes('/p2p-circuit');
  });
}

function getDialableMultiaddrs(multiaddrs: any): any[] {
  if (!Array.isArray(multiaddrs)) return [];
  return multiaddrs.filter((addr) => {
    const value = addr?.toString?.() ?? '';
    return (
      value.includes('/webrtc') ||
      value.includes('/webtransport') ||
      value.includes('/ws') ||
      value.includes('/p2p-circuit')
    );
  });
}

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
    
    const peerId = peer.id.toString();
    const connections = getConnectionsForPeer(libp2p, peerId);
    if (hasDirectConnection(connections)) {
      info(`Already have direct connection to peer: ${peer.id.toString()}`);
      return;
    }

    const dialableMultiaddrs = getDialableMultiaddrs(peer.multiaddrs);
    const discoveredAddresses = getAddressStrings(dialableMultiaddrs);

    if (hasOnlyRelayConnections(connections)) {
      info(`Peer ${peer.id.toString()} is relay-connected only; attempting upgrade dial`);
    } else {
      info(`Dialing discovered peer: ${peer.id.toString()}`);
    }

    try {
      if (dialableMultiaddrs.length > 0) {
        debug('dialing peer multiaddrs', discoveredAddresses);
        await libp2p.dial(dialableMultiaddrs);
        info(`Successfully dialed peer multiaddrs: ${peer.id.toString()}`);
        return;
      }
    } catch (_error) {
      error(`Failed to dial multiaddrs for peer ${peer.id.toString()}:`, _error);
    }

    try {
      debug('dialing peer ID', peerId);
      await libp2p.dial(peer.id);
      info(`Successfully dialed peer ID: ${peer.id.toString()}`);
    } catch (_error) {
      error(`Failed to dial peer ${peer.id.toString()}:`, _error);
    }
  });

  // Set up peer connection listener
  libp2p.addEventListener('peer:connect', (evt) => {
    updateConnectedPeersCount(libp2p);
  });
  
  // Set up peer disconnection listener
  libp2p.addEventListener('peer:disconnect', (_evt) => {
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
