import { webSockets } from "@libp2p/websockets";
import * as filters from "@libp2p/websockets/filters";
import { webRTC, webRTCDirect } from "@libp2p/webrtc";
import { webTransport } from "@libp2p/webtransport";
import { noise } from "@chainsafe/libp2p-noise";
import { bootstrap } from '@libp2p/bootstrap'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify"
import { autoNAT } from "@libp2p/autonat"
import { dcutr } from '@libp2p/dcutr'
import { gossipsub } from "@chainsafe/libp2p-gossipsub"
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery'
/*import { FaultTolerance } from '@libp2p/interface-transport'*/

const multiaddrs =
    import.meta.env.MODE === 'development'
        ? import.meta.env.VITE_SEED_NODES_DEV.replace('\n','').split(',')
        : import.meta.env.VITE_SEED_NODES.replace('\n','').split(',')


const pubSubPeerDiscoveryTopics =
	import.meta.env.MODE === 'development'
		? import.meta.env.VITE_P2P_PUPSUB_DEV.replace('\n','').split(',')
        : import.meta.env.VITE_P2P_PUPSUB.replace('\n','').split(',')

export const bootstrapConfig = {list: multiaddrs};

export const getLibp2pOptions = (useBootstrap = true) => ({
    addresses: {
        // swarm: [address],
        listen: [
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
        webRTCDirect({
            rtcConfiguration: {
                iceServers:[{
                    urls: [
                        'stun:stun.l.google.com:19302',
                        'stun:global.stun.twilio.com:3478'
                    ]
                }]
            }
        }),
        circuitRelayTransport({ discoverRelays: 1 })
    ],
    connectionEncryption: [noise()],
/*    transportManager: {
        faultTolerance: FaultTolerance.NO_FATAL
    },*/
    streamMuxers: [
        yamux(),
    ],
    connectionGater: {
        denyDialMultiaddr: () => {
            return false
        }
    },
    peerDiscovery: [
        ...(useBootstrap ? [bootstrap(bootstrapConfig)] : []),
        pubsubPeerDiscovery({
            interval: 10000,
            topics: pubSubPeerDiscoveryTopics, // defaults to ['_peer-discovery._p2p._pubsub']
            listenOnly: false
        })
    ],
    services: {
/*        ping: ping({
            protocolPrefix: 'dContact', // default
        }),*/
        identify: identify(),
        autoNAT: autoNAT(),
        dcutr: dcutr(),
        pubsub: gossipsub({ allowPublishToZeroTopicPeers: true, canRelayMessage: true }),
/*        aminoDHT: kadDHT({
            protocol: '/ipfs/kad/1.0.0',
            peerInfoMapper: removePrivateAddressesMapper
        })*/
        // dht: kadDHT({
        //     protocolPrefix: "/svelte-pubsub",
        //     maxInboundStreams: 5000,
        //     maxOutboundStreams: 5000,
        //     clientMode: true,
        // })
    }
})

export const Libp2pOptions = getLibp2pOptions(true);