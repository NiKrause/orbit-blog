import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
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
/*import { FaultTolerance } from '@libp2p/interface-transport'*/

export const multiaddrs =
    import.meta.env.MODE === 'development'
        ? import.meta.env.VITE_SEED_NODES_DEV.replace('\n','').split(',')
        : import.meta.env.VITE_SEED_NODES.replace('\n','').split(',')


const pubSubPeerDiscoveryTopics =
	import.meta.env.MODE === 'development'
		? import.meta.env.VITE_P2P_PUPSUB_DEV.replace('\n','').split(',')
        : import.meta.env.VITE_P2P_PUPSUB.replace('\n','').split(',')


export const bootstrapConfig = {list: multiaddrs};
export const Libp2pOptions = {
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
        webSockets({filter: filters.all}),
        webRTC({
             rtcConfiguration: {
                 iceServers:[{
                     urls: [
                         'stun:stun.l.google.com:19302',
                         'stun:global.stun.twilio.com:3478'
                     ]
                 }]
             }
         }),
        webRTCDirect(),
        circuitRelayTransport({ discoverRelays: 1 })
        // kadDHT({}),
    ],
    connectionEncrypters: [noise()],
    streamMuxers: [
        yamux(),
    ],
    connectionGater: {
        denyDialMultiaddr: () => {
            return false
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
}