import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { noise } from "@chainsafe/libp2p-noise";
import { bootstrap } from '@libp2p/bootstrap';
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2';
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify, identifyPush } from "@libp2p/identify";
import { autoNAT } from "@libp2p/autonat";
import { dcutr } from '@libp2p/dcutr';
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { ping } from '@libp2p/ping';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { BROWSER, DEV } from 'esm-env';
/*import { FaultTolerance } from '@libp2p/interface-transport'*/
// Define environment variables with fallbacks
const VITE_SEED_NODES_DEV = process.env.VITE_SEED_NODES_DEV || '';
const VITE_SEED_NODES = process.env.VITE_SEED_NODES || '';
export const multiaddrs = DEV
    ? VITE_SEED_NODES_DEV.replace('\n', '').split(',')
    : VITE_SEED_NODES.replace('\n', '').split(',');
// Define environment variables with fallbacks
const VITE_P2P_PUPSUB_DEV = process.env.VITE_P2P_PUPSUB_DEV || '';
const VITE_P2P_PUPSUB = process.env.VITE_P2P_PUPSUB || '';
const pubSubPeerDiscoveryTopics = DEV
    ? VITE_P2P_PUPSUB_DEV.replace('\n', '').split(',')
    : VITE_P2P_PUPSUB.replace('\n', '').split(',');
export const bootstrapConfig = { list: multiaddrs };
export const libp2pOptions = {
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
        webSockets({ filter: filters.all }),
        webRTC({
            rtcConfiguration: {
                iceServers: [{
                        urls: [
                            'stun:stun.l.google.com:19302',
                            'stun:global.stun.twilio.com:3478'
                        ]
                    }]
            }
        }),
        webRTCDirect(),
        circuitRelayTransport({ discoverRelays: 1 }) // TODO: Update with correct type after checking latest @libp2p/circuit-relay-v2 types
        // kadDHT({}),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [
        yamux(),
    ],
    connectionGater: {
        denyDialMultiaddr: () => {
            return false;
        }
    },
    peerDiscovery: [
        bootstrap(bootstrapConfig),
        pubsubPeerDiscovery({
            interval: 10000,
            topics: pubSubPeerDiscoveryTopics, // defaults to ['_peer-discovery._p2p._pubsub']
            listenOnly: false,
        })
    ],
    services: {
        identify: identify(),
        identifyPush: identifyPush(),
        ping: ping(),
        autoNAT: autoNAT(),
        dcutr: dcutr(),
        pubsub: gossipsub({ allowPublishToZeroTopicPeers: true, canRelayMessage: true })
    },
    connectionManager: {
        autoDial: true,
        minConnections: 3,
    },
};
