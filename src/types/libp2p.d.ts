declare module 'libp2p/dist/src/components.js' {
  export interface Components {
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
}

declare module '@libp2p/interface' {
  export interface Libp2pOptions {
    privateKey?: any;
    addresses?: {
      listen: string[];
    };
    transports?: any[];
    connectionEncrypters?: any[];
    streamMuxers?: any[];
    connectionManager?: any;
    connectionGater?: any;
    peerDiscovery?: any[];
    services?: Record<string, any>;
    metrics?: (components: any) => any;
  }
  
  export interface Metrics {
    // Add metrics interface properties as needed
  }
  
  export interface PeerId {
    // Add PeerId interface properties as needed
  }
  
  export interface PrivateKey {
    // Add PrivateKey interface properties as needed
  }
} 