import { webSockets } from "@libp2p/websockets";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { noise } from "@chainsafe/libp2p-noise";
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify, identifyPush } from "@libp2p/identify"
import { autoNAT } from "@libp2p/autonat"
import { dcutr } from '@libp2p/dcutr'
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { ping } from '@libp2p/ping'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { multiaddr } from '@multiformats/multiaddr'
import { bootstrap } from '@libp2p/bootstrap'
import { createLogger } from './utils/logger.js'

const log = createLogger('p2p')

let VITE_SEED_NODES = (import.meta.env.VITE_SEED_NODES || '').replace('\n','').split(',').filter(Boolean)
let VITE_SEED_NODES_DEV = (import.meta.env.VITE_SEED_NODES_DEV || '').replace('\n','').split(',').filter(Boolean)
let MODE = import.meta.env.VITE_MODE //|| 'development';
let VITE_P2P_PUPSUB_DEV = (import.meta.env.VITE_P2P_PUPSUB_DEV || '').replace('\n','').split(',').filter(Boolean);
let VITE_P2P_PUPSUB = (import.meta.env.VITE_P2P_PUPSUB || '').replace('\n','').split(',').filter(Boolean);

let _VITE_SEED_NODES_DEV = process.env.VITE_SEED_NODES_DEV || '';
let _VITE_SEED_NODES = process.env.VITE_SEED_NODES || '';
let _MODE = process.env.VITE_MODE || '';

let _VITE_P2P_PUPSUB_DEV = process.env.VITE_P2P_PUPSUB_DEV || '';
let _VITE_P2P_PUPSUB = process.env.VITE_P2P_PUPSUB || '';

if(_VITE_SEED_NODES || _VITE_SEED_NODES_DEV) {
    VITE_SEED_NODES = _VITE_SEED_NODES
    VITE_SEED_NODES_DEV = _VITE_SEED_NODES_DEV
    VITE_P2P_PUPSUB = _VITE_P2P_PUPSUB
    VITE_P2P_PUPSUB_DEV = _VITE_P2P_PUPSUB_DEV
}
if (import.meta.env.DEV) {
    MODE = 'development'
}
export let multiaddrs = MODE === 'development'?VITE_SEED_NODES_DEV:VITE_SEED_NODES
log.debug('MODE === development', MODE === 'development')
log.debug('VITE_SEED_NODES_DEV', VITE_SEED_NODES_DEV)
log.debug('VITE_SEED_NODES', VITE_SEED_NODES)
let pubSubPeerDiscoveryTopics = MODE === 'development'?VITE_P2P_PUPSUB_DEV:VITE_P2P_PUPSUB
log.debug('pubSubPeerDiscoveryTopics', pubSubPeerDiscoveryTopics)
log.debug('seed nodes multiaddrs', multiaddrs)
export const bootstrapConfig = { 
    list: multiaddrs.filter(addr => {
        try {
            multiaddr(addr);
            return true;
        } catch (e) {
            log.warn(`Invalid multiaddr filtered out: ${addr}`);
            return false;
        }
    })
};
import type { Libp2pOptions } from '@libp2p/interface'
export const libp2pOptions: Libp2pOptions = {
    addresses: {
        listen: [
            '/p2p-circuit',
            "/webrtc",
            "/webtransport",
            "/wss", "/ws",
        ]
    },
    transports: [
        webTransport(),
        webSockets(),
        webRTC({
            rtcConfiguration: {
                iceServers: [
                    { urls: ['stun:stun.l.google.com:19302'] },
                    { urls: ['stun:stun1.l.google.com:19302'] }
                ]
            }
        }),
        webRTCDirect(),
        circuitRelayTransport({
            reservationCompletionTimeout: 20000 // 20 seconds
          })
    ],
    connectionEncrypters: [noise()],
    
    streamMuxers: [
        yamux(),
    ],
    connectionManager: {
        inboundStreamProtocolNegotiationTimeout: 10000,
        inboundUpgradeTimeout: 10000,
        outboundStreamProtocolNegotiationTimeout: 10000,
        outboundUpgradeTimeout: 1000,
    },
    connectionGater: {
        denyDialMultiaddr: () => false
    },
    peerDiscovery: [
        // bootstrap({
        //     list: [
        //         '/ip4/157.180.21.20/tcp/9092/tls/sni/157-180-21-20.k51qzi5uqu5dk1lwtlmq5a5qzq7gpzbb5985azlkjop6atkbc03v3bwpqc7v5v.libp2p.direct/ws/p2p/12D3KooWLFBBsPa2eZEVV5T7cJH9kAQCFqArgA8yVCSkHoc5reJn',
        //       // a list of bootstrap peer multiaddrs to connect to on node startup
        //     //   '/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
        //     //   '/dnsaddr/bootstrap.libp2p.io/ipfs/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
        //     //   '/dnsaddr/bootstrap.libp2p.io/ipfs/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa'
        //     ]
        //   }),
        bootstrap(bootstrapConfig),
        pubsubPeerDiscovery({
            interval: 10000,
            topics: pubSubPeerDiscoveryTopics,
            listenOnly: false,
        })
    ],
    services: {
        identify: identify(),
        identifyPush: identifyPush(),
        ping: ping(),
        // autoNAT: autoNAT(), not necessary in browsers because no tcp etc.
        dcutr: dcutr(),
        pubsub: gossipsub({ 
            allowPublishToZeroTopicPeers: true
        }),
        bootstrap: bootstrap(bootstrapConfig)
    }
}

export async function validateMultiaddrs(
    addrs: string[], 
    libp2p?: any
): Promise<{ 
    valid: string[], 
    invalid: string[], 
    dialable?: string[], 
    undialable?: string[] 
}> {
    const valid: string[] = [];
    const invalid: string[] = [];
    const dialable: string[] = [];
    const undialable: string[] = [];
    
    for (const addr of addrs) {
        try {
            // Try to create a multiaddr object - this will throw if invalid
            const ma = multiaddr(addr);
            valid.push(addr);
            
            // Only attempt dialing if libp2p instance is provided
            if (libp2p) {
                try {
                    await libp2p.dial(ma);
                    dialable.push(addr);
                } catch (error) {
                    undialable.push(addr);
                    log.error(`Failed to dial ${addr}:`, error);
                }
            }
        } catch (error) {
            invalid.push(addr);
            log.error(`Invalid multiaddr ${addr}:`, error);
        }
    }
    
    // Only include dialability results if libp2p was provided
    return libp2p 
        ? { valid, invalid, dialable, undialable }
        : { valid, invalid };
}

// Test your multiaddrs
(async () => {
    const result = await validateMultiaddrs(multiaddrs);
    log.debug('Valid multiaddrs:', result.valid);
    log.debug('Invalid multiaddrs:', result.invalid);
})();
