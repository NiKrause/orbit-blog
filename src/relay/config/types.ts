import type { Components as Libp2pComponents } from 'libp2p/dist/src/components.js'

export interface Components extends Libp2pComponents {
  keychain: any;
  autoTLS: any;
  pubsub: any;
  metrics: any;
  peerId: any;
  peerStore: any;
  connectionManager: any;
  transportManager: any;
  streamMuxer: any;
  connectionEncrypter: any;
  registrar: any;
  upgrader: any;
} 