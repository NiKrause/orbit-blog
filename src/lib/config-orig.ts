// // import { noise } from '@chainsafe/libp2p-noise'
// import { bootstrap } from '@libp2p/bootstrap'
// import { yamux } from '@chainsafe/libp2p-yamux'
// import { gossipsub } from '@chainsafe/libp2p-gossipsub'
// import { identify } from '@libp2p/identify'
// import { webSockets } from "@libp2p/websockets";
// import * as filters from "@libp2p/websockets/filters";
// import { webTransport } from "@libp2p/webtransport";
// import { webRTC, webRTCDirect } from '@libp2p/webrtc'
// import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
// import { autoNAT } from '@libp2p/autonat'
// import { dcutr } from '@libp2p/dcutr'
// import { ping } from '@libp2p/ping'
// import { pubsubPeerDiscovery} from "@libp2p/pubsub-peer-discovery";

// const pubsubPeerDiscoveryTopics = import.meta.env.VITE_P2P_PUPSUB || 'dcontact._peer-discovery._p2p._pubsub' //'doichain._peer-discovery._p2p._pubsub'

// export const Libp2pOptions = {
//     addresses: {
//       listen: [
//           // '/p2p-circuit',
//           "/webrtc",
//           "/webtransport",
//           "/wss", "/ws",
//       ]
//   },
//   transports: [
//     webSockets({filter: filters.all}),
//     webRTC(),
//     circuitRelayTransport({
//       discoverRelays: 1
//     }),
//   webRTCDirect(),
//   webTransport(),
//   ],
//   connectionEncryption: [noise()],
//   streamMuxers: [yamux()],
//   peerDiscovery: [
//     bootstrap({ list: 
//       ['/dns4/ipfs.le-space.de/tcp/444/wss/p2p/12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE'
// 			// ['/ip4/192.168.165.177/tcp/12345/ws/p2p/12D3KooWAJjbRkp8FPF5MKgMU53aUTxWkqvDrs4zc1VMbwRwfsbE'
// 			// '/ip4/65.21.180.203/udp/4001/quic-v1/webtransport/certhash/uEiAB3gvBckUxmzKY7lz-5jkDdQ-2TWqJL2SY-bP8a4d20Q/certhash/uEiA3lYvwafRQAItGYKvZBfMdxqC55D6MCQXn_VoPYzAYTw/p2p/12D3KooWALjeG5hYT9qtBtqpv1X3Z4HVgjDrBamHfo37Jd61uW1t',
// 			// '/dns4/istanbul.le-space.de/tcp/443/wss/p2p/12D3KooWP2xyF6sHAtfVbUybUsu4F8Ku6acw9X5PX815fQt17Lm2',
// 			// '/dns4/ipfs.namokado.com/tcp/443/wss/p2p/12D3KooWLzMiAt4S8YWH7QANh3SURDwfV3Cgih1XYPAePSYWR1c'
// 		] }),
// 		pubsubPeerDiscovery({
// 			interval: 10000,
// 			topics: [pubsubPeerDiscoveryTopics], // defaults to ['_peer-discovery._p2p._pubsub'] //if we enable this too many will connect to us!
// 			listenOnly: false
// 		})
//   ],
//   services: {
//     identify: identify(),
//     autoNAT: autoNAT(),
//     dcutr: dcutr(),
//     ping: ping(),
//     pubsub: gossipsub({ allowPublishToZeroTopicPeers: true, canRelayMessage: true }),
//   }
// }