import type { Libp2p } from 'libp2p';
export declare const connectedPeersCount: import("svelte/store").Writable<number>;
/**
 * Setup event listeners for libp2p peer discovery and connections
 * @param libp2p The libp2p instance to set up listeners for
 */
export declare function setupPeerEventListeners(libp2p: Libp2p): void;
//# sourceMappingURL=peerConnections.d.ts.map