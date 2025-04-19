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

let VITE_SEED_NODES = import.meta.env.VITE_SEED_NODES.replace('\n','').split(',')
let VITE_SEED_NODES_DEV = import.meta.env.VITE_SEED_NODES_DEV.replace('\n','').split(',')
let MODE = import.meta.env.MODE
let VITE_P2P_PUPSUB_DEV = import.meta.env.VITE_P2P_PUPSUB_DEV.replace('\n','').split(',') || '';
let VITE_P2P_PUPSUB = import.meta.env.VITE_P2P_PUPSUB.replace('\n','').split(',') || '';

let _VITE_SEED_NODES_DEV = process.env.VITE_SEED_NODES_DEV || '';
let _VITE_SEED_NODES = process.env.VITE_SEED_NODES || '';
let _MODE = process.env.MODE
let _VITE_P2P_PUPSUB_DEV = process.env.VITE_P2P_PUPSUB_DEV || '';
let _VITE_P2P_PUPSUB = process.env.VITE_P2P_PUPSUB || '';

if(_VITE_SEED_NODES || _VITE_SEED_NODES_DEV || _MODE) {
    VITE_SEED_NODES = _VITE_SEED_NODES
    VITE_SEED_NODES_DEV = _VITE_SEED_NODES_DEV
    MODE = _MODE
    VITE_P2P_PUPSUB = _VITE_P2P_PUPSUB
    VITE_P2P_PUPSUB_DEV = _VITE_P2P_PUPSUB_DEV
}

export let multiaddrs = MODE === 'development'?VITE_SEED_NODES_DEV:VITE_SEED_NODES
let pubSubPeerDiscoveryTopics = MODE === 'development'?VITE_P2P_PUPSUB_DEV:VITE_P2P_PUPSUB

export const bootstrapConfig = {list: multiaddrs};
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
    }
}
