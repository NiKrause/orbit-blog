import { webSockets } from "@libp2p/websockets";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { noise } from "@chainsafe/libp2p-noise";
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify, identifyPush } from "@libp2p/identify"
import { autoNAT } from "@libp2p/autonat"
import { dcutr } from '@libp2p/dcutr'
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { ping } from '@libp2p/ping'
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
import { multiaddr } from '@multiformats/multiaddr'

let VITE_SEED_NODES = import.meta.env.VITE_SEED_NODES.replace('\n','').split(',')
let VITE_SEED_NODES_DEV = import.meta.env.VITE_SEED_NODES_DEV.replace('\n','').split(',')
let MODE = import.meta.env.VITE_MODE //|| 'development';
let VITE_P2P_PUPSUB_DEV = import.meta.env.VITE_P2P_PUPSUB_DEV.replace('\n','').split(',') || '';
let VITE_P2P_PUPSUB = import.meta.env.VITE_P2P_PUPSUB.replace('\n','').split(',') || '';

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
MODE = _MODE?_MODE:MODE

console.log('MODE', MODE)
export let multiaddrs = MODE === 'development'?VITE_SEED_NODES_DEV:VITE_SEED_NODES
console.log('MODE multiaddrs', multiaddrs)
console.log('MODE === development', MODE === 'development')
console.log('VITE_SEED_NODES_DEV', VITE_SEED_NODES_DEV)
console.log('VITE_SEED_NODES', VITE_SEED_NODES)
let pubSubPeerDiscoveryTopics = MODE === 'development'?VITE_P2P_PUPSUB_DEV:VITE_P2P_PUPSUB
console.log('pubSubPeerDiscoveryTopics', pubSubPeerDiscoveryTopics)
console.log('seed nodes multiaddrs', multiaddrs)
export const bootstrapConfig = { list: multiaddrs };
import type { Libp2pOptions } from '@libp2p/interface'
console.log("bootstrapConfig",bootstrapConfig)
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
        webRTC(),
        webRTCDirect(),
        circuitRelayTransport()
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [
        yamux(),
    ],
    connectionManager: {
        inboundStreamProtocolNegotiationTimeout: 1e4,
        inboundUpgradeTimeout: 1e4,
        outboundStreamProtocolNegotiationTimeout: 1e4,
        outboundUpgradeTimeout: 1e4,
    },
    connectionGater: {
        denyDialMultiaddr: () => {
            return false
        }
    },
    peerDiscovery: [
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
        autoNAT: autoNAT(),
        dcutr: dcutr(),
        pubsub: gossipsub({ 
            allowPublishToZeroTopicPeers: true
        }),
        // bootstrap: bootstrap(bootstrapConfig)
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
                    console.error(`Failed to dial ${addr}:`, error);
                }
            }
        } catch (error) {
            invalid.push(addr);
            console.error(`Invalid multiaddr ${addr}:`, error);
        }
    }
    
    // Only include dialability results if libp2p was provided
    return libp2p 
        ? { valid, invalid, dialable, undialable }
        : { valid, invalid };
}

// Test your multiaddrs
// (async () => {
//     const result = await validateMultiaddrs(multiaddrs);
//     console.log('Valid multiaddrs:', result.valid);
//     console.log('Invalid multiaddrs:', result.invalid);
// })();
